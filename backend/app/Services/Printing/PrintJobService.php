<?php

namespace App\Services\Printing;

use App\Models\Document;
use App\Models\PrintJob;
use App\Models\PrintOrder;
use App\Services\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Prints a PAID order. Only a server-verified payment ever reaches here (EloquentPaymentStore dispatches it),
 * and the job row guarantees an order is never sent to the printer twice.
 */
class PrintJobService
{
    public function __construct(
        private readonly PrintFileComposer $composer,
        private readonly PrinterDriver $driver,
        private readonly AuditLogger $audit,
    ) {}

    /** Create the job row (idempotent). Called inside the payment transaction. */
    public function enqueue(PrintOrder $order): PrintJob
    {
        return PrintJob::query()->firstOrCreate(['print_order_id' => $order->id], ['status' => PrintJob::QUEUED, 'driver' => $this->driver->name()]);
    }

    /**
     * @param  bool  $final  true on the last attempt: a retryable failure then becomes `failed` instead of being re-queued.
     *
     * @throws PrintException when a retry should happen
     */
    public function print(string $orderId, bool $final = true): void
    {
        $job = DB::transaction(function () use ($orderId) {
            $order = PrintOrder::query()->whereKey($orderId)->lockForUpdate()->first();
            if ($order === null || $order->status !== 'paid') {
                return null; // never print an unpaid order
            }
            $job = PrintJob::query()->where('print_order_id', $order->id)->lockForUpdate()->first() ?? $this->enqueue($order);
            if ($job->status === PrintJob::SENT) {
                return null;
            }
            if ($job->status === PrintJob::SENDING) {
                // A worker died between handing the file over and recording it: we can't tell whether it printed.
                // Reprinting could double-print, so hand it to staff.
                $job->forceFill(['status' => PrintJob::FAILED, 'failure_reason' => 'Print status unknown — check the printer before retrying.'])->save();
                $this->audit->log('print.unknown', $job, ['order' => $order->reference]);

                return null;
            }
            $job->forceFill(['status' => PrintJob::PREPARING, 'attempts' => $job->attempts + 1, 'driver' => $this->driver->name(), 'failure_reason' => null])->save();

            return [$job, $order];
        });
        if ($job === null) {
            return;
        }
        [$job, $order] = $job;

        $tmp = null;
        try {
            if (! $this->driver->available()) {
                throw new PrintException('The printer is not set up on this machine.', retryable: false);
            }
            [$file, $tmp, $pages, $direct] = $this->prepareFile($order);
            $job->forceFill(['status' => PrintJob::SENDING, 'pages' => $pages])->save();
            $settings = $order->print_settings;
            $jobId = $this->driver->send($file, [
                'reference' => $order->reference,
                'title' => 'Taprint '.$order->reference,
                'copies' => max(1, (int) ($settings['copies'] ?? 1)),
                'color' => ($settings['color_mode'] ?? 'bw') === 'color',
                'duplex' => (bool) ($settings['duplex'] ?? false),
                'landscape' => ($settings['orientation'] ?? 'portrait') === 'landscape',
                'paper' => (string) ($settings['paper_size'] ?? 'A4'),
                'direct' => $direct,
            ]);
            $job->forceFill(['status' => PrintJob::SENT, 'printer_job_id' => $jobId ? mb_substr($jobId, 0, 100) : null, 'sent_at' => now()])->save();
            $this->scheduleErase($order);
            $this->audit->log('print.sent', $job, ['order' => $order->reference, 'pages' => $pages, 'driver' => $this->driver->name()]);
        } catch (PrintException $e) {
            $this->fail($job, $order, $e->getMessage(), $e->retryable && ! $final);
            if ($e->retryable && ! $final) {
                throw $e;
            }
        } catch (\Throwable $e) {
            Log::error('Print job crashed', ['order' => $order->reference, 'error' => $e->getMessage()]);
            $this->fail($job, $order, 'Something went wrong while printing.', false);
        } finally {
            if ($tmp !== null && is_file($tmp)) {
                @unlink($tmp);
            }
        }
    }

    /** Privacy: shorten the retention of this session's files so they disappear shortly after a successful print. */
    private function scheduleErase(PrintOrder $order): void
    {
        $minutes = (int) config('printbuddy.printing.erase_after_minutes', 10);
        if ($minutes <= 0) {
            return;
        }
        Document::query()->where('qr_session_id', $order->qr_session_id)->whereNull('deleted_at')
            ->where(fn ($q) => $q->whereNull('delete_after')->orWhere('delete_after', '>', now()->addMinutes($minutes)))
            ->update(['delete_after' => now()->addMinutes($minutes)]);
    }

    /** Staff retry for a failed job. Resets it to queued; the caller dispatches PrintOrderJob. */
    public function reset(PrintOrder $order, ?int $userId = null): PrintJob
    {
        if ($order->status !== 'paid') {
            throw new \InvalidArgumentException('Only paid orders can be printed.');
        }
        $job = $this->enqueue($order);
        if ($job->status === PrintJob::SENT) {
            throw new \InvalidArgumentException('This order has already been sent to the printer.');
        }
        $job->forceFill(['status' => PrintJob::QUEUED, 'failure_reason' => null])->save();
        $this->audit->log('print.retry', $job, ['order' => $order->reference], $userId);

        return $job;
    }

    private function fail(PrintJob $job, PrintOrder $order, string $reason, bool $willRetry): void
    {
        $job->forceFill(['status' => $willRetry ? PrintJob::QUEUED : PrintJob::FAILED, 'failure_reason' => mb_substr($reason, 0, 250)])->save();
        if (! $willRetry) {
            $this->audit->log('print.failed', $job, ['order' => $order->reference, 'reason' => $reason]);
        }
    }

    /** @return array{0:string,1:?string,2:int,3:bool} file to send, temp file to delete, pages, direct */
    private function prepareFile(PrintOrder $order): array
    {
        $doc = Document::query()->find($order->document_id);
        if ($doc === null || $doc->deleted_at !== null) {
            throw new PrintException('The document is no longer available.');
        }
        $disk = Storage::disk(config('printbuddy.documents_disk'));
        $settings = (array) $order->print_settings;
        $isImage = in_array($doc->kind, ['jpg', 'png'], true);

        if (PrintFileComposer::isDirect($settings, (string) $doc->kind)) {
            $path = $disk->path((string) ($doc->preview_path ?: $doc->storage_path));
            if (! is_file($path)) {
                throw new PrintException('The document file is missing.');
            }

            return [$path, null, (int) $doc->page_count, true];
        }
        if (! $this->composer->available()) {
            throw new PrintException('Page preparation (Poppler) is not installed on this machine.');
        }

        if ($isImage) {
            $ids = collect($settings['edits']['sheet']['images'] ?? [])->pluck('document_id')->push($doc->id)->unique()->all();
            $imageDocs = Document::query()->whereIn('id', $ids)->where('qr_session_id', $order->qr_session_id)->whereNull('deleted_at')->get();
            $paths = [];
            foreach ($imageDocs as $d) {
                if (in_array($d->kind, ['jpg', 'png'], true)) {
                    $paths[$d->id] = ['path' => $disk->path($d->storage_path), 'kind' => $d->kind];
                }
            }
            $source = ['kind' => $doc->kind, 'id' => $doc->id, 'image_paths' => $paths];
        } else {
            $source = ['kind' => 'pdf', 'path' => $disk->path((string) ($doc->preview_path ?: $doc->storage_path)), 'page_count' => (int) $doc->page_count];
        }

        $tmp = tempnam(sys_get_temp_dir(), 'pbprint').'.pdf';
        $out = $this->composer->compose($settings, $source, $tmp);

        return [$tmp, $tmp, $out['pages'], false];
    }
}

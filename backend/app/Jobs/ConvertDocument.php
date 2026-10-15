<?php

namespace App\Jobs;

use App\Models\Document;
use App\Services\Audit\AuditLogger;
use App\Services\Documents\Conversion\ConversionException;
use App\Services\Documents\Conversion\DocumentConverter;
use App\Services\Documents\PdfInspector;
use App\Services\Documents\TextToPdf;
use App\Support\Settings;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Prepares an uploaded document for preview/pricing: validates it, converts Office/TXT to PDF and
 * records the page count. Runs on the queue; every failure path leaves the row in `failed` with a
 * customer-safe reason (never a server path or stack trace).
 */
class ConvertDocument implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 180;

    public function __construct(public readonly string $documentId) {}

    public function handle(DocumentConverter $converter, PdfInspector $pdf, TextToPdf $text, Settings $settings, AuditLogger $audit): void
    {
        $doc = Document::query()->find($this->documentId);
        if ($doc === null || $doc->deleted_at !== null || $doc->status === Document::READY) {
            return;
        }
        $doc->forceFill(['status' => Document::CONVERTING, 'conversion_attempts' => $doc->conversion_attempts + 1])->save();

        $disk = Storage::disk(config('printbuddy.documents_disk'));
        $source = $disk->path($doc->storage_path);
        $maxPages = $settings->int('max_pages');

        try {
            if (! is_file($source)) {
                throw new ConversionException('The uploaded file is no longer available.');
            }
            [$previewPath, $pages] = match ($doc->kind) {
                'pdf' => [$doc->storage_path, $pdf->pageCount($source)],
                'jpg', 'png' => [$doc->storage_path, $this->checkImage($source)],
                'txt' => $this->viaPdf($doc, fn (string $target) => $text->convert($source, $target, $maxPages), $pdf, $disk),
                'ole', 'ooxml' => $this->viaPdf($doc, fn (string $target) => $converter->toPdf($source, $target), $pdf, $disk),
                default => throw new ConversionException('Unsupported document type.'),
            };
            if ($pages > $maxPages) {
                throw new ConversionException("Documents are limited to {$maxPages} pages.");
            }
            $doc->forceFill(['status' => Document::READY, 'preview_path' => $previewPath, 'page_count' => $pages, 'failure_reason' => null])->save();
            $audit->log('document.ready', $doc, ['pages' => $pages]);
        } catch (ConversionException|RuntimeException $e) {
            $doc->forceFill(['status' => Document::FAILED, 'failure_reason' => mb_substr($e->getMessage(), 0, 250)])->save();
            $audit->log('document.failed', $doc, ['reason' => $e->getMessage()]);
        } catch (\Throwable $e) {
            Log::error('Document conversion crashed', ['document' => $doc->id, 'error' => $e->getMessage()]);
            $doc->forceFill(['status' => Document::FAILED, 'failure_reason' => 'Something went wrong while preparing this document.'])->save();
            $audit->log('document.failed', $doc, ['reason' => 'exception']);
        }
    }

    /** @return array{0:string,1:int} */
    private function viaPdf(Document $doc, callable $convert, PdfInspector $pdf, $disk): array
    {
        $previewPath = dirname($doc->storage_path).'/'.pathinfo($doc->storage_path, PATHINFO_FILENAME).'.preview.pdf';
        $target = $disk->path($previewPath);
        @mkdir(dirname($target), 0770, true);
        $convert($target);
        if (! is_file($target)) {
            throw new ConversionException('The converted file could not be stored.', retryable: true);
        }

        return [$previewPath, $pdf->pageCount($target)];
    }

    private function checkImage(string $path): int
    {
        $info = @getimagesize($path);
        if ($info === false || $info[0] < 1 || $info[1] < 1) {
            throw new ConversionException('This image could not be read.');
        }
        if ($info[0] * $info[1] > 80_000_000) {
            throw new ConversionException('This image is too large to print (max 80 megapixels).');
        }

        return 1;
    }
}

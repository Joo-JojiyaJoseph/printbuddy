<?php

namespace App\Services\Documents;

use App\Exceptions\ApiProblem;
use App\Jobs\ConvertDocument;
use App\Models\Document;
use App\Models\PrintOrder;
use App\Models\QrSession;
use App\Services\Audit\AuditLogger;
use App\Services\Documents\Editing\EditingException;
use App\Services\Documents\Editing\HtmlSanitizer;
use App\Services\Documents\Editing\OfficeHtmlBridge;
use App\Services\Documents\Editing\PdfTextExtractor;
use App\Support\Settings;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class DocumentService
{
    public function __construct(
        private readonly Settings $settings,
        private readonly FileTypeDetector $detector,
        private readonly AuditLogger $audit,
        private readonly PdfInspector $pdfInspector,
        private readonly OfficeHtmlBridge $bridge,
        private readonly PdfTextExtractor $extractor,
        private readonly PdfMerger $merger,
    ) {}

    public function disk(): Filesystem
    {
        return Storage::disk(config('printbuddy.documents_disk'));
    }

    /**
     * Validate content, store privately under an opaque name and queue conversion.
     *
     * @throws ApiProblem 413/415/422/409 with customer-safe messages
     */
    public function store(QrSession $session, UploadedFile $file): Document
    {
        if (! $file->isValid()) {
            throw new ApiProblem('The upload did not complete. Please try again.', 422);
        }
        $maxBytes = $this->settings->maxUploadBytes();
        if ($file->getSize() === 0) {
            throw new ApiProblem('This file is empty.', 422);
        }
        if ($file->getSize() > $maxBytes) {
            throw new ApiProblem(sprintf('Files must be %d MB or smaller.', $this->settings->int('max_upload_mb')), 413);
        }
        $count = $session->documents()->count();
        if ($count >= $this->settings->int('max_files')) {
            throw new ApiProblem(sprintf('You can add up to %d files at a time.', $this->settings->int('max_files')), 422);
        }

        $type = $this->detector->inspect($file->getRealPath(), $file->getClientOriginalName(), (array) $this->settings->get('allowed_types'));
        if (! $type['ok']) {
            throw new ApiProblem($type['error'], $type['status']);
        }

        $sha = hash_file('sha256', $file->getRealPath());
        if ($session->documents()->where('sha256', $sha)->exists()) {
            throw new ApiProblem('You have already uploaded this file.', 409);
        }

        $safeName = Str::limit(preg_replace('/[^\w .()\-]+/u', '_', $file->getClientOriginalName()) ?: 'document', 200, '');
        $path = $session->id.'/'.Str::uuid().'.'.$type['ext'];
        $this->disk()->putFileAs(dirname($path), $file, basename($path));

        $document = Document::query()->create([
            'qr_session_id' => $session->id,
            'original_name' => $safeName,
            'detected_mime' => $type['mime'],
            'kind' => $type['kind'],
            'storage_path' => $path,
            'sha256' => $sha,
            'size_bytes' => $file->getSize(),
            'status' => Document::UPLOADED,
            'delete_after' => now()->addHours($this->settings->int('document_retention_hours')),
        ]);
        $this->audit->log('document.uploaded', $document, ['kind' => $type['kind'], 'size' => $file->getSize()]);

        $this->dispatchConversion($document);

        return $document->refresh();
    }

    /**
     * Combine several ready documents of this session into ONE new PDF document (one order, one payment, one print).
     * The originals are kept. Order of $ids is the print order.
     *
     * @param  list<string>  $ids
     *
     * @throws ApiProblem
     */
    public function merge(QrSession $session, array $ids): Document
    {
        $ids = array_values(array_unique($ids));
        if (count($ids) < 2 || count($ids) > $this->settings->int('max_files')) {
            throw new ApiProblem('Choose at least two files to combine.', 422);
        }
        $docs = $session->documents()->whereIn('id', $ids)->whereNull('deleted_at')->get()->keyBy('id');
        if ($docs->count() !== count($ids) || $docs->contains(fn (Document $d) => $d->status !== Document::READY)) {
            throw new ApiProblem('Wait until every selected file has finished preparing.', 409);
        }
        if ($session->documents()->count() >= $this->settings->int('max_files')) {
            throw new ApiProblem(sprintf('You can add up to %d files at a time. Remove one first.', $this->settings->int('max_files')), 422);
        }
        $items = [];
        $pages = 0;
        foreach ($ids as $id) {
            $d = $docs[$id];
            $items[] = ['kind' => $d->isImage() ? $d->kind : 'pdf', 'path' => $this->disk()->path((string) ($d->isImage() ? $d->storage_path : ($d->preview_path ?: $d->storage_path)))];
            $pages += (int) $d->page_count;
        }
        if ($pages > $this->settings->int('max_pages')) {
            throw new ApiProblem(sprintf('Together these files are %d pages; the limit is %d.', $pages, $this->settings->int('max_pages')), 422);
        }

        @set_time_limit(180);
        $path = $session->id.'/'.Str::uuid().'.pdf';
        $target = $this->disk()->path($path);
        try {
            $this->merger->merge($items, $target);
            $count = $this->pdfInspector->pageCount($target);
        } catch (\RuntimeException $e) {
            @unlink($target);
            throw new ApiProblem($e->getMessage(), 422);
        }

        $document = Document::query()->create([
            'qr_session_id' => $session->id,
            'original_name' => sprintf('Combined (%d files).pdf', count($ids)),
            'detected_mime' => 'application/pdf',
            'kind' => 'pdf',
            'storage_path' => $path,
            'preview_path' => $path,
            'sha256' => hash_file('sha256', $target),
            'size_bytes' => (int) filesize($target),
            'page_count' => $count,
            'status' => Document::READY,
            'delete_after' => now()->addHours($this->settings->int('document_retention_hours')),
        ]);
        $this->audit->log('document.merged', $document, ['files' => count($ids), 'pages' => $count]);

        return $document->refresh();
    }

    public function retry(Document $document): Document
    {
        if (! $document->canRetry()) {
            throw new ApiProblem('This document cannot be retried.', 409);
        }
        $document->forceFill(['status' => Document::UPLOADED, 'failure_reason' => null])->save();
        $this->audit->log('document.retry', $document, ['attempt' => $document->conversion_attempts + 1]);
        $this->dispatchConversion($document);

        return $document->refresh();
    }

    /**
     * Prepare the file inside the upload request so nothing else (no queue worker) has to be running:
     * the customer's upload finishes when the preview is ready. Office files take a little longer
     * (LibreOffice); ConvertDocument records a customer-safe failure instead of throwing.
     */
    private function dispatchConversion(Document $document): void
    {
        ConvertDocument::dispatchSync($document->id);
    }

    /** Remove files and soft-mark the row (metadata is kept for orders and audit). */
    public function delete(Document $document, string $reason = 'customer'): void
    {
        if ($document->deleted_at !== null) {
            return;
        }
        $this->removeFiles($document);
        $document->forceFill(['deleted_at' => now()])->save();
        $this->audit->log('document.deleted', $document, ['reason' => $reason]);
    }

    /**
     * Runs the retention cleanup at most once a minute, piggy-backed on normal traffic, so files are erased on time
     * even when no cron/scheduler is running.
     */
    public function purgeExpiredThrottled(): void
    {
        try {
            if (\Illuminate\Support\Facades\Cache::add('printbuddy.purge-lock', 1, 60)) {
                $this->purgeExpired();
            }
        } catch (\Throwable) {
            // cleanup must never break a customer request
        }
    }

    /** Retention cleanup. Idempotent and safe to rerun; skips documents still converting. */
    public function purgeExpired(): int
    {
        $n = 0;
        Document::query()->dueForPurge()->where('status', '!=', Document::CONVERTING)
            ->orderBy('delete_after')->chunkById(100, function ($docs) use (&$n) {
                foreach ($docs as $doc) {
                    $this->delete($doc, 'retention');
                    $n++;
                }
            });

        return $n;
    }

    private function removeFiles(Document $document): void
    {
        foreach (array_unique(array_filter([$document->storage_path, $document->preview_path, ...$this->editedPaths($document)])) as $p) {
            if ($this->disk()->exists($p)) {
                $this->disk()->delete($p);
            }
        }
    }

    /** Documents whose text can be opened in the editor: PDF, TXT and Word (not Excel/PowerPoint/images). */
    public function canEditText(Document $document): bool
    {
        if ($document->status !== Document::READY || $document->deleted_at !== null) {
            return false;
        }

        return match ($document->kind) {
            'pdf', 'txt' => true,
            'ooxml' => str_contains((string) $document->detected_mime, 'wordprocessingml'),
            'ole' => strtolower(pathinfo((string) $document->original_name, PATHINFO_EXTENSION)) === 'doc',
            default => false,
        };
    }

    public function isEdited(Document $document): bool
    {
        return $document->preview_path !== null && str_ends_with($document->preview_path, '.edited.pdf');
    }

    /**
     * HTML for the text editor. Starts from the customer's last saved edit if there is one, otherwise from the
     * original: Word via LibreOffice, TXT as paragraphs, PDF by reading its text (lossy: no layout or pictures).
     *
     * @return array{html:string,source:string,lossy:bool}
     */
    public function editableHtml(Document $document): array
    {
        $this->assertEditable($document);
        [$savedHtml] = $this->editedPaths($document);
        if ($this->disk()->exists($savedHtml)) {
            return ['html' => HtmlSanitizer::clean((string) $this->disk()->get($savedHtml)), 'source' => 'saved', 'lossy' => false];
        }
        $source = $this->disk()->path($document->storage_path);
        try {
            if ($document->kind === 'pdf') {
                $result = ['html' => $this->extractor->toHtml($source, $this->settings->int('max_pages')), 'source' => 'pdf', 'lossy' => true];
            } elseif ($document->kind === 'txt') {
                $result = ['html' => $this->textToHtml((string) file_get_contents($source, false, null, 0, 1_000_000)), 'source' => 'txt', 'lossy' => false];
            } else {
                $raw = $this->bridge->wordToHtml($source, $document->kind === 'ooxml' ? 'docx' : 'doc');
                $result = ['html' => $raw, 'source' => 'word', 'lossy' => false];
            }
        } catch (EditingException $e) {
            throw new ApiProblem($e->getMessage(), 422);
        }
        $result['html'] = HtmlSanitizer::clean($result['html']);

        return $result;
    }

    /** Turn the edited HTML into a new print PDF. The original upload is never modified. */
    public function saveEditedContent(Document $document, string $html): Document
    {
        $this->assertEditable($document);
        if (PrintOrder::query()->where('document_id', $document->id)->whereNotIn('status', ['cancelled', 'expired'])->exists()) {
            throw new ApiProblem('This document is already part of an order and can no longer be edited.', 409);
        }
        $clean = HtmlSanitizer::clean($html);
        if (trim(strip_tags($clean)) === '' && ! str_contains($clean, '<img')) {
            throw new ApiProblem('The document is empty. Add some text first.', 422);
        }
        [$htmlPath, $pdfPath] = $this->editedPaths($document);
        $tmp = $this->disk()->path(dirname($pdfPath)).DIRECTORY_SEPARATOR.Str::uuid().'.tmp.pdf';

        try {
            $this->bridge->htmlToPdf($clean, $tmp);
            $pages = $this->pdfInspector->pageCount($tmp);
            if ($pages > $this->settings->int('max_pages')) {
                throw new ApiProblem(sprintf('Documents are limited to %d pages.', $this->settings->int('max_pages')), 422);
            }
            $target = $this->disk()->path($pdfPath);
            if (! @rename($tmp, $target) && ! (@copy($tmp, $target) && @unlink($tmp))) {
                throw new ApiProblem('The edited document could not be stored.', 500);
            }
        } catch (EditingException|\RuntimeException $e) {
            throw new ApiProblem($e->getMessage(), 422);
        } finally {
            if (is_file($tmp)) {
                @unlink($tmp);
            }
        }
        $this->disk()->put($htmlPath, $clean);
        $document->forceFill(['preview_path' => $pdfPath, 'page_count' => $pages, 'failure_reason' => null])->save();
        $this->audit->log('document.edited', $document, ['pages' => $pages]); // never log the text itself

        return $document->refresh();
    }

    /** Throw away the customer's text edits and go back to the original conversion. */
    public function revertEdits(Document $document): Document
    {
        if (PrintOrder::query()->where('document_id', $document->id)->whereNotIn('status', ['cancelled', 'expired'])->exists()) {
            throw new ApiProblem('This document is already part of an order.', 409);
        }
        foreach ($this->editedPaths($document) as $p) {
            if ($this->disk()->exists($p)) {
                $this->disk()->delete($p);
            }
        }
        $document->forceFill(['status' => Document::UPLOADED, 'preview_path' => null, 'failure_reason' => null])->save();
        $this->audit->log('document.edit_reverted', $document);
        $this->dispatchConversion($document);

        return $document->refresh();
    }

    /** @return array{0:string,1:string} saved-html path, edited-pdf path (same private directory as the upload) */
    private function editedPaths(Document $document): array
    {
        $base = dirname((string) $document->storage_path).'/'.pathinfo((string) $document->storage_path, PATHINFO_FILENAME);

        return [$base.'.edited.html', $base.'.edited.pdf'];
    }

    private function assertEditable(Document $document): void
    {
        if (! $this->canEditText($document)) {
            throw new ApiProblem('This document cannot be edited as text.', 409);
        }
    }

    private function textToHtml(string $text): string
    {
        $text = mb_convert_encoding($text, 'UTF-8', ['UTF-8', 'Windows-1252']);
        $paragraphs = preg_split('/\R{2,}/u', trim($text)) ?: [];

        return implode('', array_map(
            fn ($p) => '<p>'.implode('<br>', array_map(fn ($l) => htmlspecialchars($l, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), preg_split('/\R/u', trim($p)) ?: [])).'</p>',
            array_filter($paragraphs, fn ($p) => trim($p) !== ''),
        ));
    }

    /** Short-lived signed URL for the preview; bound to the document AND its session. */
    public function previewUrl(Document $document): ?string
    {
        if ($document->status !== Document::READY) {
            return null;
        }
        $expires = $document->session?->expires_at ?? now()->addMinutes(15);
        if ($expires->lt(now()->addMinutes(5))) {
            $expires = now()->addMinutes(5);
        }

        return URL::temporarySignedRoute('v1.documents.preview', $expires, ['document' => $document->id, 's' => $document->qr_session_id, 'v' => $document->updated_at?->timestamp ?? 0]);
    }
}

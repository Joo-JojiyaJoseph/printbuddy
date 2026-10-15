<?php

namespace App\Services\Documents;

use App\Exceptions\ApiProblem;
use App\Jobs\ConvertDocument;
use App\Models\Document;
use App\Models\QrSession;
use App\Services\Audit\AuditLogger;
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
            throw new ApiProblem(sprintf('You can add up to %d files per session.', $this->settings->int('max_files')), 422);
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
     * PDFs, images and text need no external process, so prepare them immediately; this keeps the
     * preview working even when no queue worker is running. Office files (LibreOffice) stay queued.
     */
    private function dispatchConversion(Document $document): void
    {
        if (in_array($document->kind, ['pdf', 'jpg', 'png', 'txt'], true)) {
            ConvertDocument::dispatchSync($document->id);

            return;
        }
        ConvertDocument::dispatch($document->id);
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
        foreach (array_unique(array_filter([$document->storage_path, $document->preview_path])) as $p) {
            if ($this->disk()->exists($p)) {
                $this->disk()->delete($p);
            }
        }
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

        return URL::temporarySignedRoute('v1.documents.preview', $expires, ['document' => $document->id, 's' => $document->qr_session_id]);
    }
}

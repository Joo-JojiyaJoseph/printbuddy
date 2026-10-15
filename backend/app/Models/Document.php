<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    use HasUuids;

    public const UPLOADED = 'uploaded';
    public const CONVERTING = 'converting';
    public const READY = 'ready';
    public const FAILED = 'failed';

    protected $fillable = [
        'qr_session_id', 'original_name', 'detected_mime', 'kind', 'storage_path', 'preview_path',
        'sha256', 'size_bytes', 'page_count', 'status', 'failure_reason', 'conversion_attempts',
        'delete_after', 'deleted_at',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'page_count' => 'integer',
            'conversion_attempts' => 'integer',
            'delete_after' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(QrSession::class, 'qr_session_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(PrintOrder::class);
    }

    public function isImage(): bool
    {
        return in_array($this->kind, ['jpg', 'png'], true);
    }

    /** Mime type to serve the preview with (always derived from the detected kind, never the client). */
    public function previewMime(): string
    {
        return match ($this->kind) {
            'jpg' => 'image/jpeg',
            'png' => 'image/png',
            default => 'application/pdf',
        };
    }

    public function canRetry(): bool
    {
        return $this->status === self::FAILED
            && $this->conversion_attempts < (int) config('printbuddy.conversion.max_attempts');
    }

    /** Documents whose retention window has passed and whose file is still on disk. */
    public function scopeDueForPurge($q)
    {
        return $q->whereNull('deleted_at')->where('delete_after', '<=', now());
    }
}

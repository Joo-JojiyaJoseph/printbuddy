<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QrSession extends Model
{
    use HasUuids;

    public const ACTIVE = 'active';
    public const COMPLETED = 'completed';
    public const EXPIRED = 'expired';
    public const CANCELLED = 'cancelled';

    protected $fillable = ['kiosk_id', 'token_hash', 'status', 'expires_at', 'claimed_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'claimed_at' => 'datetime'];
    }

    public function kiosk(): BelongsTo
    {
        return $this->belongsTo(Kiosk::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class)->whereNull('deleted_at');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(PrintOrder::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /** Usable for customer requests: active or completed and not past expiry. */
    public function isUsable(): bool
    {
        return in_array($this->status, [self::ACTIVE, self::COMPLETED], true) && ! $this->isExpired();
    }

    public function scopeUsable(Builder $q): Builder
    {
        return $q->whereIn('status', [self::ACTIVE, self::COMPLETED])->where('expires_at', '>', now());
    }

    /** Public, non-sequential state label for the kiosk / customer UI. */
    public function displayStatus(): string
    {
        if ($this->status === self::ACTIVE && $this->isExpired()) {
            return self::EXPIRED;
        }
        if ($this->status === self::ACTIVE) {
            return $this->claimed_at ? 'active' : 'waiting';
        }

        return $this->status;
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasUuids;

    public const PENDING = 'pending';
    public const SUCCEEDED = 'succeeded';
    public const FAILED = 'failed';
    public const EXPIRED = 'expired';

    protected $fillable = [
        'print_order_id', 'provider', 'provider_payment_id', 'amount_paise', 'currency', 'status',
        'qr_payload', 'expires_at', 'verified_at', 'review_reason', 'provider_meta',
    ];

    protected function casts(): array
    {
        return [
            'amount_paise' => 'integer',
            'expires_at' => 'datetime',
            'verified_at' => 'datetime',
            'provider_meta' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(PrintOrder::class, 'print_order_id');
    }

    public function isOpen(): bool
    {
        return $this->status === self::PENDING && $this->expires_at && $this->expires_at->isFuture();
    }
}

<?php

namespace App\Models;

use App\Services\OrderStateMachine;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PrintOrder extends Model
{
    use HasUuids;

    public const STATUSES = ['draft', 'uploaded', 'configured', 'awaiting_payment', 'paid', 'payment_failed', 'expired', 'cancelled'];

    protected $fillable = [
        'reference', 'idempotency_key', 'qr_session_id', 'document_id', 'status', 'print_settings',
        'pricing_snapshot', 'total_paise', 'currency', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'print_settings' => 'array',
            'pricing_snapshot' => 'array',
            'total_paise' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(QrSession::class, 'qr_session_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class)->withoutGlobalScopes();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function latestPayment(): HasOne
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    /** Apply a transition through the state machine; throws InvalidArgumentException when not allowed. */
    public function transitionTo(string $status): void
    {
        OrderStateMachine::assert($this->status, $status);
        $this->status = $status;
    }

    public function canTransitionTo(string $status): bool
    {
        return OrderStateMachine::can($this->status, $status);
    }
}

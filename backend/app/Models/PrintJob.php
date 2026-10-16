<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrintJob extends Model
{
    use HasUuids;

    public const QUEUED = 'queued';
    public const PREPARING = 'preparing';
    public const SENDING = 'sending';
    public const SENT = 'sent';
    public const FAILED = 'failed';

    /** Statuses in which the job is still being worked on (documents must not be purged). */
    public const IN_FLIGHT = [self::QUEUED, self::PREPARING, self::SENDING];

    protected $fillable = ['print_order_id', 'status', 'attempts', 'driver', 'printer_job_id', 'pages', 'failure_reason', 'sent_at'];

    protected function casts(): array
    {
        return ['attempts' => 'integer', 'pages' => 'integer', 'sent_at' => 'datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(PrintOrder::class, 'print_order_id');
    }
}

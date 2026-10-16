<?php

namespace App\Jobs;

use App\Services\Printing\PrintException;
use App\Services\Printing\PrintJobService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Sends a paid order to the printer. Safe to run twice: PrintJobService never reprints a sent order. */
class PrintOrderJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 300;

    public function __construct(public readonly string $orderId, public readonly bool $inline = false)
    {
        $this->afterCommit = true;
    }

    /** @return int[] */
    public function backoff(): array
    {
        return [10, 30];
    }

    public function handle(PrintJobService $service): void
    {
        // Run inline (no queue worker) there is no retry mechanism, so the single attempt is the final one.
        $service->print($this->orderId, final: $this->inline || $this->attempts() >= $this->tries);
    }

    public function failed(\Throwable $e): void
    {
        // PrintJobService already recorded the failure; nothing else to do (and nothing sensitive to log).
    }
}

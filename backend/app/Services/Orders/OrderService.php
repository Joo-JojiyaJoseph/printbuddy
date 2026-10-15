<?php

namespace App\Services\Orders;

use App\Exceptions\ApiProblem;
use App\Models\Document;
use App\Models\PrintOrder;
use App\Models\QrSession;
use App\Services\Audit\AuditLogger;
use App\Services\Pricing\PricingRulesRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class OrderService
{
    public function __construct(
        private readonly PricingRulesRepository $pricing,
        private readonly AuditLogger $audit,
    ) {}

    /** Authoritative quote for a ready document in this session. */
    public function quote(Document $document, array $settings): array
    {
        if ($document->status !== Document::READY || $document->page_count < 1) {
            throw new ApiProblem('Document is not ready yet.', 409);
        }
        try {
            return $this->pricing->service()->quote(
                $document->page_count, $settings['page_range'], $settings['copies'],
                $settings['paper_size'], $settings['color_mode'], $settings['duplex'],
            );
        } catch (InvalidArgumentException $e) {
            throw new ApiProblem($e->getMessage(), 422);
        }
    }

    /**
     * Create an order: re-price on the server, store the pricing snapshot and walk the state machine
     * draft -> uploaded -> configured. Idempotent per (session, Idempotency-Key).
     */
    public function create(QrSession $session, Document $document, array $settings, ?string $idempotencyKey): PrintOrder
    {
        if ($idempotencyKey !== null) {
            $existing = $session->orders()->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }
        }
        $quote = $this->quote($document, $settings);

        return DB::transaction(function () use ($session, $document, $settings, $quote, $idempotencyKey) {
            $order = new PrintOrder([
                'reference' => $this->newReference(),
                'idempotency_key' => $idempotencyKey,
                'qr_session_id' => $session->id,
                'document_id' => $document->id,
                'status' => 'draft',
                'print_settings' => $settings,
                'pricing_snapshot' => $quote,
                'total_paise' => $quote['total_paise'],
                'currency' => $quote['currency'],
            ]);
            $order->transitionTo('uploaded');
            $order->transitionTo('configured');
            $order->save();
            $this->audit->log('order.created', $order, ['total_paise' => $order->total_paise, 'status' => $order->status]);

            return $order;
        });
    }

    public function cancel(PrintOrder $order, string $by = 'customer'): PrintOrder
    {
        return DB::transaction(function () use ($order, $by) {
            $order = PrintOrder::query()->lockForUpdate()->findOrFail($order->id);
            if (! $order->canTransitionTo('cancelled')) {
                throw new ApiProblem("An order that is {$order->status} cannot be cancelled.", 409);
            }
            $order->transitionTo('cancelled');
            $order->save();
            $this->audit->log('order.cancelled', $order, ['by' => $by]);

            return $order;
        });
    }

    /** Orders left unpaid past their session expiry become `expired`. Safe to rerun. */
    public function expireStale(): int
    {
        $n = 0;
        PrintOrder::query()->whereIn('status', ['draft', 'uploaded', 'configured', 'awaiting_payment', 'payment_failed'])
            ->whereHas('session', fn ($q) => $q->where('expires_at', '<=', now()->subMinutes(5)))
            ->whereDoesntHave('payments', fn ($q) => $q->where('status', 'pending')->where('expires_at', '>', now()))
            ->chunkById(100, function ($orders) use (&$n) {
                foreach ($orders as $order) {
                    if ($order->canTransitionTo('expired')) {
                        $order->transitionTo('expired');
                        $order->save();
                        $this->audit->log('order.expired', $order);
                        $n++;
                    }
                }
            });

        return $n;
    }

    private function newReference(): string
    {
        do {
            $ref = 'PB-'.strtoupper(Str::random(8));
        } while (PrintOrder::query()->where('reference', $ref)->exists());

        return $ref;
    }
}

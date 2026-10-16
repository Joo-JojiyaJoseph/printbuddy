<?php

namespace App\Services\Payments;

use App\Jobs\PrintOrderJob;
use App\Models\Payment;
use App\Models\PrintJob;
use App\Models\PrintOrder;
use App\Models\QrSession;
use App\Models\WebhookEvent;
use App\Services\Audit\AuditLogger;
use App\Services\OrderStateMachine;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/** Database-backed PaymentStore. applyResult() runs in a transaction with row locks. */
class EloquentPaymentStore implements PaymentStore
{
    private array $eventPayload = [];

    public function __construct(private readonly string $provider, private readonly AuditLogger $audit) {}

    /** Attach the (already signature-checked) payload to the next recorded event. Secrets are never included. */
    public function withEventPayload(array $payload): static
    {
        $this->eventPayload = $payload;

        return $this;
    }

    public function recordWebhookEvent(string $eventId): bool
    {
        try {
            WebhookEvent::query()->create([
                'provider' => $this->provider,
                'event_id' => $eventId,
                'signature_valid' => true,
                'payload' => $this->eventPayload,
                'processed_at' => now(),
            ]);

            return true;
        } catch (QueryException $e) {
            // unique (provider, event_id) violated => duplicate delivery
            return false;
        }
    }

    public function payment(string $providerPaymentId): ?array
    {
        $p = Payment::query()->with('order:id,reference')->where('provider_payment_id', $providerPaymentId)->first();
        if ($p === null) {
            return null;
        }

        return ['order_reference' => $p->order->reference, 'amount_paise' => $p->amount_paise, 'currency' => $p->currency, 'status' => $p->status];
    }

    public function order(string $reference): ?array
    {
        $o = PrintOrder::query()->where('reference', $reference)->first();

        return $o ? ['status' => $o->status, 'total_paise' => $o->total_paise, 'currency' => $o->currency] : null;
    }

    public function applyResult(string $providerPaymentId, string $paymentStatus, string $orderStatus): void
    {
        DB::transaction(function () use ($providerPaymentId, $paymentStatus, $orderStatus) {
            $payment = Payment::query()->where('provider_payment_id', $providerPaymentId)->lockForUpdate()->firstOrFail();
            $order = PrintOrder::query()->whereKey($payment->print_order_id)->lockForUpdate()->firstOrFail();

            // Re-check under the lock: a concurrent webhook/poll may have applied the result already.
            if (! OrderStateMachine::can($order->status, $orderStatus)) {
                return;
            }
            $payment->forceFill([
                'status' => $paymentStatus,
                'verified_at' => $paymentStatus === Payment::SUCCEEDED ? now() : $payment->verified_at,
            ])->save();
            $order->transitionTo($orderStatus);
            if ($orderStatus === 'paid') {
                $order->paid_at = now();
                QrSession::query()->whereKey($order->qr_session_id)->where('status', QrSession::ACTIVE)->update(['status' => QrSession::COMPLETED]);
            }
            $order->save();
            if ($orderStatus === 'paid') {
                // Only a server-verified payment reaches this point. The job row is created in the same
                // transaction; the worker is dispatched after commit so it always sees a paid order.
                PrintJob::query()->firstOrCreate(['print_order_id' => $order->id], ['status' => PrintJob::QUEUED]);
                PrintOrderJob::dispatchAfterResponse($order->id, true); // runs right after this request finishes; no queue worker needed
            }
            $this->audit->log('payment.'.$paymentStatus, $payment, ['order' => $order->reference, 'order_status' => $orderStatus, 'amount_paise' => $payment->amount_paise]);
        });
    }

    public function flagForReview(string $providerPaymentId, string $reason): void
    {
        $payment = Payment::query()->where('provider_payment_id', $providerPaymentId)->first();
        if ($payment) {
            $payment->forceFill(['review_reason' => mb_substr($reason, 0, 250)])->save();
            $this->audit->log('payment.needs_review', $payment, ['reason' => $reason]);
        }
    }
}

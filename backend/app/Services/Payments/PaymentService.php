<?php

namespace App\Services\Payments;

use App\Exceptions\ApiProblem;
use App\Models\Payment;
use App\Models\PrintOrder;
use App\Services\Audit\AuditLogger;
use App\Services\Sessions\QrSessionService;
use App\Support\Settings;
use Illuminate\Support\Facades\DB;
use Throwable;

class PaymentService
{
    public function __construct(
        private readonly PaymentProvider $provider,
        private readonly PaymentProcessor $processor,
        private readonly Settings $settings,
        private readonly AuditLogger $audit,
        private readonly QrSessionService $sessions,
    ) {}

    public function providerName(): string
    {
        return (string) config('printbuddy.payment.provider');
    }

    /**
     * Create (or re-open) a payment for the exact server-side order total. Idempotent: an open pending
     * payment is returned as-is. Allowed from configured / payment_failed / awaiting_payment.
     */
    public function initiate(PrintOrder $order): Payment
    {
        $payment = DB::transaction(function () use ($order) {
            $order = PrintOrder::query()->lockForUpdate()->findOrFail($order->id);

            $open = $order->payments()->where('status', Payment::PENDING)->where('expires_at', '>', now())->latest()->first();
            if ($open) {
                return $open;
            }
            if (! in_array($order->status, ['configured', 'payment_failed', 'awaiting_payment'], true)) {
                throw new ApiProblem("Order is {$order->status}.", 409);
            }
            // Integrity: the stored snapshot must agree with the order total that will be charged.
            if ((int) ($order->pricing_snapshot['total_paise'] ?? -1) !== $order->total_paise || $order->total_paise < 100) {
                throw new ApiProblem('This order cannot be paid. Please create a new order.', 409);
            }
            // Any earlier pending payment that already lapsed is closed before opening a new one.
            $order->payments()->where('status', Payment::PENDING)->update(['status' => Payment::EXPIRED]);

            try {
                $remote = $this->provider->createPayment($order->reference, $order->total_paise, $order->currency);
            } catch (Throwable $e) {
                report($e);
                throw new ApiProblem('The payment service is temporarily unavailable. Please try again.', 503);
            }

            $ttl = $this->settings->int('payment_ttl_minutes');
            $expiresAt = now()->addMinutes($ttl);
            $payment = $order->payments()->create([
                'provider' => $this->providerName(),
                'provider_payment_id' => $remote['provider_payment_id'],
                'amount_paise' => $order->total_paise,
                'currency' => $order->currency,
                'status' => Payment::PENDING,
                'qr_payload' => $remote['qr_payload'],
                'expires_at' => $expiresAt,
            ]);
            if ($order->status !== 'awaiting_payment') {
                $order->transitionTo('awaiting_payment');
                $order->save();
            }
            $this->audit->log('payment.initiated', $payment, ['order' => $order->reference, 'amount_paise' => $payment->amount_paise]);

            return $payment;
        });

        $order->refresh();
        $this->sessions->extendUntil($order->session, $payment->expires_at->copy()->addMinutes(5));

        return $payment;
    }

    /**
     * Polling path: verify a pending payment against the provider and apply the result. Lapsed
     * pending payments are expired and the order returns to a retryable state.
     */
    public function refresh(Payment $payment): Payment
    {
        if ($payment->status !== Payment::PENDING) {
            return $payment;
        }
        try {
            $this->processor->reconcile($payment->provider_payment_id);
        } catch (Throwable $e) {
            report($e); // provider down: stay pending, the customer keeps polling
        }
        $payment->refresh();
        if ($payment->status === Payment::PENDING && $payment->expires_at->isPast()) {
            $this->expire($payment);
        }

        return $payment->refresh();
    }

    public function expire(Payment $payment): void
    {
        DB::transaction(function () use ($payment) {
            $payment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            if ($payment->status !== Payment::PENDING) {
                return;
            }
            $payment->forceFill(['status' => Payment::EXPIRED])->save();
            $order = PrintOrder::query()->lockForUpdate()->findOrFail($payment->print_order_id);
            if ($order->canTransitionTo('payment_failed')) {
                $order->transitionTo('payment_failed');
                $order->save();
            }
            $this->audit->log('payment.expired', $payment, ['order' => $order->reference]);
        });
    }

    /** Scheduled: close lapsed pending payments (after one last provider check). Safe to rerun. */
    public function expireStale(): int
    {
        $n = 0;
        Payment::query()->where('status', Payment::PENDING)->where('expires_at', '<=', now())
            ->chunkById(50, function ($payments) use (&$n) {
                foreach ($payments as $p) {
                    $this->refresh($p);
                    $n++;
                }
            });

        return $n;
    }
}

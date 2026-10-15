<?php

namespace App\Services\Payments;

use App\Services\OrderStateMachine;

/**
 * An order becomes `paid` only when ALL hold: valid signed webhook (or a reconcile call), provider confirms
 * success via a server-side lookup, and order reference, amount and currency match what we created.
 */
final class PaymentProcessor
{
    public function __construct(
        private readonly PaymentProvider $provider,
        private readonly PaymentStore $store,
        private readonly string $webhookSecret,
    ) {}

    public function handleWebhook(string $rawBody, string $signature, int $timestamp, int $now): string
    {
        if (!WebhookSignature::verify($rawBody, $signature, $timestamp, $this->webhookSecret, $now)) {
            return 'invalid_signature';
        }
        $event = json_decode($rawBody, true);
        $eventId = is_array($event) ? ($event['event_id'] ?? null) : null;
        $paymentId = is_array($event) ? ($event['provider_payment_id'] ?? null) : null;
        if (!is_string($eventId) || $eventId === '' || !is_string($paymentId) || $paymentId === '') {
            return 'malformed';
        }
        return $this->processEvent($eventId, $paymentId);
    }

    /**
     * Idempotently process an already-authenticated provider event. Providers with their own
     * signature scheme (e.g. Razorpay) verify first, then call this.
     */
    public function processEvent(string $eventId, string $paymentId): string
    {
        if (!$this->store->recordWebhookEvent($eventId)) {
            return 'duplicate';
        }
        // The webhook body is only a hint about WHICH payment to look at. Its claimed status is ignored.
        return $this->reconcile($paymentId);
    }

    /** Also used by the polling endpoint: ask the provider, then apply. */
    public function reconcile(string $providerPaymentId): string
    {
        $payment = $this->store->payment($providerPaymentId);
        if ($payment === null) {
            return 'unknown_payment';
        }
        $order = $this->store->order($payment['order_reference']);
        if ($order === null) {
            return 'unknown_order';
        }
        $remote = $this->provider->fetchPayment($providerPaymentId);

        if ($remote['order_reference'] !== $payment['order_reference']
            || $remote['amount_paise'] !== $payment['amount_paise']
            || $payment['amount_paise'] !== $order['total_paise']
            || $remote['currency'] !== $payment['currency']
            || $payment['currency'] !== $order['currency']) {
            return 'mismatch';
        }

        return match ($remote['status']) {
            'succeeded' => $this->onSucceeded($providerPaymentId, $order['status']),
            'failed' => $this->onFailed($providerPaymentId, $order['status']),
            default => 'pending',
        };
    }

    private function onSucceeded(string $paymentId, string $orderStatus): string
    {
        if ($orderStatus === 'paid') {
            return 'already_paid';
        }
        if (!OrderStateMachine::can($orderStatus, 'paid')) {
            $this->store->flagForReview($paymentId, "Payment succeeded while order was {$orderStatus}");
            return 'needs_review';
        }
        $this->store->applyResult($paymentId, 'succeeded', 'paid');
        return 'paid';
    }

    private function onFailed(string $paymentId, string $orderStatus): string
    {
        if (!OrderStateMachine::can($orderStatus, 'payment_failed')) {
            return 'ignored';
        }
        $this->store->applyResult($paymentId, 'failed', 'payment_failed');
        return 'failed';
    }
}

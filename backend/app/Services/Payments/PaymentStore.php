<?php

namespace App\Services\Payments;

/** Persistence port. The Eloquent implementation must wrap applyResult() in a DB transaction with row locks. */
interface PaymentStore
{
    /** Insert the event id; false if it was already seen (unique constraint = idempotency). */
    public function recordWebhookEvent(string $eventId): bool;

    /** @return array{order_reference:string,amount_paise:int,currency:string,status:string}|null */
    public function payment(string $providerPaymentId): ?array;

    /** @return array{status:string,total_paise:int,currency:string}|null */
    public function order(string $reference): ?array;

    public function applyResult(string $providerPaymentId, string $paymentStatus, string $orderStatus): void;

    /** Money arrived for an order that can no longer be fulfilled; flag for a human. */
    public function flagForReview(string $providerPaymentId, string $reason): void;
}

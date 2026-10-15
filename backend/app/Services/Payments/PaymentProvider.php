<?php

namespace App\Services\Payments;

/** Provider-specific code (Razorpay, Cashfree, ...) lives behind this interface. */
interface PaymentProvider
{
    /** @return array{provider_payment_id:string,qr_payload:string,expires_at:int} */
    public function createPayment(string $orderReference, int $amountPaise, string $currency): array;

    /**
     * Server-side lookup against the provider. This, not the webhook body, is the source of truth.
     * @return array{status:string,amount_paise:int,currency:string,order_reference:string} status: pending|succeeded|failed
     */
    public function fetchPayment(string $providerPaymentId): array;
}

<?php

namespace App\Services\Payments;

/**
 * Optional second way to pay: the provider's own hosted window (cards, netbanking, wallets, UPI).
 * The amount is fixed on the server when the provider-side order is created; the browser only opens the window.
 */
interface CheckoutProvider
{
    /** @return array{provider_payment_id:string,expires_at:int} the provider's order id (what the window pays against) */
    public function createCheckout(string $orderReference, int $amountPaise, string $currency): array;

    /** Public key the browser needs to open the window (never the secret). */
    public function checkoutKeyId(): string;

    /** True when the three values the window returned belong together (signed with the secret key). */
    public function verifyCheckoutSignature(string $providerOrderId, string $providerPaymentId, string $signature): bool;
}

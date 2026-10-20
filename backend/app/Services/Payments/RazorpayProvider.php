<?php

namespace App\Services\Payments;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Razorpay "QR Codes" adapter: one single-use, fixed-amount UPI QR per payment attempt.
 *   create:  POST {base}/payments/qr_codes   (type=upi_qr, usage=single_use, fixed_amount=true)
 *   lookup:  GET  {base}/payments/qr_codes/{id}
 *   webhook: X-Razorpay-Signature = HMAC-SHA256(raw body, webhook secret); event id in x-razorpay-event-id
 *
 * Written against Razorpay's public API documentation. It has NOT been exercised against a live
 * Razorpay test account in this repository (no credentials available) — see docs/payments.md for
 * the sandbox checklist before enabling PAYMENT_PROVIDER=razorpay.
 */
final class RazorpayProvider implements PaymentProvider, CheckoutProvider
{
    public function __construct(
        private readonly string $keyId,
        private readonly string $keySecret,
        private readonly string $webhookSecret,
        private readonly string $baseUrl,
        private readonly int $ttlSeconds,
    ) {
        if ($this->keyId === '' || $this->keySecret === '') {
            throw new RuntimeException('Razorpay credentials are not configured.');
        }
    }

    /** Checks the keys against Razorpay without creating anything. @return array{ok:bool,message:string} */
    public function ping(): array
    {
        try {
            $qr = $this->http()->get('/payments/qr_codes', ['count' => 1]);
            if ($qr->successful()) {
                return ['ok' => true, 'message' => 'Razorpay accepted the keys. UPI QR Codes and the card / netbanking window are both available.'];
            }
            if ($qr->status() === 401) {
                return ['ok' => false, 'message' => 'Razorpay rejected these keys. Check the Key ID and Key Secret.'];
            }
            // QR Codes may simply not be enabled on the account; the card / netbanking window does not need them.
            $orders = $this->http()->get('/orders', ['count' => 1]);
        } catch (\Throwable) {
            return ['ok' => false, 'message' => 'Could not reach Razorpay. Check the internet connection of the server (on Windows this is often a missing CA certificate file for PHP cURL).'];
        }
        if ($orders->successful()) {
            return ['ok' => true, 'message' => 'Razorpay accepted the keys. The card / netbanking window works. UPI QR Codes are not enabled on this account (ask Razorpay support to enable them), so customers will pay in the Razorpay window.'];
        }

        return ['ok' => false, 'message' => 'Razorpay answered with error '.$orders->status().'. Check the keys and that they belong to the same mode (test or live).'];
    }

    public function createPayment(string $orderReference, int $amountPaise, string $currency): array
    {
        if ($currency !== 'INR') {
            throw new RuntimeException('Razorpay UPI QR codes only support INR.');
        }
        $closeBy = time() + $this->ttlSeconds;
        $res = $this->http()->post('/payments/qr_codes', [
            'type' => 'upi_qr',
            'name' => 'Taprint '.$orderReference,
            'usage' => 'single_use',
            'fixed_amount' => true,
            'payment_amount' => $amountPaise,
            'description' => 'Print order '.$orderReference,
            'close_by' => $closeBy,
            'notes' => ['order_reference' => $orderReference],
        ]);
        if (! $res->successful() || ! is_string($res->json('id'))) {
            // Razorpay's own explanation goes to the log (it never contains keys) so the shop owner can see what to fix.
            throw new RuntimeException('The payment provider could not create a QR code: '.mb_substr((string) ($res->json('error.description') ?? 'HTTP '.$res->status()), 0, 200));
        }

        return [
            'provider_payment_id' => $res->json('id'),
            'qr_payload' => (string) $res->json('image_url'),
            'expires_at' => (int) ($res->json('close_by') ?: $closeBy),
        ];
    }

    public function createCheckout(string $orderReference, int $amountPaise, string $currency): array
    {
        if ($currency !== 'INR') {
            throw new RuntimeException('Razorpay Checkout is set up for INR only.');
        }
        $res = $this->http()->post('/orders', [
            'amount' => $amountPaise,
            'currency' => 'INR',
            'receipt' => substr($orderReference, 0, 40),
            'notes' => ['order_reference' => $orderReference],
        ]);
        if (! $res->successful() || ! is_string($res->json('id'))) {
            throw new RuntimeException('The payment provider could not create a checkout order.');
        }
        // The amount Razorpay stored must be the amount we asked for.
        if ((int) $res->json('amount') !== $amountPaise) {
            throw new RuntimeException('The payment provider returned a different amount.');
        }

        return ['provider_payment_id' => $res->json('id'), 'expires_at' => time() + $this->ttlSeconds];
    }

    public function checkoutKeyId(): string
    {
        return $this->keyId;
    }

    public function verifyCheckoutSignature(string $providerOrderId, string $providerPaymentId, string $signature): bool
    {
        return $signature !== '' && hash_equals(hash_hmac('sha256', $providerOrderId.'|'.$providerPaymentId, $this->keySecret), $signature);
    }

    public static function isCheckoutId(string $id): bool
    {
        return str_starts_with($id, 'order_');
    }

    /** Razorpay order JSON -> our status words. 'paid' is the only success; anything else is still open. */
    public static function mapOrder(array $o): array
    {
        $paid = ($o['status'] ?? '') === 'paid';

        return [
            'status' => $paid ? 'succeeded' : 'pending',
            'amount_paise' => (int) ($paid ? ($o['amount_paid'] ?? 0) : ($o['amount'] ?? 0)),
            'currency' => (string) ($o['currency'] ?? 'INR'),
            'order_reference' => (string) ($o['notes']['order_reference'] ?? ''),
        ];
    }

    public function fetchPayment(string $providerPaymentId): array
    {
        if (self::isCheckoutId($providerPaymentId)) {
            $res = $this->http()->get('/orders/'.rawurlencode($providerPaymentId));
            if (! $res->successful()) {
                throw new RuntimeException('The payment provider could not be reached.');
            }

            return self::mapOrder((array) $res->json());
        }
        $res = $this->http()->get('/payments/qr_codes/'.rawurlencode($providerPaymentId));
        if (! $res->successful()) {
            throw new RuntimeException('The payment provider could not be reached.');
        }
        $received = (int) $res->json('payments_amount_received', 0);
        $count = (int) $res->json('payments_count_received', 0);
        $status = (string) $res->json('status');
        $closeReason = (string) ($res->json('close_reason') ?? '');

        $mapped = 'pending';
        if ($count > 0 && $received > 0) {
            $mapped = 'succeeded';
        } elseif ($status === 'closed' && $closeReason !== 'paid') {
            $mapped = 'failed';
        }

        return [
            'status' => $mapped,
            'amount_paise' => $mapped === 'succeeded' ? $received : (int) $res->json('payment_amount', 0),
            'currency' => 'INR',
            'order_reference' => (string) ($res->json('notes.order_reference') ?? ''),
        ];
    }

    /** @return array{event_id:string,provider_payment_id:string}|null null when the signature is invalid or the event is irrelevant */
    public function parseWebhook(string $rawBody, ?string $signature, ?string $eventId): ?array
    {
        if ($this->webhookSecret === '' || ! is_string($signature) || $signature === '') {
            return null;
        }
        if (! hash_equals(hash_hmac('sha256', $rawBody, $this->webhookSecret), $signature)) {
            return null;
        }
        $event = json_decode($rawBody, true);
        // qr_code.credited -> the QR's id; order.paid / payment.captured -> the Checkout order's id. Only a hint: the real status is looked up.
        $id = $event['payload']['qr_code']['entity']['id']
            ?? $event['payload']['order']['entity']['id']
            ?? $event['payload']['payment']['entity']['order_id']
            ?? null;
        if (! is_string($id) || $id === '') {
            return null;
        }
        $eventId = $eventId ?: hash('sha256', $rawBody);

        return ['event_id' => $eventId, 'provider_payment_id' => $id];
    }

    private function http()
    {
        return Http::baseUrl(rtrim($this->baseUrl, '/'))
            ->withBasicAuth($this->keyId, $this->keySecret)
            ->acceptJson()->asJson()->timeout(15)->retry(2, 300, throw: false);
    }
}

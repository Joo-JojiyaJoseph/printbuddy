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
final class RazorpayProvider implements PaymentProvider
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

    public function createPayment(string $orderReference, int $amountPaise, string $currency): array
    {
        if ($currency !== 'INR') {
            throw new RuntimeException('Razorpay UPI QR codes only support INR.');
        }
        $closeBy = time() + $this->ttlSeconds;
        $res = $this->http()->post('/payments/qr_codes', [
            'type' => 'upi_qr',
            'name' => 'PrintBuddy '.$orderReference,
            'usage' => 'single_use',
            'fixed_amount' => true,
            'payment_amount' => $amountPaise,
            'description' => 'Print order '.$orderReference,
            'close_by' => $closeBy,
            'notes' => ['order_reference' => $orderReference],
        ]);
        if (! $res->successful() || ! is_string($res->json('id'))) {
            throw new RuntimeException('The payment provider could not create a QR code.');
        }

        return [
            'provider_payment_id' => $res->json('id'),
            'qr_payload' => (string) $res->json('image_url'),
            'expires_at' => (int) ($res->json('close_by') ?: $closeBy),
        ];
    }

    public function fetchPayment(string $providerPaymentId): array
    {
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
        $qrId = $event['payload']['qr_code']['entity']['id'] ?? null;
        if (! is_string($qrId)) {
            return null;
        }
        $eventId = $eventId ?: hash('sha256', $rawBody);

        return ['event_id' => $eventId, 'provider_payment_id' => $qrId];
    }

    private function http()
    {
        return Http::baseUrl(rtrim($this->baseUrl, '/'))
            ->withBasicAuth($this->keyId, $this->keySecret)
            ->acceptJson()->asJson()->timeout(15)->retry(2, 300, throw: false);
    }
}

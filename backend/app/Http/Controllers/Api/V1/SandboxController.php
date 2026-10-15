<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\QrSession;
use App\Services\Payments\EloquentPaymentStore;
use App\Services\Payments\FakeUpiProvider;
use App\Services\Payments\PaymentProcessor;
use App\Services\Payments\PaymentProvider;
use App\Services\Payments\PaymentStore;
use App\Services\Payments\WebhookSignature;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Sandbox-only controls (PAYMENT_PROVIDER=fake, never in production). They act on the FAKE PROVIDER —
 * "what the customer's bank did" — and then deliver a signed webhook exactly like a real provider would.
 * They never set an order's status directly, so the full verification path is exercised.
 */
class SandboxController extends Controller
{
    public function __construct(
        private readonly PaymentProvider $provider,
        private readonly PaymentProcessor $processor,
        private readonly PaymentStore $store,
    ) {}

    public function simulate(Request $request, string $reference): JsonResponse
    {
        $data = $request->validate([
            'outcome' => ['required', Rule::in(['succeeded', 'failed'])],
            'amount_paise' => ['nullable', 'integer', 'min:1'],
        ]);
        $payment = $this->openPayment($request, $reference);
        abort_unless($this->provider instanceof FakeUpiProvider, 404);

        $this->provider->simulate($payment->provider_payment_id, $data['outcome'], $data['amount_paise'] ?? null);

        $eventId = 'evt_'.Str::random(12);
        $body = json_encode(['event_id' => $eventId, 'provider_payment_id' => $payment->provider_payment_id, 'status' => $data['outcome']]);
        $secret = (string) config('printbuddy.payment.webhook_secret');
        if ($this->store instanceof EloquentPaymentStore) {
            $this->store->withEventPayload(json_decode($body, true));
        }
        $result = $secret !== ''
            ? $this->processor->handleWebhook($body, WebhookSignature::sign($body, time(), $secret), time(), time())
            : $this->processor->processEvent($eventId, $payment->provider_payment_id);

        return response()->json(['data' => ['result' => $result, 'event_id' => $eventId]]);
    }

    /** Make the current pending payment lapse so the expiry path can be exercised. */
    public function expire(Request $request, string $reference): JsonResponse
    {
        $payment = $this->openPayment($request, $reference);
        $payment->forceFill(['expires_at' => now()->subSecond()])->save();

        return response()->json(['data' => ['result' => 'expiring']]);
    }

    private function openPayment(Request $request, string $reference): Payment
    {
        /** @var QrSession $session */
        $session = $request->attributes->get('qr_session');
        $order = $session->orders()->where('reference', $reference)->firstOr(fn () => abort(404, 'Order not found.'));
        $payment = $order->payments()->latest()->first();
        abort_if($payment === null, 404, 'No payment to simulate.');

        return $payment;
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WebhookEvent;
use App\Services\Payments\EloquentPaymentStore;
use App\Services\Payments\PaymentProcessor;
use App\Services\Payments\PaymentProvider;
use App\Services\Payments\PaymentStore;
use App\Services\Payments\RazorpayProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * POST /webhooks/{provider}. The body is only a hint about WHICH payment to verify: the order is
 * marked paid solely on the strength of a server-side provider lookup (PaymentProcessor).
 * Unsigned, tampered or replayed deliveries are logged (without secrets) and rejected.
 */
class WebhookController extends Controller
{
    public function __construct(
        private readonly PaymentProcessor $processor,
        private readonly PaymentProvider $provider,
        private readonly PaymentStore $store,
    ) {}

    public function handle(Request $request, string $provider): JsonResponse
    {
        $configured = (string) config('printbuddy.payment.provider');
        if ($provider !== $configured) {
            return response()->json(['message' => 'Unknown provider.'], 404);
        }
        $raw = $request->getContent();
        $payload = json_decode($raw, true);
        $payload = is_array($payload) ? $payload : [];

        if ($this->store instanceof EloquentPaymentStore) {
            $this->store->withEventPayload($this->redact($payload));
        }

        if ($provider === 'razorpay' && $this->provider instanceof RazorpayProvider) {
            $parsed = $this->provider->parseWebhook($raw, $request->header('X-Razorpay-Signature'), $request->header('x-razorpay-event-id'));
            if ($parsed === null) {
                $this->rejected($provider, $payload, 'invalid_signature');

                return response()->json(['message' => 'Invalid signature.'], 401);
            }
            $result = $this->processor->processEvent($parsed['event_id'], $parsed['provider_payment_id']);
        } else {
            // Generic scheme (used by the sandbox provider): HMAC over "{timestamp}.{body}" with a replay window.
            $result = $this->processor->handleWebhook($raw, (string) $request->header('X-Signature', ''),
                (int) $request->header('X-Timestamp', '0'), time());
            if ($result === 'invalid_signature') {
                $this->rejected($provider, $payload, $result);

                return response()->json(['message' => 'Invalid signature.'], 401);
            }
        }

        if ($result === 'malformed') {
            return response()->json(['message' => 'Malformed event.'], 400);
        }
        $this->stampResult($provider, $payload, $result);

        // Always 200 for authenticated deliveries so the provider stops retrying; the result is for logs only.
        return response()->json(['received' => true, 'result' => $result]);
    }

    private function rejected(string $provider, array $payload, string $reason): void
    {
        Log::warning('Rejected payment webhook', ['provider' => $provider, 'reason' => $reason]);
        WebhookEvent::query()->create([
            'provider' => $provider,
            'event_id' => 'rejected_'.bin2hex(random_bytes(12)),
            'signature_valid' => false,
            'result' => $reason,
            'payload' => $this->redact($payload),
            'processed_at' => now(),
        ]);
    }

    private function stampResult(string $provider, array $payload, string $result): void
    {
        $eventId = $payload['event_id'] ?? null;
        if (is_string($eventId)) {
            WebhookEvent::query()->where('provider', $provider)->where('event_id', $eventId)->whereNull('result')->update(['result' => $result]);
        }
    }

    /** Strip anything that looks like a credential before persisting a payload for investigation. */
    private function redact(array $payload): array
    {
        array_walk_recursive($payload, function (&$v, $k) {
            if (is_string($k) && preg_match('/secret|token|signature|password|vpa|card/i', $k)) {
                $v = '[redacted]';
            }
        });

        return $payload;
    }
}

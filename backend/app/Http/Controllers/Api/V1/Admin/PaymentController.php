<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Admin\Concerns\PaginatesAndFilters;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\WebhookEvent;
use App\Services\Audit\AuditLogger;
use App\Services\Payments\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    use PaginatesAndFilters;

    public function index(Request $request): JsonResponse
    {
        $p = $this->listParams($request, ['created_at', 'amount_paise', 'status', 'verified_at'], [
            'status' => ['nullable', Rule::in([Payment::PENDING, Payment::SUCCEEDED, Payment::FAILED, Payment::EXPIRED])],
            'needs_review' => ['nullable', 'boolean'],
            'kiosk' => ['nullable', 'string', 'max:40'],
        ]);
        $q = Payment::query()->with(['order:id,reference,status,qr_session_id', 'order.session:id,kiosk_id', 'order.session.kiosk:id,code,name']);
        if (! empty($p['kiosk'])) {
            $q->whereHas('order.session.kiosk', fn ($k) => $k->where('code', $p['kiosk']));
        }
        if (! empty($p['status'])) {
            $q->where('status', $p['status']);
        }
        if (! empty($p['needs_review'])) {
            $q->whereNotNull('review_reason');
        }
        if (! empty($p['q'])) {
            $like = $this->like($p['q']);
            $q->where(fn ($w) => $w->where('provider_payment_id', 'like', $like)->orWhereHas('order', fn ($o) => $o->where('reference', 'like', $like)));
        }

        return response()->json($this->paginated($this->applyCommon($q, $p), $p, fn (Payment $x) => self::row($x)));
    }

    public function show(string $id): JsonResponse
    {
        $p = Payment::query()->with('order:id,reference,status,total_paise')->findOrFail($id);
        $events = WebhookEvent::query()->where('provider', $p->provider)
            ->where(fn ($w) => $w->where('payload->provider_payment_id', $p->provider_payment_id)
                ->orWhere('payload->payload->qr_code->entity->id', $p->provider_payment_id))
            ->latest()->limit(20)->get(['id', 'event_id', 'signature_valid', 'result', 'processed_at', 'created_at']);

        return response()->json(['data' => self::row($p) + ['webhook_events' => $events]]);
    }

    /**
     * Investigation tool: re-run the server-side provider verification. It can only ever apply what the
     * provider confirms — there is deliberately no endpoint to mark a payment paid by hand.
     */
    public function reconcile(string $id, PaymentService $payments, AuditLogger $audit): JsonResponse
    {
        $p = Payment::query()->findOrFail($id);
        $audit->log('payment.reconcile_requested', $p);
        $p = $payments->refresh($p);

        return response()->json(['data' => self::row($p->load('order:id,reference,status'))]);
    }

    public static function row(Payment $p): array
    {
        return [
            'id' => $p->id,
            'order_reference' => $p->order?->reference,
            'order_status' => $p->order?->status,
            'kiosk' => $p->order?->session?->kiosk?->code,
            'provider' => $p->provider,
            'provider_payment_id' => $p->provider_payment_id,
            'amount_paise' => $p->amount_paise,
            'currency' => $p->currency,
            'status' => $p->status,
            'review_reason' => $p->review_reason,
            'expires_at' => $p->expires_at?->toIso8601String(),
            'verified_at' => $p->verified_at?->toIso8601String(),
            'created_at' => $p->created_at?->toIso8601String(),
        ];
    }
}

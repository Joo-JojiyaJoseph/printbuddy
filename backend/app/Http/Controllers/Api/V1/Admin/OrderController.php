<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Admin\Concerns\PaginatesAndFilters;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PrintOrder;
use App\Services\Orders\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    use PaginatesAndFilters;

    public function index(Request $request): JsonResponse
    {
        $p = $this->listParams($request, ['created_at', 'total_paise', 'status', 'paid_at'], [
            'status' => ['nullable', Rule::in(PrintOrder::STATUSES)],
            'kiosk' => ['nullable', 'string', 'max:40'],
        ]);
        $q = PrintOrder::query()->with(['document:id,original_name,page_count,kind', 'session:id,kiosk_id', 'session.kiosk:id,code,name', 'latestPayment']);
        if (! empty($p['status'])) {
            $q->where('status', $p['status']);
        }
        if (! empty($p['kiosk'])) {
            $q->whereHas('session.kiosk', fn ($k) => $k->where('code', $p['kiosk']));
        }
        if (! empty($p['q'])) {
            $like = $this->like($p['q']);
            $q->where(fn ($w) => $w->where('reference', 'like', $like)->orWhereHas('document', fn ($d) => $d->where('original_name', 'like', $like)));
        }

        return response()->json($this->paginated($this->applyCommon($q, $p), $p, fn (PrintOrder $o) => $this->summary($o)));
    }

    public function show(string $reference): JsonResponse
    {
        $o = PrintOrder::query()->where('reference', $reference)
            ->with(['document', 'session.kiosk', 'payments' => fn ($q) => $q->latest()])->firstOrFail();

        return response()->json(['data' => $this->summary($o) + [
            'settings' => $o->print_settings,
            'pricing_snapshot' => $o->pricing_snapshot,
            'session' => ['id' => $o->session->id, 'status' => $o->session->displayStatus(), 'expires_at' => $o->session->expires_at->toIso8601String()],
            'document' => $o->document ? [
                'id' => $o->document->id, 'name' => $o->document->original_name, 'kind' => $o->document->kind,
                'page_count' => $o->document->page_count, 'size_bytes' => $o->document->size_bytes,
                'status' => $o->document->status, 'delete_after' => $o->document->delete_after?->toIso8601String(),
                'deleted_at' => $o->document->deleted_at?->toIso8601String(),
            ] : null,
            'payments' => $o->payments->map(fn (Payment $p) => PaymentController::row($p))->all(),
        ]]);
    }

    /** Operators may cancel an unpaid order (customer walked away). Paid orders are terminal. */
    public function cancel(string $reference, OrderService $orders): JsonResponse
    {
        $o = PrintOrder::query()->where('reference', $reference)->firstOrFail();
        $o = $orders->cancel($o, 'admin:'.auth()->id());

        return response()->json(['data' => $this->summary($o->load(['document', 'session.kiosk', 'latestPayment']))]);
    }

    private function summary(PrintOrder $o): array
    {
        return [
            'reference' => $o->reference,
            'status' => $o->status,
            'total_paise' => $o->total_paise,
            'currency' => $o->currency,
            'document_name' => $o->document?->original_name,
            'pages' => $o->pricing_snapshot['pages_selected'] ?? null,
            'copies' => $o->print_settings['copies'] ?? null,
            'kiosk' => $o->session?->kiosk?->code,
            'payment_status' => $o->latestPayment?->status,
            'paid_at' => $o->paid_at?->toIso8601String(),
            'created_at' => $o->created_at?->toIso8601String(),
        ];
    }
}

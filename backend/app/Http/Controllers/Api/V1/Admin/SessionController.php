<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Admin\Concerns\PaginatesAndFilters;
use App\Http\Controllers\Controller;
use App\Models\QrSession;
use App\Services\Sessions\QrSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SessionController extends Controller
{
    use PaginatesAndFilters;

    public function index(Request $request): JsonResponse
    {
        $p = $this->listParams($request, ['created_at', 'expires_at', 'status'], [
            'status' => ['nullable', Rule::in(['active', 'waiting', 'completed', 'expired', 'cancelled'])],
            'kiosk' => ['nullable', 'string', 'max:40'],
        ]);
        $q = QrSession::query()->with('kiosk:id,code,name')->withCount(['documents', 'orders']);
        if (! empty($p['status'])) {
            match ($p['status']) {
                'waiting' => $q->where('status', 'active')->whereNull('claimed_at')->where('expires_at', '>', now()),
                'active' => $q->where('status', 'active')->whereNotNull('claimed_at')->where('expires_at', '>', now()),
                'expired' => $q->where(fn ($w) => $w->where('status', 'expired')->orWhere(fn ($x) => $x->where('status', 'active')->where('expires_at', '<=', now()))),
                default => $q->where('status', $p['status']),
            };
        }
        if (! empty($p['kiosk'])) {
            $q->whereHas('kiosk', fn ($k) => $k->where('code', $p['kiosk']));
        }

        return response()->json($this->paginated($this->applyCommon($q, $p), $p, fn (QrSession $s) => $this->row($s)));
    }

    public function show(string $id): JsonResponse
    {
        $s = QrSession::query()->with(['kiosk:id,code,name', 'documents:id,qr_session_id,original_name,kind,status,page_count,size_bytes,delete_after', 'orders:id,qr_session_id,reference,status,total_paise,created_at'])
            ->withCount(['documents', 'orders'])->findOrFail($id);

        return response()->json(['data' => $this->row($s) + ['documents' => $s->documents, 'orders' => $s->orders]]);
    }

    public function revoke(string $id, QrSessionService $sessions): JsonResponse
    {
        $s = QrSession::query()->with('kiosk:id,code,name')->withCount(['documents', 'orders'])->findOrFail($id);
        $sessions->revoke($s, 'admin:'.auth()->id());

        return response()->json(['data' => $this->row($s->refresh())]);
    }

    private function row(QrSession $s): array
    {
        return [
            'id' => $s->id,
            'kiosk' => $s->kiosk?->code,
            'kiosk_name' => $s->kiosk?->name,
            'status' => $s->displayStatus(),
            'claimed_at' => $s->claimed_at?->toIso8601String(),
            'expires_at' => $s->expires_at->toIso8601String(),
            'documents_count' => $s->documents_count ?? null,
            'orders_count' => $s->orders_count ?? null,
            'created_at' => $s->created_at?->toIso8601String(),
        ];
    }
}

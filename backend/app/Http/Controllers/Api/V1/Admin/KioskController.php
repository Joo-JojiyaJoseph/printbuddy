<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Kiosk;
use App\Models\Payment;
use App\Models\PrintJob;
use App\Models\PrintOrder;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use App\Services\Printing\{AgentBundle, AgentKey};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** Kiosk screens: add one, rename it, switch it off. Admin role only to change. */
class KioskController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(): JsonResponse
    {
        $rows = Kiosk::query()->withCount(['sessions as sessions_today' => fn ($q) => $q->where('created_at', '>=', now()->startOfDay())])->orderBy('code')->get();

        $paid = PrintOrder::query()->join('qr_sessions', 'qr_sessions.id', '=', 'print_orders.qr_session_id')
            ->where('print_orders.status', 'paid')->groupBy('qr_sessions.kiosk_id')
            ->selectRaw('qr_sessions.kiosk_id as kid, count(*) as n, coalesce(sum(print_orders.total_paise), 0) as revenue')->get()->keyBy('kid');

        return response()->json(['data' => $rows->map(fn (Kiosk $k) => $this->row($k) + [
            'paid_orders' => (int) ($paid[$k->id]->n ?? 0), 'revenue_paise' => (int) ($paid[$k->id]->revenue ?? 0),
        ])->all()]);
    }

    /** GET /admin/kiosks/{code} — everything about one kiosk: totals, print health, and its latest orders and payments. */
    public function show(string $code): JsonResponse
    {
        $k = Kiosk::query()->withCount(['sessions as sessions_today' => fn ($q) => $q->where('created_at', '>=', now()->startOfDay())])->whereRaw('lower(code) = ?', [mb_strtolower($code)])->firstOrFail();
        $orders = fn () => PrintOrder::query()->whereHas('session', fn ($s) => $s->where('kiosk_id', $k->id));
        $paidOrders = fn () => $orders()->where('status', 'paid');
        $byStatus = $orders()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
        $jobs = fn () => PrintJob::query()->whereHas('order.session', fn ($s) => $s->where('kiosk_id', $k->id));
        $with = ['document:id,original_name,page_count,kind', 'session:id,kiosk_id', 'session.kiosk:id,code,name', 'latestPayment', 'printJob'];

        return response()->json(['data' => $this->row($k) + [
            'stats' => [
                'sessions_total' => $k->sessions()->count(),
                'orders_by_status' => $byStatus,
                'orders_total' => (int) $byStatus->sum(),
                'paid_orders' => $paidOrders()->count(),
                'revenue_total_paise' => (int) $paidOrders()->sum('total_paise'),
                'revenue_today_paise' => (int) $paidOrders()->where('paid_at', '>=', now()->startOfDay())->sum('total_paise'),
                'revenue_7d_paise' => (int) $paidOrders()->where('paid_at', '>=', now()->subDays(7))->sum('total_paise'),
                'printed' => $jobs()->where('status', PrintJob::SENT)->count(),
                'print_failed' => $jobs()->where('status', PrintJob::FAILED)->count(),
                'print_in_progress' => $jobs()->whereIn('status', PrintJob::IN_FLIGHT)->count(),
                'last_order_at' => $orders()->max('created_at'),
            ],
            'recent_orders' => $orders()->with($with)->latest()->limit(10)->get()->map(fn (PrintOrder $o) => OrderController::summary($o))->all(),
            'recent_payments' => Payment::query()->whereHas('order.session', fn ($s) => $s->where('kiosk_id', $k->id))
                ->with(['order:id,reference,status,qr_session_id', 'order.session:id,kiosk_id', 'order.session.kiosk:id,code,name'])->latest()->limit(10)->get()->map(fn (Payment $p) => PaymentController::row($p))->all(),
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate([
            'code' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/', 'unique:kiosks,code'],
            'name' => ['required', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:160'],
        ]);
        $k = Kiosk::query()->create($d + ['active' => true]);
        $this->audit->log('kiosk.created', $k);

        return response()->json(['data' => $this->row($k)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $k = Kiosk::query()->findOrFail($id);
        $d = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'location' => ['sometimes', 'nullable', 'string', 'max:160'],
            'active' => ['sometimes', 'boolean'],
        ]);
        $k->update($d);
        $this->audit->log('kiosk.updated', $k, ['fields' => array_keys($d)]);

        return response()->json(['data' => $this->row($k)]);
    }

    /** POST /admin/kiosks/{id}/agent-key — a key for the print program on this kiosk's own PC (shown once). */
    public function agentKey(string $id): JsonResponse
    {
        $k = Kiosk::query()->findOrFail($id);
        $key = AgentKey::generate();
        $k->forceFill(['agent_key_hash' => AgentKey::hash($key)])->save();
        $this->audit->log('kiosk.agent_key_created', $k);

        return response()->json(['data' => ['key' => $key]]);
    }

    /**
     * POST /admin/kiosks/{id}/agent-setup — makes a new print key for this kiosk and returns a zip with the print program and a
     * config.json that already contains the key and this server's address. The previous key for this kiosk stops working.
     */
    public function agentSetup(Request $request, string $id)
    {
        $k = Kiosk::query()->findOrFail($id);
        $key = AgentKey::generate();
        try {
            $zip = (new AgentBundle(resource_path('print-agent')))->build($request->getSchemeAndHttpHost(), $key, is_string($request->input('screen_url')) ? $request->input('screen_url') : null);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
        $k->forceFill(['agent_key_hash' => AgentKey::hash($key)])->save(); // only after the package was built
        $this->audit->log('kiosk.agent_setup_downloaded', $k);
        $name = 'taprint-print-agent-'.preg_replace('/[^A-Za-z0-9_-]/', '', (string) $k->code).'.zip';

        return response()->download($zip, $name, ['Content-Type' => 'application/zip', 'Cache-Control' => 'no-store'])->deleteFileAfterSend(true);
    }

    private function row(Kiosk $k): array
    {
        return ['id' => $k->id, 'code' => $k->code, 'name' => $k->name, 'location' => $k->location, 'active' => $k->active,
            'sessions_today' => $k->sessions_today ?? 0,
            'agent' => $this->agent($k), 'url' => '/k/'.rawurlencode((string) $k->code)]; // path only: the admin page adds the address it is open on, so it never shows localhost
    }

    private function agent(Kiosk $k): array
    {
        $seen = Cache::get('agent.seen.'.$k->id);
        $at = $seen ? \Illuminate\Support\Carbon::parse($seen) : null;

        return ['key_set' => (string) $k->agent_key_hash !== '', 'last_seen' => $at?->toIso8601String(), 'online' => $at !== null && $at->gt(now()->subSeconds(30))];
    }
}

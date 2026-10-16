<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Kiosk;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Kiosk screens: add one, rename it, switch it off. Admin role only to change. */
class KioskController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(): JsonResponse
    {
        $rows = Kiosk::query()->withCount(['sessions as sessions_today' => fn ($q) => $q->where('created_at', '>=', now()->startOfDay())])->orderBy('code')->get();

        return response()->json(['data' => $rows->map(fn (Kiosk $k) => $this->row($k))->all()]);
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

    private function row(Kiosk $k): array
    {
        return ['id' => $k->id, 'code' => $k->code, 'name' => $k->name, 'location' => $k->location, 'active' => $k->active,
            'sessions_today' => $k->sessions_today ?? 0, 'url' => rtrim((string) config('printbuddy.frontend_url'), '/').'/kiosk?k='.$k->code];
    }
}

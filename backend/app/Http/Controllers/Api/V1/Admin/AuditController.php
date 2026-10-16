<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Admin\Concerns\PaginatesAndFilters;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only activity log (who changed what). Meta never holds secrets (AuditLogger strips them). */
class AuditController extends Controller
{
    use PaginatesAndFilters;

    public function index(Request $request): JsonResponse
    {
        $p = $this->listParams($request, ['created_at', 'action']);
        $q = AuditLog::query()->with('user:id,name');
        if (! empty($p['q'])) {
            $q->where('action', 'like', $this->like($p['q']));
        }

        return response()->json($this->paginated($this->applyCommon($q, $p), $p, fn (AuditLog $a) => [
            'id' => $a->id, 'action' => $a->action, 'subject' => $a->subject_type, 'subject_id' => $a->subject_id,
            'user' => $a->user?->name, 'meta' => $a->meta, 'created_at' => $a->created_at?->toIso8601String(),
        ]));
    }
}

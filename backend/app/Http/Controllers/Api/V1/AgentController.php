<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PrintJob;
use App\Models\QrSession;
use App\Services\Printing\PrintJobService;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** What the shop PC print program calls: ask for the next paid job, download its PDF, report the result. */
class AgentController extends Controller
{
    public function __construct(private readonly PrintJobService $jobs, private readonly Settings $settings) {}

    /** A kiosk key only sees orders that were started at that kiosk. */
    private function scoped(Request $request): Builder
    {
        $q = PrintJob::query();
        $kiosk = $request->attributes->get('agent_kiosk_id');
        if ($kiosk !== null) {
            $q->whereHas('order', fn ($o) => $o->whereIn('qr_session_id', QrSession::query()->where('kiosk_id', $kiosk)->select('id')));
        }

        return $q;
    }

    public function ping(): JsonResponse
    {
        return response()->json(['data' => ['ok' => true]]);
    }

    /** Claims the oldest waiting job (so two copies of the program can never print the same order). */
    public function next(Request $request): JsonResponse|\Illuminate\Http\Response
    {
        $job = DB::transaction(function () use ($request) {
            $q = $this->scoped($request)->where('status', PrintJob::WAITING)->whereNotNull('agent_meta');
            if ((int) $request->header('X-Agent-Version', 1) < 2) { // an old program would print the customer's unedited file, so it only gets finished files
                $q->where(fn ($w) => $w->where('agent_meta->phase', 'print')->orWhereNull('agent_meta->phase'));
            }
            $job = $q->orderBy('updated_at')->lockForUpdate()->first();
            $job?->forceFill(['status' => PrintJob::SENDING, 'claimed_at' => now()])->save();

            return $job;
        });
        if ($job === null) {
            return response()->noContent();
        }

        return response()->json(['data' => ['id' => $job->id, 'pages' => $job->pages] + (array) $job->agent_meta]); // the printer is chosen on each shop PC, never here
    }

    /** The PDF to print, or (while the shop PC is asked to render pages) the customer's source PDF. */
    public function file(Request $request, string $id): StreamedResponse|JsonResponse|\Illuminate\Http\Response
    {
        $job = $this->scoped($request)->whereKey($id)->where('status', PrintJob::SENDING)->whereNotNull('claimed_at')->first();
        $disk = Storage::disk(config('printbuddy.documents_disk'));
        if ($job !== null && ($job->agent_meta['phase'] ?? '') === 'render') {
            $src = $this->jobs->renderSource($job);
            if ($src !== null) {
                return response()->file($src, ['Content-Type' => 'application/pdf', 'Cache-Control' => 'no-store']);
            }
        } elseif ($job !== null && $job->agent_file && $disk->exists($job->agent_file)) {
            return $disk->response($job->agent_file, 'job.pdf', ['Content-Type' => 'application/pdf', 'Cache-Control' => 'no-store']);
        }

        return response()->json(['message' => 'That print file is not available.'], 404);
    }

    /** PUT /agent/jobs/{id}/pages/{n} — one rendered page picture (JPEG) from the shop PC. */
    public function page(Request $request, string $id, int $n): JsonResponse
    {
        $job = $this->scoped($request)->whereKey($id)->where('status', PrintJob::SENDING)->whereNotNull('claimed_at')->first();
        $meta = (array) ($job?->agent_meta ?? []);
        if ($job === null || ($meta['phase'] ?? '') !== 'render' || ! in_array($n, array_map('intval', (array) ($meta['render_pages'] ?? [])), true)) {
            return response()->json(['message' => 'That page was not requested.'], 409);
        }
        $body = $request->getContent();
        if ($body === '' || strlen($body) > 40 * 1024 * 1024 || ! str_starts_with($body, "\xFF\xD8\xFF")) {
            return response()->json(['message' => 'The page picture must be a JPEG of at most 40 MB.'], 422);
        }
        Storage::disk(config('printbuddy.documents_disk'))->put('agent-spool/'.$job->id.'/p'.$n.'.jpg', $body);
        $job->touch(); // progress: keeps a long render from being treated as stuck

        return response()->json(['data' => ['ok' => true]]);
    }

    public function result(Request $request, string $id): JsonResponse
    {
        $d = $request->validate(['ok' => ['required', 'boolean'], 'message' => ['nullable', 'string', 'max:300'], 'printer_job_id' => ['nullable', 'string', 'max:100']]);
        $job = $this->scoped($request)->whereKey($id)->where('status', PrintJob::SENDING)->whereNotNull('claimed_at')->first();
        if ($job === null) {
            return response()->json(['message' => 'That job is not waiting for a result.'], 409);
        }
        if ((($job->agent_meta['phase'] ?? 'print') === 'render') && (bool) $d['ok']) {
            $this->jobs->renderFinished($job); // composes the final file; the job then waits to be printed
        } else {
            $this->jobs->agentFinished($job, (bool) $d['ok'], $d['printer_job_id'] ?? null, $d['message'] ?? null);
        }

        return response()->json(['data' => ['ok' => true]]);
    }
}

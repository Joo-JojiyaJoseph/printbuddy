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
            $job = $this->scoped($request)->where('status', PrintJob::WAITING)->whereNotNull('agent_file')->orderBy('updated_at')->lockForUpdate()->first();
            $job?->forceFill(['status' => PrintJob::SENDING, 'claimed_at' => now()])->save();

            return $job;
        });
        if ($job === null) {
            return response()->noContent();
        }

        return response()->json(['data' => ['id' => $job->id, 'pages' => $job->pages] + (array) $job->agent_meta]); // the printer is chosen on each shop PC, never here
    }

    public function file(Request $request, string $id): StreamedResponse|JsonResponse
    {
        $job = $this->scoped($request)->whereKey($id)->where('status', PrintJob::SENDING)->whereNotNull('claimed_at')->first();
        $disk = Storage::disk(config('printbuddy.documents_disk'));
        if ($job === null || ! $job->agent_file || ! $disk->exists($job->agent_file)) {
            return response()->json(['message' => 'That print file is not available.'], 404);
        }

        return $disk->response($job->agent_file, 'job.pdf', ['Content-Type' => 'application/pdf', 'Cache-Control' => 'no-store']);
    }

    public function result(Request $request, string $id): JsonResponse
    {
        $d = $request->validate(['ok' => ['required', 'boolean'], 'message' => ['nullable', 'string', 'max:300'], 'printer_job_id' => ['nullable', 'string', 'max:100']]);
        $job = $this->scoped($request)->whereKey($id)->where('status', PrintJob::SENDING)->whereNotNull('claimed_at')->first();
        if ($job === null) {
            return response()->json(['message' => 'That job is not waiting for a result.'], 409);
        }
        $this->jobs->agentFinished($job, (bool) $d['ok'], $d['printer_job_id'] ?? null, $d['message'] ?? null);

        return response()->json(['data' => ['ok' => true]]);
    }
}

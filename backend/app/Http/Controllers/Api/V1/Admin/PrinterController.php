<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\PrintJob;
use App\Services\Audit\AuditLogger;
use App\Services\Printing\{AgentKey, PrinterDriver, PrinterInspector, PrintException, PrintTestPage, ShellRunner};
use App\Support\Integrations;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** Printer connection: what is configured, what the computer can see, choose a printer, send a test page. */
class PrinterController extends Controller
{
    public function __construct(private readonly Settings $settings, private readonly AuditLogger $audit) {}

    public function show(PrinterDriver $driver): JsonResponse
    {
        return response()->json(['data' => $this->payload($driver)]);
    }

    /** PUT /admin/printer — choose the printer by name (empty = system default / .env value). */
    public function update(Request $request, PrinterDriver $driver): JsonResponse
    {
        $data = $request->validate(['printer_name' => ['present', 'nullable', 'string', 'max:120']]);
        $name = trim((string) ($data['printer_name'] ?? ''));
        if (! PrinterInspector::validName($name)) {
            return response()->json(['message' => 'That printer name contains characters that are not allowed.', 'errors' => ['printer_name' => ['Invalid printer name.']]], 422);
        }
        $before = (string) $this->settings->get('printer_name', '');
        $this->settings->put(['printer_name' => $name]);
        $this->audit->log('printer.selected', 'Printer', ['before' => $before, 'after' => $name]);
        // The driver singleton was built with the old name in this request; report the new choice.
        return response()->json(['data' => ['selected' => $name !== '' ? $name : (string) app(Integrations::class)->printing()['printer']] + $this->payload($driver)]);
    }

    /** POST /admin/printer/test — prints one test page. Uses the same driver and printer as real orders. */
    public function test(PrinterDriver $driver): JsonResponse
    {
        $printer = $this->effectivePrinter();
        $path = tempnam(sys_get_temp_dir(), 'tpt').'.pdf';
        try {
            PrintTestPage::write($path, $driver->name(), $printer);
            $id = $driver->send($path, ['reference' => 'TEST', 'title' => 'Taprint test page', 'copies' => 1, 'color' => false, 'duplex' => false, 'landscape' => false, 'paper' => 'A4', 'direct' => true]);
        } catch (PrintException $e) {
            $this->audit->log('printer.test_failed', 'Printer', ['driver' => $driver->name()]);

            return response()->json(['message' => $e->getMessage(), 'data' => ['ok' => false]], 502);
        } finally {
            @unlink($path);
        }
        $this->audit->log('printer.test_sent', 'Printer', ['driver' => $driver->name(), 'printer' => $printer]);

        return response()->json(['data' => ['ok' => true, 'job_id' => $id, 'driver' => $driver->name(), 'note' => $driver->name() === 'file' ? 'Development driver: the PDF was saved to a folder, nothing was printed.' : 'The print system accepted the page. Check the printer for paper.']]);
    }

    private function effectivePrinter(): string
    {
        $chosen = trim((string) $this->settings->get('printer_name', ''));

        return $chosen !== '' ? $chosen : (string) app(Integrations::class)->printing()['printer'];
    }

    private function agent(): array
    {
        $seen = Cache::get('agent.last_seen');
        $at = $seen ? \Illuminate\Support\Carbon::parse($seen) : null;

        return [
            'key_set' => (string) $this->settings->get('agent_key_hash', '') !== '',
            'last_seen' => $at?->toIso8601String(),
            'online' => $at !== null && $at->gt(now()->subSeconds(30)),
            'waiting' => PrintJob::query()->where('status', PrintJob::WAITING)->count(),
        ];
    }

    private function payload(PrinterDriver $driver): array
    {
        $c = app(Integrations::class)->printing();
        $installed = (new PrinterInspector())->installed();
        $effective = $this->effectivePrinter();
        $poppler = ShellRunner::find((string) $c['pdftoppm_path'], 'pdftoppm') !== null;
        $jobs = PrintJob::query()->where('created_at', '>=', now()->subDay());

        return [
            'driver' => $driver->name(),
            'driver_available' => $driver->available(),
            'production_ready' => $driver->name() !== 'file',
            'printer' => $effective !== '' ? $effective : null,
            'printer_from' => trim((string) $this->settings->get('printer_name', '')) !== '' ? 'admin' : ((string) $c['printer'] !== '' ? 'env' : 'default'),
            'installed_printers' => $installed['names'],
            'installed_error' => $installed['error'],
            'printer_found' => $effective === '' || in_array($effective, $installed['names'], true),
            'poppler_available' => $poppler,
            'agent' => $this->agent(),
            'jobs_24h' => [
                'sent' => (clone $jobs)->where('status', PrintJob::SENT)->count(),
                'failed' => (clone $jobs)->where('status', PrintJob::FAILED)->count(),
                'in_progress' => (clone $jobs)->whereIn('status', PrintJob::IN_FLIGHT)->count(),
            ],
            'recent_failures' => PrintJob::query()->where('status', PrintJob::FAILED)->latest()->limit(5)->with('order:id,reference')
                ->get()->map(fn (PrintJob $j) => ['reference' => $j->order?->reference, 'reason' => $j->failure_reason, 'at' => $j->updated_at?->toIso8601String()])->all(),
            'scanner' => [
                'hardware_supported' => false,
                'note' => 'Customers scan with their phone camera (uploaded as a photo). A USB/network scanner needs a small local agent and is not part of this build.',
            ],
        ];
    }
}

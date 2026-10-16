<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\PrintOrder;
use App\Services\Audit\AuditLogger;
use App\Services\Reports\{Csv, ReportBuilder};
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    private const MAX_ROWS = 50000;

    public function sales(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);
        $rows = $this->paidRows($from, $to)->map(fn (PrintOrder $o) => [
            'date' => $o->paid_at->timezone(config('app.timezone'))->format('Y-m-d'),
            'total' => $o->total_paise,
            'sides' => (int) ($o->pricing_snapshot['billable_sides'] ?? 0),
            'paper' => $o->print_settings['paper_size'] ?? null,
            'color' => $o->print_settings['color_mode'] ?? null,
            'kiosk' => $o->session?->kiosk?->code,
        ])->all();

        return response()->json(['data' => ReportBuilder::summarize($rows, $from, $to)]);
    }

    /** GET /admin/reports/orders.csv — one row per paid order, for accounting. */
    public function ordersCsv(Request $request, AuditLogger $audit): StreamedResponse
    {
        [$from, $to] = $this->range($request);
        $audit->log('report.exported', 'Report', ['from' => $from, 'to' => $to]);
        $orders = $this->paidRows($from, $to);

        return response()->streamDownload(function () use ($orders) {
            echo "\xEF\xBB\xBF".Csv::row(['Reference', 'Paid at', 'Kiosk', 'Document', 'Pages', 'Copies', 'Paper', 'Colour', 'Duplex', 'Total (INR)', 'Print status']);
            foreach ($orders as $o) {
                echo Csv::row([
                    $o->reference, $o->paid_at?->toDateTimeString(), $o->session?->kiosk?->code, $o->document?->original_name,
                    $o->pricing_snapshot['pages_selected'] ?? '', $o->print_settings['copies'] ?? '', $o->print_settings['paper_size'] ?? '',
                    $o->print_settings['color_mode'] ?? '', ! empty($o->print_settings['duplex']) ? 'yes' : 'no',
                    number_format($o->total_paise / 100, 2, '.', ''), $o->printJob?->status,
                ]);
            }
        }, "taprint-orders-{$from}-to-{$to}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return array{0:string,1:string} */
    private function range(Request $request): array
    {
        $d = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $to = isset($d['to']) ? \Carbon\Carbon::parse($d['to'])->toDateString() : now()->toDateString();
        $from = isset($d['from']) ? \Carbon\Carbon::parse($d['from'])->toDateString() : \Carbon\Carbon::parse($to)->subDays(29)->toDateString();
        try {
            ReportBuilder::summarize([], $from, $to);
        } catch (\InvalidArgumentException $e) {
            abort(response()->json(['message' => $e->getMessage()], 422));
        }

        return [$from, $to];
    }

    private function paidRows(string $from, string $to)
    {
        return PrintOrder::query()->where('status', 'paid')
            ->whereBetween('paid_at', [\Carbon\Carbon::parse($from)->startOfDay(), \Carbon\Carbon::parse($to)->endOfDay()])
            ->with(['session.kiosk:id,code', 'document:id,original_name', 'printJob:id,print_order_id,status'])
            ->orderBy('paid_at')->limit(self::MAX_ROWS)->get();
    }
}

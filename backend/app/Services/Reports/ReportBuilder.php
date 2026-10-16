<?php

namespace App\Services\Reports;

/**
 * Turns paid-order rows into report figures. Pure (no database), so it is unit tested directly.
 * Row: ['date'=>'Y-m-d','total'=>int paise,'sides'=>int,'paper'=>string,'color'=>'bw'|'color','kiosk'=>string].
 */
final class ReportBuilder
{
    public const MAX_DAYS = 366;

    /** @param array<int,array<string,mixed>> $rows */
    public static function summarize(array $rows, string $from, string $to): array
    {
        $start = new \DateTimeImmutable($from);
        $end = new \DateTimeImmutable($to);
        if ($end < $start) {
            throw new \InvalidArgumentException('The end date is before the start date.');
        }
        if ($start->diff($end)->days >= self::MAX_DAYS) {
            throw new \InvalidArgumentException('Choose a range of at most '.self::MAX_DAYS.' days.');
        }

        $daily = [];
        for ($d = $start; $d <= $end; $d = $d->modify('+1 day')) {
            $daily[$d->format('Y-m-d')] = ['date' => $d->format('Y-m-d'), 'orders' => 0, 'revenue_paise' => 0];
        }
        $group = ['paper' => [], 'color' => [], 'kiosk' => []];
        $orders = $revenue = $sides = 0;

        foreach ($rows as $r) {
            $total = (int) $r['total'];
            $orders++;
            $revenue += $total;
            $sides += (int) ($r['sides'] ?? 0);
            if (isset($daily[$r['date']])) {
                $daily[$r['date']]['orders']++;
                $daily[$r['date']]['revenue_paise'] += $total;
            }
            foreach (['paper' => 'paper', 'color' => 'color', 'kiosk' => 'kiosk'] as $g => $k) {
                $key = (string) ($r[$k] ?? '') !== '' ? (string) $r[$k] : 'unknown';
                $group[$g][$key] ??= ['key' => $key, 'orders' => 0, 'revenue_paise' => 0];
                $group[$g][$key]['orders']++;
                $group[$g][$key]['revenue_paise'] += $total;
            }
        }
        $rank = function (array $g): array {
            $g = array_values($g);
            usort($g, fn ($a, $b) => [$b['revenue_paise'], $a['key']] <=> [$a['revenue_paise'], $b['key']]);

            return $g;
        };

        return [
            'from' => $start->format('Y-m-d'),
            'to' => $end->format('Y-m-d'),
            'totals' => [
                'orders' => $orders,
                'revenue_paise' => $revenue,
                'billable_sides' => $sides,
                'average_order_paise' => $orders > 0 ? intdiv($revenue, $orders) : 0,
            ],
            'daily' => array_values($daily),
            'by_paper' => $rank($group['paper']),
            'by_color' => $rank($group['color']),
            'by_kiosk' => $rank($group['kiosk']),
        ];
    }
}

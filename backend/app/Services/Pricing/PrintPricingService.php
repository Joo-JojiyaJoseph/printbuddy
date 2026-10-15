<?php

namespace App\Services\Pricing;

use InvalidArgumentException;

/**
 * Authoritative price calculation. All money is integer paise.
 *
 * Pricing model (explicit, to avoid double counting):
 *  - The base rate is charged PER PRINTED SIDE (one page image = one side).
 *  - Duplex does not change the number of sides; it lowers the per-side rate by
 *    `duplex_discount_bps` (basis points) and reduces the physical sheet count (shown only).
 *  - Service fee is a flat per-order amount. Tax is applied to (subtotal + fee), rounded half up.
 *
 * $rules = [
 *   'rates' => [['paper_size'=>'A4','color_mode'=>'bw','per_side_paise'=>200], ...],
 *   'duplex_discount_bps' => 1000, 'service_fee_paise' => 0, 'tax_bps' => 0,
 * ]
 */
final class PrintPricingService
{
    public const MAX_COPIES = 100;
    public const COLOR_MODES = ['bw', 'color'];

    public function __construct(private readonly array $rules) {}

    public function quote(int $pageCount, string $pageRange, int $copies, string $paperSize, string $colorMode, bool $duplex): array
    {
        if ($copies < 1 || $copies > self::MAX_COPIES) {
            throw new InvalidArgumentException('Copies must be between 1 and ' . self::MAX_COPIES . '.');
        }
        if (!in_array($colorMode, self::COLOR_MODES, true)) {
            throw new InvalidArgumentException('Unsupported colour mode.');
        }
        $rate = $this->rateFor($paperSize, $colorMode);
        $pages = count(PageRange::parse($pageRange, $pageCount));

        $discountBps = $duplex ? (int) ($this->rules['duplex_discount_bps'] ?? 0) : 0;
        $effectiveRate = $rate - intdiv($rate * $discountBps + 5000, 10000);

        $sides = $pages * $copies;
        $sheets = ($duplex ? intdiv($pages + 1, 2) : $pages) * $copies;
        $subtotal = $sides * $effectiveRate;
        $fee = (int) ($this->rules['service_fee_paise'] ?? 0);
        $taxBps = (int) ($this->rules['tax_bps'] ?? 0);
        $tax = intdiv(($subtotal + $fee) * $taxBps + 5000, 10000);

        return [
            'currency' => 'INR',
            'pages_selected' => $pages,
            'copies' => $copies,
            'billable_sides' => $sides,
            'sheets' => $sheets,
            'per_side_rate_paise' => $rate,
            'effective_per_side_rate_paise' => $effectiveRate,
            'subtotal_paise' => $subtotal,
            'service_fee_paise' => $fee,
            'tax_bps' => $taxBps,
            'tax_paise' => $tax,
            'total_paise' => $subtotal + $fee + $tax,
            'rules_snapshot' => $this->rules, // stored with the order; later rate changes never alter it
        ];
    }

    private function rateFor(string $paperSize, string $colorMode): int
    {
        foreach ($this->rules['rates'] ?? [] as $r) {
            if ($r['paper_size'] === $paperSize && $r['color_mode'] === $colorMode) {
                return (int) $r['per_side_paise'];
            }
        }
        throw new InvalidArgumentException("No pricing rule for {$paperSize}/{$colorMode}.");
    }
}

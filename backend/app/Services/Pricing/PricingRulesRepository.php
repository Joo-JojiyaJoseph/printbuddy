<?php

namespace App\Services\Pricing;

use App\Models\PricingRule;
use App\Support\Settings;
use Illuminate\Support\Facades\Cache;

/** Assembles the rules array consumed by PrintPricingService from pricing_rules + settings. */
class PricingRulesRepository
{
    private const CACHE_KEY = 'printbuddy.pricing_rules';

    /** Used only for a paper size/colour that has no row in pricing_rules, so a fresh database still prices every option. */
    public const DEFAULT_RATES = [
        ['paper_size' => 'A4', 'color_mode' => 'bw', 'per_side_paise' => 200],
        ['paper_size' => 'A4', 'color_mode' => 'color', 'per_side_paise' => 800],
        ['paper_size' => 'A5', 'color_mode' => 'bw', 'per_side_paise' => 150],
        ['paper_size' => 'A5', 'color_mode' => 'color', 'per_side_paise' => 600],
        ['paper_size' => 'Letter', 'color_mode' => 'bw', 'per_side_paise' => 200],
        ['paper_size' => 'Letter', 'color_mode' => 'color', 'per_side_paise' => 800],
    ];

    public function __construct(private readonly Settings $settings) {}

    public function rules(): array
    {
        // One cached read per request path: active rates plus the switched-off combinations (no query per quote).
        $cached = Cache::rememberForever(self::CACHE_KEY.'.v2', function () {
            $all = PricingRule::query()->orderBy('paper_size')->orderBy('color_mode')
                ->get(['paper_size', 'color_mode', 'per_side_paise', 'active']);

            return [
                'rates' => $all->where('active', true)->map(fn (PricingRule $r) => [
                    'paper_size' => $r->paper_size,
                    'color_mode' => $r->color_mode,
                    'per_side_paise' => $r->per_side_paise,
                ])->values()->all(),
                'inactive' => $all->where('active', false)->map(fn ($r) => $r->paper_size.'/'.$r->color_mode)->values()->all(),
            ];
        });
        $rates = $cached['rates'];
        $inactive = $cached['inactive'];

        // Fill gaps from the defaults. A rate the admin has switched off (a row with active=false) stays unavailable.
        $have = array_map(fn ($r) => $r['paper_size'].'/'.$r['color_mode'], $rates);
        foreach (self::DEFAULT_RATES as $d) {
            $k = $d['paper_size'].'/'.$d['color_mode'];
            if (! in_array($k, $have, true) && ! in_array($k, $inactive, true)) {
                $rates[] = $d;
            }
        }

        return [
            'rates' => $rates,
            'duplex_discount_bps' => $this->settings->int('duplex_discount_bps'),
            'service_fee_paise' => $this->settings->int('service_fee_paise'),
            'tax_bps' => $this->settings->int('tax_bps'),
        ];
    }

    public function service(): PrintPricingService
    {
        return new PrintPricingService($this->rules());
    }

    /** @param list<array{paper_size:string,color_mode:string,per_side_paise:int,active?:bool}> $rates */
    public function replaceRates(array $rates): void
    {
        foreach ($rates as $rate) {
            PricingRule::query()->updateOrCreate(
                ['paper_size' => $rate['paper_size'], 'color_mode' => $rate['color_mode']],
                ['per_side_paise' => (int) $rate['per_side_paise'], 'active' => $rate['active'] ?? true],
            );
        }
        $this->forget();
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::CACHE_KEY.'.v2');
    }
}

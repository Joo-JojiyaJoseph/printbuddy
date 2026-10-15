<?php

namespace App\Services\Pricing;

use App\Models\PricingRule;
use App\Support\Settings;
use Illuminate\Support\Facades\Cache;

/** Assembles the rules array consumed by PrintPricingService from pricing_rules + settings. */
class PricingRulesRepository
{
    private const CACHE_KEY = 'printbuddy.pricing_rules';

    public function __construct(private readonly Settings $settings) {}

    public function rules(): array
    {
        $rates = Cache::rememberForever(self::CACHE_KEY, fn () => PricingRule::query()
            ->where('active', true)
            ->orderBy('paper_size')->orderBy('color_mode')
            ->get(['paper_size', 'color_mode', 'per_side_paise'])
            ->map(fn (PricingRule $r) => [
                'paper_size' => $r->paper_size,
                'color_mode' => $r->color_mode,
                'per_side_paise' => $r->per_side_paise,
            ])->all());

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
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\PricingRule;
use App\Services\Audit\AuditLogger;
use App\Services\Pricing\PricingRulesRepository;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PricingController extends Controller
{
    public function __construct(
        private readonly PricingRulesRepository $pricing,
        private readonly Settings $settings,
        private readonly AuditLogger $audit,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->payload()]);
    }

    /** PUT /admin/pricing — admins only (enforced by the `can:admin.manage` middleware). Audit logged. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rates' => ['required', 'array', 'min:1'],
            'rates.*.paper_size' => ['required', 'string', 'max:20', Rule::in((array) $this->settings->get('paper_sizes'))],
            'rates.*.color_mode' => ['required', Rule::in(['bw', 'color'])],
            'rates.*.per_side_paise' => ['required', 'integer', 'min:1', 'max:1000000'],
            'rates.*.active' => ['nullable', 'boolean'],
            'duplex_discount_bps' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'service_fee_paise' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'tax_bps' => ['nullable', 'integer', 'min:0', 'max:10000'],
        ]);
        $before = $this->payload();

        $this->pricing->replaceRates($data['rates']);
        $this->settings->put(array_intersect_key($data, array_flip(['duplex_discount_bps', 'service_fee_paise', 'tax_bps'])));

        $after = $this->payload();
        $this->audit->log('pricing.updated', 'PricingRule', ['before' => $before, 'after' => $after]);

        return response()->json(['data' => $after]);
    }

    private function payload(): array
    {
        return [
            'rates' => PricingRule::query()->orderBy('paper_size')->orderBy('color_mode')
                ->get(['id', 'paper_size', 'color_mode', 'per_side_paise', 'active', 'updated_at']),
            'duplex_discount_bps' => $this->settings->int('duplex_discount_bps'),
            'service_fee_paise' => $this->settings->int('service_fee_paise'),
            'tax_bps' => $this->settings->int('tax_bps'),
            'paper_sizes' => $this->settings->get('paper_sizes'),
            'billing_policy' => 'per printed side; duplex discount applies per side; tax on subtotal + fee',
        ];
    }
}

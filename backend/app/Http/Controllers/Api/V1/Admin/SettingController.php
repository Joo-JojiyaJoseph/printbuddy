<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Audit\AuditLogger;
use App\Services\Documents\Conversion\DocumentConverter;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Upload limits, supported file types, TTLs and retention. Admin role only. */
class SettingController extends Controller
{
    public function __construct(private readonly Settings $settings, private readonly AuditLogger $audit) {}

    public function show(DocumentConverter $converter): JsonResponse
    {
        return response()->json(['data' => $this->payload($converter)]);
    }

    public function update(Request $request, DocumentConverter $converter): JsonResponse
    {
        $rules = [];
        foreach (Settings::EDITABLE as $key => $rule) {
            if (in_array($key, ['duplex_discount_bps', 'service_fee_paise', 'tax_bps'], true)) {
                continue; // pricing modifiers are edited through /admin/pricing
            }
            $rules[$key] = array_merge(['sometimes'], explode('|', $rule));
        }
        $rules['allowed_types.*'] = [Rule::in(Settings::ALL_TYPES)];
        $rules['paper_sizes.*'] = ['string', 'max:20', 'regex:/^[A-Za-z0-9 ]+$/'];
        $data = $request->validate($rules);

        $before = array_intersect_key($this->settings->all(), $data);
        $this->settings->put($data);
        $this->audit->log('settings.updated', 'Setting', ['before' => $before, 'after' => array_intersect_key($this->settings->all(), $data)]);

        return response()->json(['data' => $this->payload($converter)]);
    }

    private function payload(DocumentConverter $converter): array
    {
        $all = $this->settings->all();
        unset($all['duplex_discount_bps'], $all['service_fee_paise'], $all['tax_bps']);

        return $all + [
            'all_types' => Settings::ALL_TYPES,
            'conversion_driver' => config('printbuddy.conversion.driver'),
            'conversion_available' => $converter->available(),
            'payment_provider' => config('printbuddy.payment.provider'),
        ];
    }
}

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
    private const GENERAL = ['session_ttl_minutes', 'payment_ttl_minutes', 'document_retention_hours', 'max_upload_mb', 'max_files', 'max_pages', 'max_copies', 'allowed_types', 'paper_sizes'];

    public function __construct(private readonly Settings $settings, private readonly AuditLogger $audit) {}

    public function show(DocumentConverter $converter): JsonResponse
    {
        return response()->json(['data' => $this->payload($converter)]);
    }

    public function update(Request $request, DocumentConverter $converter): JsonResponse
    {
        $rules = [];
        foreach (Settings::EDITABLE as $key => $rule) {
            if (! in_array($key, self::GENERAL, true)) {
                continue; // pricing, printer and payment settings have their own screens (and secrets never travel here)
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
        $all = array_intersect_key($this->settings->all(), array_flip(self::GENERAL));

        return $all + [
            'all_types' => Settings::ALL_TYPES,
            'conversion_driver' => config('printbuddy.conversion.driver'),
            'conversion_available' => $converter->available(),
            'payment_provider' => app(\App\Support\Integrations::class)->paymentProvider(),
        ];
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Audit\AuditLogger;
use App\Services\Payments\RazorpayProvider;
use App\Services\Printing\ShellRunner;
use App\Support\IntegrationRules;
use App\Support\Integrations;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Payment gateway keys and printer program settings, edited in the admin panel instead of .env. Admin role only.
 * Secrets are encrypted when saved and are never sent back: the screen only learns whether one is set.
 */
class IntegrationController extends Controller
{
    public function __construct(private readonly Settings $settings, private readonly Integrations $integrations, private readonly AuditLogger $audit) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->payload()]);
    }

    public function update(Request $request): JsonResponse
    {
        $d = $request->validate([
            'payment_provider' => ['nullable', Rule::in(IntegrationRules::PAYMENT_PROVIDERS)],
            'razorpay_key_id' => ['nullable', 'string', 'regex:/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/'],
            'razorpay_key_secret' => ['nullable', 'string', 'min:8', 'max:100'],
            'razorpay_webhook_secret' => ['nullable', 'string', 'min:16', 'max:100'],
            'print_driver' => ['nullable', Rule::in(IntegrationRules::PRINT_DRIVERS)],
            'sumatra_path' => ['nullable', 'string', 'max:300'],
            'lp_path' => ['nullable', 'string', 'max:300'],
            'pdftoppm_path' => ['nullable', 'string', 'max:300'],
            'clear' => ['nullable', 'array'],
            'clear.*' => [Rule::in([...Integrations::SECRETS, 'razorpay_key_id'])],
        ], ['razorpay_key_id.regex' => 'The Key ID looks like rzp_test_… or rzp_live_….', 'razorpay_webhook_secret.min' => 'Use at least 16 characters for the webhook secret.']);

        $errors = [];
        foreach (array_keys(IntegrationRules::BINARIES) as $field) {
            // In shop-PC mode printing and Poppler run on the shop PCs, so server-side program paths are not used (and not checked).
            if (($d['print_driver'] ?? null) === 'agent') {
                continue;
            }
            if (isset($d[$field]) && ($e = IntegrationRules::binaryError($field, (string) $d[$field])) !== null) {
                $errors[$field] = [$e];
            }
        }
        $production = app()->environment('production');
        if ($production && ($d['payment_provider'] ?? null) === 'fake') {
            $errors['payment_provider'] = ['The sandbox is not allowed in production.'];
        }
        if ($production && ($d['print_driver'] ?? null) === 'file') {
            $errors['print_driver'] = ['"file" does not print. Choose cups or sumatra.'];
        }
        if ($errors) {
            return response()->json(['message' => reset($errors)[0], 'errors' => $errors], 422);
        }

        $values = [];
        foreach (['payment_provider', 'razorpay_key_id', 'print_driver', 'sumatra_path', 'lp_path', 'pdftoppm_path'] as $k) {
            if (array_key_exists($k, $d)) {
                $values[$k] = trim((string) $d[$k]);
            }
        }
        foreach (Integrations::SECRETS as $k) {
            if (isset($d[$k]) && trim($d[$k]) !== '') {
                $values[$k] = $this->integrations->encrypt(trim($d[$k])); // a blank box means "keep what is saved"
            }
        }
        foreach ($d['clear'] ?? [] as $k) {
            $values[$k] = '';
        }

        // Do not let the shop switch to Razorpay with keys missing: every payment would fail.
        $effective = array_merge($this->settings->all(), $values);
        $provider = IntegrationRules::pick($effective['payment_provider'] ?? null, config('printbuddy.payment.provider'));
        $env = config('printbuddy.payment.razorpay');
        $gaps = IntegrationRules::paymentGaps(
            $provider,
            IntegrationRules::pick($effective['razorpay_key_id'] ?? null, $env['key_id']),
            ($effective['razorpay_key_secret'] ?? '') !== '' || $env['key_secret'] !== '',
        );
        if ($gaps) {
            return response()->json(['message' => 'Razorpay needs: '.implode(', ', $gaps).'.', 'errors' => ['payment_provider' => ['Missing: '.implode(', ', $gaps)]]], 422);
        }

        $this->settings->put($values);
        $this->audit->log('integrations.updated', 'Integrations', ['fields' => array_keys($values)]); // names only, never values

        return response()->json(['data' => $this->payload()]);
    }

    /** POST /admin/integrations/payment/test — asks Razorpay whether the saved keys work. Sends nothing to customers. */
    public function testPayment(): JsonResponse
    {
        $rz = $this->integrations->razorpay();
        if ($this->integrations->paymentProvider() !== 'razorpay') {
            return response()->json(['message' => 'Razorpay is not the selected payment provider.', 'data' => ['ok' => false]], 422);
        }
        if ($rz['key_id'] === '' || $rz['key_secret'] === '') {
            return response()->json(['message' => 'Save the Key ID and Key Secret first.', 'data' => ['ok' => false]], 422);
        }
        $result = (new RazorpayProvider($rz['key_id'], $rz['key_secret'], $rz['webhook_secret'], $rz['base_url'], 900))->ping();
        $this->audit->log('integrations.payment_tested', 'Integrations', ['ok' => $result['ok']]);

        // On failure the reason must also be a top-level `message`: that is the field the admin screen shows.
        return response()->json($result['ok'] ? ['data' => $result] : ['message' => $result['message'], 'data' => $result], $result['ok'] ? 200 : 502);
    }

    private function payload(): array
    {
        $rz = $this->integrations->razorpay();
        $p = $this->integrations->printing();
        $provider = $this->integrations->paymentProvider();

        return [
            'payment' => [
                'provider' => $provider,
                'from' => $this->integrations->from(['payment_provider', 'razorpay_key_id', 'razorpay_key_secret', 'razorpay_webhook_secret']),
                'key_id' => $rz['key_id'],
                'mode' => str_starts_with($rz['key_id'], 'rzp_live_') ? 'live' : (str_starts_with($rz['key_id'], 'rzp_test_') ? 'test' : null),
                'key_secret_set' => $rz['key_secret'] !== '',
                'webhook_secret_set' => $rz['webhook_secret'] !== '',
                'webhook_url' => url('/api/v1/webhooks/razorpay'),
                'webhook_event' => 'qr_code.credited and order.paid',
                'production' => app()->environment('production'),
            ],
            'printing' => [
                'driver' => $p['driver'],
                'from' => $this->integrations->from(['print_driver', 'printer_name', 'sumatra_path', 'lp_path', 'pdftoppm_path']),
                'sumatra_path' => $p['sumatra_path'],
                'lp_path' => $p['lp_path'],
                'pdftoppm_path' => $p['pdftoppm_path'],
                'detected' => [
                    'sumatra' => ShellRunner::find((string) $p['sumatra_path'], 'SumatraPDF', ['C:\\Program Files\\SumatraPDF\\SumatraPDF.exe', 'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe']),
                    'lp' => ShellRunner::find((string) $p['lp_path'], 'lp', ['/usr/bin/lp']),
                    'pdftoppm' => ShellRunner::find((string) $p['pdftoppm_path'], 'pdftoppm'),
                ],
                'os' => PHP_OS_FAMILY,
                'production' => app()->environment('production'),
            ],
        ];
    }
}

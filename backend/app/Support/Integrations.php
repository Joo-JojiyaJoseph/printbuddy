<?php

namespace App\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * Payment gateway and printer connection settings. Saved in the admin panel (settings table; secrets encrypted with
 * APP_KEY); anything left empty falls back to .env, so existing installs keep working.
 */
class Integrations
{
    public const SECRETS = ['razorpay_key_secret', 'razorpay_webhook_secret'];

    public function __construct(private readonly Settings $settings) {}

    public function paymentProvider(): string
    {
        return IntegrationRules::pick($this->settings->get('payment_provider'), config('printbuddy.payment.provider'));
    }

    /** @return array{key_id:string,key_secret:string,webhook_secret:string,base_url:string} */
    public function razorpay(): array
    {
        $env = config('printbuddy.payment.razorpay');

        return [
            'key_id' => IntegrationRules::pick($this->settings->get('razorpay_key_id'), $env['key_id']),
            'key_secret' => IntegrationRules::pick($this->secret('razorpay_key_secret'), $env['key_secret']),
            'webhook_secret' => IntegrationRules::pick($this->secret('razorpay_webhook_secret'), $env['webhook_secret']),
            'base_url' => (string) $env['base_url'],
        ];
    }

    /** config('printbuddy.printing') with the admin's choices applied. */
    public function printing(): array
    {
        $c = config('printbuddy.printing');
        $c['driver'] = IntegrationRules::pick($this->settings->get('print_driver'), $c['driver']);
        $c['printer'] = IntegrationRules::pick($this->settings->get('printer_name'), $c['printer']);
        foreach (array_keys(IntegrationRules::BINARIES) as $k) {
            $c[$k] = IntegrationRules::pick($this->settings->get($k), $c[$k]);
        }

        return $c;
    }

    public function secret(string $key): string
    {
        $raw = $this->settings->get($key);
        if (! is_string($raw) || $raw === '') {
            return '';
        }
        try {
            return Crypt::decryptString($raw);
        } catch (DecryptException) {
            return ''; // APP_KEY changed: treat as not set rather than failing
        }
    }

    public function encrypt(string $plain): string
    {
        return Crypt::encryptString($plain);
    }

    /** Which source each group currently comes from, for the admin screen. */
    public function from(array $keys): string
    {
        foreach ($keys as $k) {
            $v = $this->settings->get($k);
            if (is_string($v) && trim($v) !== '') {
                return 'admin';
            }
        }

        return 'env';
    }
}

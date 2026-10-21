<?php

namespace App\Providers;

use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Documents\Conversion\DocumentConverter;
use App\Services\Documents\Conversion\FakeConverter;
use App\Services\Documents\Conversion\LibreOfficeConverter;
use App\Services\Documents\Conversion\UnavailableConverter;
use App\Services\Payments\EloquentPaymentStore;
use App\Services\Payments\FakeUpiProvider;
use App\Services\Payments\PaymentProcessor;
use App\Services\Payments\PaymentProvider;
use App\Services\Payments\PaymentStore;
use App\Services\Payments\RazorpayProvider;
use App\Services\Printing\{CupsPrinter, FilePrinter, PrinterDriver, PrintFileComposer, SumatraPrinter};
use App\Support\Settings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use App\Services\Documents\Editing\OfficeHtmlBridge;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Settings::class);

        $this->app->singleton(DocumentConverter::class, function () {
            $c = config('printbuddy.conversion');

            return match ($c['driver']) {
                'fake' => new FakeConverter,
                'none' => new UnavailableConverter,
                default => new LibreOfficeConverter((string) $c['soffice_path'], (int) $c['timeout_seconds']),
            };
        });

        $this->app->singleton(OfficeHtmlBridge::class, function () {
            $c = config('printbuddy.conversion');

            return new OfficeHtmlBridge((string) $c['soffice_path'], (int) $c['timeout_seconds'], storage_path('app/conversion'));
        });

        $this->app->singleton(\App\Support\Integrations::class, fn ($app) => new \App\Support\Integrations($app->make(Settings::class)));

        $this->app->singleton(PrintFileComposer::class, function ($app) {
            $c = $app->make(\App\Support\Integrations::class)->printing();

            return new PrintFileComposer((string) $c['pdftoppm_path'], (int) $c['dpi'], (int) $c['timeout_seconds'], (int) config('printbuddy.defaults.max_pages'));
        });

        $this->app->singleton(\App\Services\Documents\PdfMerger::class, fn ($app) => new \App\Services\Documents\PdfMerger(
            $app->make(PrintFileComposer::class), (string) config('printbuddy.printing.pdfunite_path')));

        $this->app->singleton(PrinterDriver::class, function ($app) {
            $c = $app->make(\App\Support\Integrations::class)->printing(); // admin choices first, then .env
            if ($c['driver'] === 'file' && $app->environment('production')) {
                throw new \RuntimeException('PRINT_DRIVER=file does not print; set PRINT_DRIVER=cups or sumatra in production.');
            }

            return match ($c['driver']) {
                'agent' => new \App\Services\Printing\AgentPrinter(),
                'cups' => new CupsPrinter((string) $c['lp_path'], (string) $c['printer'], (int) $c['timeout_seconds']),
                'sumatra' => new SumatraPrinter((string) $c['sumatra_path'], (string) $c['printer'], (int) $c['timeout_seconds']),
                default => new FilePrinter($c['output_dir'] !== '' ? (string) $c['output_dir'] : storage_path('app/printed')),
            };
        });

        $this->app->singleton(PaymentProvider::class, function ($app) {
            $cfg = config('printbuddy.payment');
            $integrations = $app->make(\App\Support\Integrations::class);
            if ($integrations->paymentProvider() === 'razorpay') {
                $rz = $integrations->razorpay();

                return new RazorpayProvider($rz['key_id'], $rz['key_secret'], $rz['webhook_secret'], $rz['base_url'],
                    $app->make(Settings::class)->int('payment_ttl_minutes') * 60);
            }
            if ($app->environment('production')) {
                throw new \RuntimeException('PAYMENT_PROVIDER=fake is not allowed in production.');
            }
            // Sandbox provider persisted in the cache so it behaves like a remote service across requests.
            $key = 'printbuddy.sandbox_provider';

            return new FakeUpiProvider(
                fn () => Cache::get($key, []),
                fn (array $state) => Cache::forever($key, $state),
            );
        });

        $this->app->singleton(PaymentStore::class, fn ($app) => new EloquentPaymentStore(
            $app->make(\App\Support\Integrations::class)->paymentProvider(), $app->make(AuditLogger::class)));

        $this->app->singleton(PaymentProcessor::class, fn ($app) => new PaymentProcessor(
            $app->make(PaymentProvider::class), $app->make(PaymentStore::class), (string) config('printbuddy.payment.webhook_secret')));
    }

    public function boot(): void
    {
        $this->defineGates();
        $this->configureRateLimiting();
    }

    private function defineGates(): void
    {
        Gate::define('admin.view', fn (User $u) => in_array($u->role, User::ROLES, true));
        Gate::define('admin.operate', fn (User $u) => $u->canOperate());
        Gate::define('admin.manage', fn (User $u) => $u->isAdmin());
    }

    private function configureRateLimiting(): void
    {
        $byToken = fn (Request $r) => $r->header('X-Session-Token') ?: $r->ip();
        RateLimiter::for('quote', fn (Request $r) => Limit::perMinute(300)->by('q|'.$byToken($r)));
        RateLimiter::for('order', fn (Request $r) => Limit::perMinute(40)->by('o|'.$byToken($r)));
        RateLimiter::for('heavy', fn (Request $r) => Limit::perMinute(30)->by('h|'.$byToken($r)));
        RateLimiter::for('session-create', fn (Request $r) => Limit::perMinute(30)->by($r->ip()));
        RateLimiter::for('customer', fn (Request $r) => Limit::perMinute(120)->by($r->header('X-Session-Token') ?: $r->ip()));
        RateLimiter::for('upload', fn (Request $r) => Limit::perMinute(30)->by($r->header('X-Session-Token') ?: $r->ip()));
        RateLimiter::for('preview', fn (Request $r) => Limit::perMinute(120)->by($r->ip()));
        RateLimiter::for('webhook', fn (Request $r) => Limit::perMinute(240)->by($r->ip()));
        RateLimiter::for('admin-login', fn (Request $r) => Limit::perMinute(5)->by(strtolower((string) $r->input('email')).'|'.$r->ip()));
        RateLimiter::for('admin', fn (Request $r) => Limit::perMinute(300)->by($r->user()?->id ?: $r->ip()));
    }
}

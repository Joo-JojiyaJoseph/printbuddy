<?php

namespace App\Support;

/** Pure rules for the payment/printer settings an admin may change (no framework, unit tested). */
final class IntegrationRules
{
    public const PAYMENT_PROVIDERS = ['fake', 'razorpay'];
    public const PRINT_DRIVERS = ['file', 'cups', 'sumatra', 'agent'];

    /** Program each path field may point to (file name without .exe, case-insensitive). */
    public const BINARIES = ['sumatra_path' => 'sumatrapdf', 'lp_path' => 'lp', 'pdftoppm_path' => 'pdftoppm'];

    /** A value saved in the admin panel wins over .env; an empty one falls back to .env. */
    public static function pick(mixed $saved, mixed $env): string
    {
        return is_string($saved) && trim($saved) !== '' ? trim($saved) : (string) $env;
    }

    /**
     * Admin-entered program paths are the one place an admin could point the server at "any program", so only the
     * expected program is accepted: an absolute path to an existing file with that program's name.
     *
     * @param callable(string):bool|null $isFile
     */
    public static function binaryError(string $field, string $path, ?callable $isFile = null): ?string
    {
        $path = trim($path);
        if ($path === '') {
            return null;
        }
        $isFile ??= 'is_file';
        $expected = self::BINARIES[$field] ?? null;
        if ($expected === null) {
            return 'Unknown setting.';
        }
        $absolute = str_starts_with($path, '/') || (bool) preg_match('/^[A-Za-z]:[\\\\\/]/', $path);
        if (! $absolute || str_contains($path, "\0") || preg_match('/[\r\n]/', $path) === 1 || preg_match('#(^|[\\\\/])\.\.([\\\\/]|$)#', $path) === 1) {
            return 'Enter the full path to the program, for example C:\\Program Files\\SumatraPDF\\SumatraPDF.exe';
        }
        $base = strtolower(preg_replace('/\.(exe|com|bat)$/i', '', basename(str_replace('\\', '/', $path))) ?? '');
        if ($base !== $expected) {
            return "That file should be named {$expected}.";
        }
        if (! $isFile($path)) {
            return 'That file was not found on the server.';
        }

        return null;
    }

    /** The webhook secret is optional: without it webhooks are rejected and the customer's screen polls Razorpay instead.
     *
     * @return string[] problems that stop the chosen payment provider from working */
    public static function paymentGaps(string $provider, string $keyId, bool $hasSecret): array
    {
        if ($provider !== 'razorpay') {
            return [];
        }
        $gaps = [];
        if ($keyId === '') {
            $gaps[] = 'Razorpay Key ID';
        }
        if (! $hasSecret) {
            $gaps[] = 'Razorpay Key Secret';
        }

        return $gaps;
    }
}

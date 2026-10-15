<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Admin-tunable operational settings (upload limits, TTLs, retention, pricing modifiers).
 * Values fall back to config('printbuddy.defaults'). Cached with explicit invalidation on write.
 */
class Settings
{
    private const CACHE_KEY = 'printbuddy.settings';

    /** Keys an administrator may change, with their validation rules. */
    public const EDITABLE = [
        'session_ttl_minutes' => 'integer|min:2|max:120',
        'payment_ttl_minutes' => 'integer|min:1|max:60',
        'document_retention_hours' => 'integer|min:1|max:720',
        'max_upload_mb' => 'integer|min:1|max:200',
        'max_files' => 'integer|min:1|max:50',
        'max_pages' => 'integer|min:1|max:5000',
        'max_copies' => 'integer|min:1|max:100',
        'allowed_types' => 'array|min:1',
        'paper_sizes' => 'array|min:1',
        'duplex_discount_bps' => 'integer|min:0|max:10000',
        'service_fee_paise' => 'integer|min:0|max:100000000',
        'tax_bps' => 'integer|min:0|max:10000',
    ];

    public const ALL_TYPES = ['pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];

    public function all(): array
    {
        $overrides = Cache::rememberForever(self::CACHE_KEY, fn () => Setting::query()->pluck('value', 'key')->all());

        return array_replace(config('printbuddy.defaults'), $overrides);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->all()[$key] ?? $default;
    }

    public function int(string $key): int
    {
        return (int) $this->get($key, 0);
    }

    /** @param array<string,mixed> $values */
    public function put(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, self::EDITABLE)) {
                continue;
            }
            Setting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
        $this->forget();
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    public function maxUploadBytes(): int
    {
        return $this->int('max_upload_mb') * 1024 * 1024;
    }
}

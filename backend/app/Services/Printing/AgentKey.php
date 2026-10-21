<?php

namespace App\Services\Printing;

/** The secret the shop PC print program uses. Only a hash is stored; the key is shown once when created. */
final class AgentKey
{
    public const PREFIX = 'tpa_';

    public static function generate(): string
    {
        return self::PREFIX.bin2hex(random_bytes(24));
    }

    public static function hash(string $key): string
    {
        return hash('sha256', $key);
    }

    public static function valid(string $presented, string $storedHash): bool
    {
        return $storedHash !== '' && str_starts_with($presented, self::PREFIX) && strlen($presented) <= 80
            && hash_equals($storedHash, self::hash($presented));
    }

    /** Keeps only printable text, so whatever a program reports can be shown safely. */
    public static function cleanMessage(?string $message): string
    {
        $m = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $message) ?? '';

        return mb_substr(trim($m), 0, 160);
    }
}

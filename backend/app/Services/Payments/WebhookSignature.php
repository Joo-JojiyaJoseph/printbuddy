<?php

namespace App\Services\Payments;

/** HMAC-SHA256 over "{timestamp}.{rawBody}" with a bounded timestamp window to block replays. */
final class WebhookSignature
{
    public const TOLERANCE_SECONDS = 300;

    public static function sign(string $rawBody, int $timestamp, string $secret): string
    {
        return hash_hmac('sha256', $timestamp . '.' . $rawBody, $secret);
    }

    public static function verify(string $rawBody, string $signature, int $timestamp, string $secret, int $now): bool
    {
        if ($secret === '' || abs($now - $timestamp) > self::TOLERANCE_SECONDS) {
            return false;
        }
        return hash_equals(self::sign($rawBody, $timestamp, $secret), $signature);
    }
}

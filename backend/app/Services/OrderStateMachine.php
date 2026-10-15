<?php

namespace App\Services;

use InvalidArgumentException;

/** Explicit order transitions. Anything not listed is rejected. */
final class OrderStateMachine
{
    private const TRANSITIONS = [
        'draft'            => ['uploaded', 'cancelled', 'expired'],
        'uploaded'         => ['configured', 'cancelled', 'expired'],
        'configured'       => ['configured', 'awaiting_payment', 'cancelled', 'expired'],
        'awaiting_payment' => ['paid', 'payment_failed', 'expired', 'cancelled'],
        'payment_failed'   => ['awaiting_payment', 'cancelled', 'expired'],
        'paid'             => [], // terminal
        'expired'          => [],
        'cancelled'        => [],
    ];

    public static function can(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    public static function assert(string $from, string $to): void
    {
        if (!self::can($from, $to)) {
            throw new InvalidArgumentException("Invalid order transition {$from} -> {$to}.");
        }
    }
}

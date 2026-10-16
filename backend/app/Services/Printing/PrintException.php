<?php

namespace App\Services\Printing;

use RuntimeException;

/** Printing failed. `$retryable` marks transient problems (printer offline) as opposed to bad input. */
final class PrintException extends RuntimeException
{
    public function __construct(string $message, public readonly bool $retryable = false)
    {
        parent::__construct($message);
    }
}

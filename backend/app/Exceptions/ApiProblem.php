<?php

namespace App\Exceptions;

use RuntimeException;

/** A customer-safe error with an HTTP status; rendered as {"message": ...} by the exception handler. */
class ApiProblem extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422, public readonly array $errors = [])
    {
        parent::__construct($message);
    }
}

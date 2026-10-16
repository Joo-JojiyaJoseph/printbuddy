<?php

namespace App\Services\Documents\Editing;

use RuntimeException;

/** Raised for failures whose message is safe to show to the customer. */
final class EditingException extends RuntimeException {}

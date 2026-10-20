<?php

namespace App\Services\Payments;

/** The provider could not make a UPI QR (for example QR Codes are not enabled on the account). */
final class QrUnavailable extends \RuntimeException {}

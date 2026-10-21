<?php

namespace App\Services\Printing;

/** Marker: this driver does not print on the server. The prepared PDF waits for a program on the shop PC to collect it. */
interface DeferredPrinter {}

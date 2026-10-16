<?php

namespace App\Services\Printing;

/**
 * Sends a finished PDF to a physical (or stand-in) printer.
 *
 * `$job` keys: reference, title, copies:int, color:bool, duplex:bool, landscape:bool, paper:string
 * (A4|A5|Letter), direct:bool (true = an unedited original that the printer should fit to the paper).
 */
interface PrinterDriver
{
    public function name(): string;

    /** Whether the program/folder this driver needs is present. */
    public function available(): bool;

    /**
     * @return string|null an identifier of the print job when the system reports one
     *
     * @throws PrintException (retryable when the printer/spooler may simply be unavailable)
     */
    public function send(string $pdfPath, array $job): ?string;
}

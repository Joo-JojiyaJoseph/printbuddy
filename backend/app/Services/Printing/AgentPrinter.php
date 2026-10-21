<?php

namespace App\Services\Printing;

/** Printing happens on the shop's own Windows PC (the Taprint print agent), so the hosted server needs no printer or paths. */
final class AgentPrinter implements PrinterDriver, DeferredPrinter
{
    public function name(): string
    {
        return 'agent';
    }

    public function available(): bool
    {
        return true;
    }

    public function send(string $pdfPath, array $job): ?string
    {
        throw new PrintException('With the shop PC print program, test pages are printed from that PC: run "Test print" in the Taprint print program window.', retryable: false);
    }
}

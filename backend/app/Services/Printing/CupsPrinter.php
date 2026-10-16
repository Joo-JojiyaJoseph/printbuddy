<?php

namespace App\Services\Printing;

/** Linux/macOS: CUPS `lp`. The command is built without a shell, so no value can inject arguments. */
final class CupsPrinter implements PrinterDriver
{
    /** @param callable(array,int):array{exit:int,out:string,err:string}|null $runner injectable for tests */
    public function __construct(
        private readonly string $binary = '',
        private readonly string $printer = '',
        private readonly int $timeoutSeconds = 30,
        private $runner = null,
    ) {}

    public function name(): string
    {
        return 'cups';
    }

    public function available(): bool
    {
        return $this->bin() !== null;
    }

    public function command(string $pdfPath, array $job): array
    {
        $cmd = [$this->bin() ?? 'lp'];
        if ($this->printer !== '') {
            array_push($cmd, '-d', $this->printer);
        }
        array_push($cmd, '-n', (string) max(1, min(100, (int) $job['copies'])));
        array_push($cmd, '-t', mb_substr(preg_replace('/[^\w .\-]/u', '_', (string) ($job['title'] ?? 'Taprint')), 0, 80));
        array_push($cmd, '-o', 'media='.(['A4' => 'A4', 'A5' => 'A5', 'Letter' => 'Letter'][$job['paper'] ?? 'A4'] ?? 'A4'));
        array_push($cmd, '-o', 'sides='.(! empty($job['duplex']) ? (! empty($job['landscape']) ? 'two-sided-short-edge' : 'two-sided-long-edge') : 'one-sided'));
        array_push($cmd, '-o', 'print-color-mode='.(! empty($job['color']) ? 'color' : 'monochrome'));
        array_push($cmd, '-o', 'fit-to-page');
        $cmd[] = '--';
        $cmd[] = $pdfPath;

        return $cmd;
    }

    public function send(string $pdfPath, array $job): ?string
    {
        if ($this->bin() === null) {
            throw new PrintException('The print system (CUPS "lp") is not installed on the server.', retryable: false);
        }
        $run = $this->runner ?? fn (array $c, int $t) => ShellRunner::run($c, $t);
        $r = $run($this->command($pdfPath, $job), $this->timeoutSeconds);
        if ($r['exit'] !== 0) {
            // stderr from lp is operational (printer name, queue state), never customer content; keep it for the log only.
            throw new PrintException('The printer did not accept the job.', retryable: true);
        }

        return preg_match('/request id is (\S+)/', $r['out'], $m) ? $m[1] : null;
    }

    private function bin(): ?string
    {
        if ($this->runner !== null && $this->binary === '') {
            return 'lp';
        }

        return ShellRunner::find($this->binary, 'lp', ['/usr/bin/lp']);
    }
}

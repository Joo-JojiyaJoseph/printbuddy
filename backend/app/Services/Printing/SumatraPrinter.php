<?php

namespace App\Services\Printing;

/** Windows: SumatraPDF's silent command-line printing (does not report a job id). */
final class SumatraPrinter implements PrinterDriver
{
    /** @param callable(array,int):array{exit:int,out:string,err:string}|null $runner */
    public function __construct(
        private readonly string $binary = '',
        private readonly string $printer = '',
        private readonly int $timeoutSeconds = 60,
        private $runner = null,
    ) {}

    public function name(): string
    {
        return 'sumatra';
    }

    public function available(): bool
    {
        return $this->bin() !== null;
    }

    public function command(string $pdfPath, array $job): array
    {
        $settings = [
            max(1, min(100, (int) $job['copies'])).'x',
            ! empty($job['duplex']) ? (! empty($job['landscape']) ? 'duplexshort' : 'duplexlong') : 'simplex',
            ! empty($job['color']) ? 'color' : 'monochrome',
            'paper='.strtolower(['A4' => 'A4', 'A5' => 'A5', 'Letter' => 'letter'][$job['paper'] ?? 'A4'] ?? 'A4'),
            'fit',
        ];
        $cmd = [$this->bin() ?? 'SumatraPDF'];
        array_push($cmd, ...($this->printer !== '' ? ['-print-to', $this->printer] : ['-print-to-default']));
        array_push($cmd, '-print-settings', implode(',', $settings), '-silent', $pdfPath);

        return $cmd;
    }

    public function send(string $pdfPath, array $job): ?string
    {
        if ($this->bin() === null) {
            throw new PrintException('SumatraPDF is not installed on the print computer.', retryable: false);
        }
        $run = $this->runner ?? fn (array $c, int $t) => ShellRunner::run($c, $t);
        $r = $run($this->command($pdfPath, $job), $this->timeoutSeconds);
        if ($r['exit'] !== 0) {
            throw new PrintException('The printer did not accept the job.', retryable: true);
        }

        return null;
    }

    private function bin(): ?string
    {
        if ($this->runner !== null && $this->binary === '') {
            return 'SumatraPDF';
        }

        return ShellRunner::find($this->binary, 'SumatraPDF', [
            'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe', 'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
        ]);
    }
}

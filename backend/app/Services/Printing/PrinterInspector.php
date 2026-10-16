<?php

namespace App\Services\Printing;

/** Finds the printers installed on the computer that runs the server. Commands are built without a shell. */
final class PrinterInspector
{
    /** @param callable(array,int):array{exit:int,out:string,err:string}|null $runner injectable for tests */
    public function __construct(private $runner = null, private readonly string $os = PHP_OS_FAMILY) {}

    /** @return array{names:string[],error:?string} */
    public function installed(): array
    {
        $cmd = $this->os === 'Windows'
            ? ['powershell', '-NoProfile', '-NonInteractive', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name']
            : ['lpstat', '-e'];
        $run = $this->runner ?? fn (array $c, int $t) => ShellRunner::run($c, $t);
        $r = $run($cmd, 10);
        if ($r['exit'] !== 0) {
            return ['names' => [], 'error' => $this->os === 'Windows' ? 'Could not list Windows printers.' : 'Could not list printers (is CUPS installed and running?).'];
        }

        return ['names' => self::parse($r['out']), 'error' => null];
    }

    /** @return string[] */
    public static function parse(string $out): array
    {
        $names = [];
        foreach (preg_split('/\r\n|\r|\n/', $out) ?: [] as $line) {
            $line = trim(preg_replace('/[\x00-\x1F\x7F]/', '', $line) ?? '');
            if ($line !== '' && mb_strlen($line) <= 120) {
                $names[$line] = $line;
            }
        }

        return array_values($names);
    }

    /** Whether a printer name is safe to store: printable, short, and not an option flag. */
    public static function validName(string $name): bool
    {
        return $name === '' || (bool) preg_match('/^[\p{L}\p{N}][\p{L}\p{N} ._\-()\/\\\\#]{0,119}$/u', $name);
    }
}

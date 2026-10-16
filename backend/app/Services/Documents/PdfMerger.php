<?php

namespace App\Services\Documents;

use App\Services\Printing\PrintException;
use App\Services\Printing\PrintFileComposer;
use App\Services\Printing\ShellRunner;
use RuntimeException;

/**
 * Joins several prepared files into ONE PDF (Poppler `pdfunite`, which keeps text and vectors sharp).
 * Pictures become one A4 page each. Framework-free so it can be tested without booting Laravel.
 */
final class PdfMerger
{
    public function __construct(
        private readonly PrintFileComposer $composer,
        private readonly string $pdfunite = '',
        private readonly int $timeoutSeconds = 120,
    ) {}

    public function available(): bool
    {
        return $this->tool() !== null;
    }

    /**
     * @param  list<array{kind:string,path:string}>  $items  in print order; kind is pdf|jpg|png
     *
     * @throws RuntimeException customer-safe message
     */
    public function merge(array $items, string $target): void
    {
        $tool = $this->tool();
        if ($tool === null) {
            throw new RuntimeException('Combining files needs Poppler (pdfunite), qpdf or Ghostscript installed on the kiosk PC. You can still print each file separately.');
        }
        $temps = [];
        try {
            $pdfs = [];
            foreach ($items as $i => $item) {
                if (! is_file($item['path'])) {
                    throw new RuntimeException('One of the files is no longer available.');
                }
                if (in_array($item['kind'], ['jpg', 'png'], true)) {
                    $tmp = sys_get_temp_dir().DIRECTORY_SEPARATOR.'pb-merge-'.bin2hex(random_bytes(6)).'.pdf';
                    $temps[] = $tmp;
                    try {
                        $this->composer->compose(
                            ['paper_size' => 'A4', 'orientation' => 'portrait', 'scaling' => 'fit', 'color_mode' => 'color', 'edits' => null, 'page_range' => ''],
                            ['kind' => $item['kind'], 'id' => 'i'.$i, 'image_paths' => ['i'.$i => ['path' => $item['path'], 'kind' => $item['kind']]]],
                            $tmp,
                        );
                    } catch (PrintException $e) {
                        throw new RuntimeException('A picture could not be added to the combined file.');
                    }
                    $pdfs[] = $tmp;
                } else {
                    $pdfs[] = $item['path'];
                }
            }
            @mkdir(dirname($target), 0770, true);
            $r = ShellRunner::run(self::command($tool, $pdfs, $target), $this->timeoutSeconds);
            if ($r['exit'] !== 0 || ! is_file($target) || filesize($target) === 0) {
                @unlink($target);
                throw new RuntimeException('These files could not be combined.');
            }
        } finally {
            foreach ($temps as $t) {
                @unlink($t);
            }
        }
    }

    /** @return array{0:string,1:string}|null [kind, path] of the first merge tool found: pdfunite, qpdf or Ghostscript */
    private function tool(): ?array
    {
        if ($p = ShellRunner::find($this->pdfunite, 'pdfunite', ['/usr/bin/pdfunite', '/usr/local/bin/pdfunite', 'C:\\poppler\\Library\\bin\\pdfunite.exe', 'C:\\Program Files\\poppler\\Library\\bin\\pdfunite.exe'])) {
            return ['pdfunite', $p];
        }
        if ($p = ShellRunner::find('', 'qpdf', ['/usr/bin/qpdf', '/usr/local/bin/qpdf', 'C:\\Program Files\\qpdf\\bin\\qpdf.exe'])) {
            return ['qpdf', $p];
        }
        foreach (['gswin64c', 'gswin32c', 'gs'] as $g) {
            if ($p = ShellRunner::find('', $g, ['/usr/bin/gs'])) {
                return ['gs', $p];
            }
        }

        return null;
    }

    /** @param array{0:string,1:string} $tool @param list<string> $pdfs */
    public static function command(array $tool, array $pdfs, string $target): array
    {
        return match ($tool[0]) {
            'qpdf' => array_merge([$tool[1], '--empty', '--pages'], $pdfs, ['--', $target]),
            'gs' => array_merge([$tool[1], '-dBATCH', '-dNOPAUSE', '-dQUIET', '-sDEVICE=pdfwrite', '-sOutputFile='.$target], $pdfs),
            default => array_merge([$tool[1]], $pdfs, [$target]),
        };
    }
}

<?php

namespace App\Services\Documents;

use FPDF;
use RuntimeException;

/** Renders a plain-text file to an A4 PDF (monospace, wrapped) so it previews and prices like any PDF. */
class TextToPdf
{
    private const MAX_BYTES = 2 * 1024 * 1024;

    public function convert(string $sourcePath, string $targetPath, int $maxPages): int
    {
        $size = filesize($sourcePath);
        if ($size === false || $size > self::MAX_BYTES) {
            throw new RuntimeException('Text files larger than 2 MB cannot be converted.');
        }
        $text = (string) file_get_contents($sourcePath);
        if (str_starts_with($text, "\xEF\xBB\xBF")) {
            $text = substr($text, 3);
        }
        // FPDF core fonts are Latin-1; transliterate what we can and replace the rest.
        $latin = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $text);
        $text = $latin === false ? preg_replace('/[^\x09\x0A\x0D\x20-\x7E]/', '?', $text) : $latin;
        $text = str_replace(["\r\n", "\r", "\t"], ["\n", "\n", '    '], $text);

        $pdf = new FPDF('P', 'mm', 'A4');
        $pdf->SetMargins(15, 15, 15);
        $pdf->SetAutoPageBreak(true, 15);
        $pdf->AddPage();
        $pdf->SetFont('Courier', '', 10);
        $lineHeight = 4.6;

        foreach (explode("\n", $text) as $line) {
            foreach (str_split($line === '' ? ' ' : $line, 88) as $part) {
                $pdf->Cell(0, $lineHeight, $part, 0, 1);
                if ($pdf->PageNo() > $maxPages) {
                    throw new RuntimeException("This text file would print more than {$maxPages} pages.");
                }
            }
        }
        $pdf->Output('F', $targetPath);

        return $pdf->PageNo();
    }
}

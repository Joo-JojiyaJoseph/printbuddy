<?php

namespace App\Services\Documents\Conversion;

use FPDF;

/** Test double (CONVERSION_DRIVER=fake): writes a 2-page PDF, or fails when the source name contains "fail". */
class FakeConverter implements DocumentConverter
{
    public function available(): bool
    {
        return true;
    }

    public function toPdf(string $sourcePath, string $targetPath): void
    {
        if (str_contains(basename($sourcePath), 'fail')) {
            throw new ConversionException('This document could not be converted to PDF.', retryable: true);
        }
        $pdf = new FPDF;
        foreach ([1, 2] as $n) {
            $pdf->AddPage();
            $pdf->SetFont('Helvetica', '', 12);
            $pdf->Cell(0, 10, "Converted page {$n}", 0, 1);
        }
        $pdf->Output('F', $targetPath);
    }
}

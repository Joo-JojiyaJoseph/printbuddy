<?php

namespace App\Services\Printing;

/** A one-page A4 PDF for checking that the printer connection works. Contains no customer data. */
final class PrintTestPage
{
    public static function write(string $path, string $driver, string $printer): void
    {
        $pdf = new \FPDF('P', 'mm', 'A4');
        $pdf->SetAutoPageBreak(false);
        $pdf->AddPage();
        $pdf->SetFont('Helvetica', 'B', 26);
        $pdf->SetXY(20, 30);
        $pdf->Cell(170, 12, 'Taprint test page');
        $pdf->SetFont('Helvetica', '', 12);
        $pdf->SetXY(20, 48);
        $pdf->MultiCell(170, 7, "If you can read this, the printer connection works.\n\nDriver: ".$driver."\nPrinter: ".($printer !== '' ? $printer : 'system default')."\nTime: ".date('Y-m-d H:i:s'));
        $pdf->SetDrawColor(0);
        $pdf->Rect(10, 10, 190, 277);
        $pdf->SetFillColor(0);
        $pdf->Rect(20, 100, 40, 12, 'F');
        $pdf->SetFillColor(128);
        $pdf->Rect(70, 100, 40, 12, 'F');
        $pdf->SetFont('Helvetica', '', 9);
        $pdf->SetXY(20, 118);
        $pdf->Cell(170, 6, 'Black and grey blocks above: check the toner/ink and alignment.');
        $pdf->Output('F', $path);
    }
}

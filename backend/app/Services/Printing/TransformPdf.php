<?php

namespace App\Services\Printing;

/** FPDF plus clipping and rotated, box-fitted image placement (all units mm). */
class TransformPdf extends \FPDF
{
    private bool $rotated = false;

    /** @var array<int,array{ca:float,n?:int}> transparency states (PDF ExtGState) used by highlights and watermarks */
    protected $extgstates = [];

    public function clip(float $x, float $y, float $w, float $h): void
    {
        $this->_out(sprintf('q %.2F %.2F %.2F %.2F re W n', $x * $this->k, ($this->h - $y - $h) * $this->k, $w * $this->k, $h * $this->k));
    }

    public function endClip(): void
    {
        $this->_out('Q');
    }

    /**
     * Draw a picture inside a box. `$rot` = extra clockwise quarter turn (0/90/180/270); `$px`/`$py` = the picture's own
     * pixel size, `$mode` contain|cover|actual (actual needs `$mmW`/`$mmH` = its real size).
     * `$dx`/`$dy` move the picture from the middle of the box (fractions of the box) and `$zoom` resizes it; the box still clips it.
     */
    public function placeInBox(string $file, string $type, int $px, int $py, int $rot, float $bx, float $by, float $bw, float $bh, string $mode, float $mmW = 0, float $mmH = 0, float $dx = 0.0, float $dy = 0.0, float $zoom = 1.0): array
    {
        $quarter = $rot % 180 !== 0;
        $ew = $quarter ? ($mmH ?: $py) : ($mmW ?: $px);   // size after rotation
        $eh = $quarter ? ($mmW ?: $px) : ($mmH ?: $py);
        [$dw, $dh] = PrintGeometry::fitSize((float) $ew, (float) $eh, $bw, $bh, $mode);
        $dw *= $zoom;   // customer's resize, around the picture's own middle
        $dh *= $zoom;
        $iw = $quarter ? $dh : $dw;   // size of the unrotated picture
        $ih = $quarter ? $dw : $dh;
        $cx = $bx + $bw / 2 + $dx * $bw;   // customer's drag: fractions of the box, so it is the same on every paper size
        $cy = $by + $bh / 2 + $dy * $bh;

        $this->clip($bx, $by, $bw, $bh);
        if ($rot !== 0) {
            $this->rotateAbout(-$rot, $cx, $cy); // PDF angles run counter-clockwise; ours are clockwise
        }
        $this->Image($file, $cx - $iw / 2, $cy - $ih / 2, $iw, $ih, $type);
        if ($rot !== 0) {
            $this->endRotate();
        }
        $this->endClip();

        // The picture as displayed (after rotation): marks are positioned relative to this rectangle.
        return [$cx - $dw / 2, $cy - $dh / 2, $dw, $dh];
    }

    // ---- transparency (standard FPDF alpha extension) ----
    private function alphaState(float $alpha): int
    {
        foreach ($this->extgstates as $i => $g) {
            if (abs($g['ca'] - $alpha) < 1e-6) {
                return $i;
            }
        }
        $this->extgstates[count($this->extgstates) + 1] = ['ca' => $alpha];

        return count($this->extgstates);
    }

    protected function _enddoc(): void
    {
        if ($this->extgstates !== [] && $this->PDFVersion < '1.4') {
            $this->PDFVersion = '1.4';
        }
        parent::_enddoc();
    }

    protected function _putresources(): void
    {
        foreach ($this->extgstates as $i => $g) {
            $this->_newobj();
            $this->extgstates[$i]['n'] = $this->n;
            $this->_put(sprintf('<</Type /ExtGState /ca %.3F /CA %.3F /BM /Normal>>', $g['ca'], $g['ca']));
            $this->_put('endobj');
        }
        parent::_putresources();
    }

    protected function _putresourcedict(): void
    {
        parent::_putresourcedict();
        $this->_put('/ExtGState <<');
        foreach ($this->extgstates as $i => $g) {
            $this->_put('/GS'.$i.' '.$g['n'].' 0 R');
        }
        $this->_put('>>');
    }

    // ---- drawings on top of a page (all units mm, relative to the picture rectangle [rx, ry, rw, rh]) ----

    /** Thin grey outline around a page when several pages share one sheet. */
    public function cellFrame(float $x, float $y, float $w, float $h): void
    {
        $this->SetDrawColor(160, 160, 160);
        $this->SetLineWidth(0.2);
        $this->Rect($x, $y, $w, $h, 'D');
    }

    /** Filled rectangle, optionally see-through (highlighter). Colour is #rrggbb. */
    public function markRect(float $x, float $y, float $w, float $h, string $hex, float $alpha = 1.0): void
    {
        [$r, $g, $b] = self::rgb($hex);
        $this->_out('q');
        if ($alpha < 1.0) {
            $this->_out(sprintf('/GS%d gs', $this->alphaState($alpha)));
        }
        $this->SetFillColor($r, $g, $b);
        $this->Rect($x, $y, $w, $h, 'F');
        $this->_out('Q');
    }

    /**
     * Text inside a box (wrapped, clipped to the box). `$pt` is the font size in points.
     * Core Helvetica only: text is converted to Windows-1252, other characters print as '?'.
     */
    public function markText(float $x, float $y, float $w, float $h, string $text, float $pt, string $hex, bool $bold, string $align): void
    {
        [$r, $g, $b] = self::rgb($hex);
        $this->clip($x, $y, $w, $h);
        $this->SetFont('Helvetica', $bold ? 'B' : '', $pt);
        $this->SetTextColor($r, $g, $b);
        $lh = $pt * 0.3528 * 1.2;
        $pad = min(0.6, $w / 20);
        $this->SetXY($x + $pad, $y + $pad / 2);
        $this->MultiCell(max(1.0, $w - 2 * $pad), $lh, self::latin($text), 0, strtoupper($align));
        $this->endClip();
        $this->FontFamily = ''; // Q restored the stream's font state: make the next SetFont emit it again
    }

    /** One line of text centred on (cx, cy), optionally rotated clockwise by `$deg` and see-through (watermark / page number). */
    public function stampText(float $cx, float $cy, string $text, float $pt, string $hex, float $alpha = 1.0, float $deg = 0.0, bool $bold = false): void
    {
        [$r, $g, $b] = self::rgb($hex);
        $this->_out('q');
        if ($alpha < 1.0) {
            $this->_out(sprintf('/GS%d gs', $this->alphaState($alpha)));
        }
        if ($deg != 0.0) {
            $this->rotateAbout(-$deg, $cx, $cy);
        }
        $this->SetFont('Helvetica', $bold ? 'B' : '', $pt);
        $this->SetTextColor($r, $g, $b);
        $s = self::latin($text);
        $tw = $this->GetStringWidth($s);
        $this->Text($cx - $tw / 2, $cy + $pt * 0.3528 * 0.35, $s);
        if ($deg != 0.0) {
            $this->endRotate();
        }
        $this->_out('Q');
        $this->FontFamily = '';
    }

    /** @return array{0:int,1:int,2:int} */
    public static function rgb(string $hex): array
    {
        $hex = ltrim($hex, '#');

        return preg_match('/^[0-9a-fA-F]{6}$/', $hex) ? [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))] : [0, 0, 0];
    }

    public static function latin(string $s): string
    {
        $out = function_exists('iconv') ? @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $s) : false;
        if ($out === false) {
            $out = mb_convert_encoding($s, 'ISO-8859-1', 'UTF-8');
        }

        return $out;
    }

    private function rotateAbout(float $deg, float $x, float $y): void
    {
        $a = deg2rad($deg);
        $c = cos($a);
        $s = sin($a);
        $cx = $x * $this->k;
        $cy = ($this->h - $y) * $this->k;
        $this->_out(sprintf('q %.5F %.5F %.5F %.5F %.2F %.2F cm 1 0 0 1 %.2F %.2F cm', $c, $s, -$s, $c, $cx, $cy, -$cx, -$cy));
        $this->rotated = true;
    }

    private function endRotate(): void
    {
        if ($this->rotated) {
            $this->_out('Q');
            $this->rotated = false;
        }
    }
}

<?php

namespace App\Services\Printing;

/** Pure layout maths shared by the print composer (mirrors frontend utils/pagePlan.js and PageSheet/SheetPaper). */
final class PrintGeometry
{
    private const PAPER_MM = ['A4' => [210.0, 297.0], 'A5' => [148.0, 210.0], 'Letter' => [215.9, 279.4]];

    /** @return array{0:float,1:float} portrait [width, height] in mm */
    public static function paper(string $size): array
    {
        return self::PAPER_MM[$size] ?? self::PAPER_MM['A4'];
    }

    /** [columns, rows] for N images on a sheet. */
    public static function grid(int $perPage, bool $landscape): array
    {
        return match ($perPage) {
            2 => $landscape ? [2, 1] : [1, 2],
            4 => [2, 2],
            6 => $landscape ? [3, 2] : [2, 3],
            9 => [3, 3],
            default => [1, 1],
        };
    }

    /**
     * Box on the sheet where a page goes, as [x, y, w, h, mode] (mode: contain|cover|actual). Same boxes as the
     * on-screen preview so what the customer saw is what prints.
     */
    public static function pageBox(string $align, float $sheetW, float $sheetH): array
    {
        return match ($align) {
            'fill' => [0.0, 0.0, $sheetW, $sheetH, 'cover'],
            'center' => [$sheetW * 0.125, $sheetH * 0.125, $sheetW * 0.75, $sheetH * 0.75, 'contain'],
            'tl' => [0.0, 0.0, $sheetW * 0.75, $sheetH * 0.75, 'contain'],
            'edge' => [0.0, 0.0, $sheetW, $sheetH, 'contain'],
            'actual' => [0.0, 0.0, $sheetW, $sheetH, 'actual'],
            default => [$sheetW * 0.04, $sheetH * 0.04, $sheetW * 0.92, $sheetH * 0.92, 'contain'], // 'fit'
        };
    }

    /**
     * Cell boxes [x, y, w, h] for an image grid with `margin` mm around the sheet and between cells.
     *
     * @return array<int,array{0:float,1:float,2:float,3:float}>
     */
    public static function cells(int $perPage, bool $landscape, float $sheetW, float $sheetH, float $margin): array
    {
        [$cols, $rows] = self::grid($perPage, $landscape);
        $cw = ($sheetW - 2 * $margin - ($cols - 1) * $margin) / $cols;
        $ch = ($sheetH - 2 * $margin - ($rows - 1) * $margin) / $rows;
        $out = [];
        for ($r = 0; $r < $rows; $r++) {
            for ($c = 0; $c < $cols; $c++) {
                $out[] = [$margin + $c * ($cw + $margin), $margin + $r * ($ch + $margin), $cw, $ch];
            }
        }

        return $out;
    }

    /** Sheets of images: sequence packs in order; copies repeats each image `perPage` times on its own sheet. */
    public static function sheets(array $sheet): array
    {
        $images = array_values($sheet['images']);
        $perPage = (int) $sheet['per_page'];
        if (($sheet['mode'] ?? 'sequence') === 'copies') {
            return array_map(fn ($img) => array_fill(0, $perPage, $img), $images);
        }

        return array_chunk($images, $perPage);
    }

    /**
     * Size of the picture inside a box. contain = whole picture visible, cover = fills the box (cropped),
     * actual = real size at `dpi`. $w/$h are the picture's size AFTER rotation, in mm at 1:1 (for actual) or any unit (ratio).
     *
     * @return array{0:float,1:float} displayed [w, h] in mm
     */
    public static function fitSize(float $w, float $h, float $boxW, float $boxH, string $mode): array
    {
        if ($mode === 'actual') {
            return [$w, $h];
        }
        $s = $mode === 'cover' ? max($boxW / $w, $boxH / $h) : min($boxW / $w, $boxH / $h);

        return [$w * $s, $h * $s];
    }

    /** EXIF orientation tag (1-8) of a JPEG without needing the exif extension; 1 when absent/unreadable. */
    public static function jpegOrientation(string $path): int
    {
        $fh = @fopen($path, 'rb');
        if (! $fh) {
            return 1;
        }
        try {
            if (fread($fh, 2) !== "\xFF\xD8") {
                return 1;
            }
            for ($i = 0; $i < 20 && ! feof($fh); $i++) {
                $hdr = fread($fh, 4);
                if (strlen($hdr) < 4 || $hdr[0] !== "\xFF") {
                    return 1;
                }
                $marker = ord($hdr[1]);
                $len = unpack('n', substr($hdr, 2, 2))[1];
                if ($marker === 0xDA || $len < 2) {
                    return 1; // start of scan: no EXIF before pixels
                }
                $data = $len > 2 ? fread($fh, $len - 2) : '';
                if ($marker === 0xE1 && str_starts_with($data, "Exif\0\0")) {
                    return self::tiffOrientation(substr($data, 6));
                }
            }
        } finally {
            fclose($fh);
        }

        return 1;
    }

    private static function tiffOrientation(string $t): int
    {
        if (strlen($t) < 8) {
            return 1;
        }
        $le = substr($t, 0, 2) === 'II';
        $u16 = fn (int $o) => strlen($t) >= $o + 2 ? unpack($le ? 'v' : 'n', substr($t, $o, 2))[1] : null;
        $u32 = fn (int $o) => strlen($t) >= $o + 4 ? unpack($le ? 'V' : 'N', substr($t, $o, 4))[1] : null;
        $ifd = $u32(4);
        $count = $ifd === null ? null : $u16($ifd);
        if ($count === null || $count > 200) {
            return 1;
        }
        for ($i = 0; $i < $count; $i++) {
            $e = $ifd + 2 + $i * 12;
            if ($u16($e) === 0x0112) {
                $v = $u16($e + 8);

                return ($v !== null && $v >= 1 && $v <= 8) ? $v : 1;
            }
        }

        return 1;
    }

    /**
     * A crop the customer made on the upright picture (what the browser shows, EXIF applied), expressed on the stored
     * pixels, which may be turned by `$exifRotation` clockwise quarter turns to look upright.
     *
     * @param  array{l:float,t:float,r:float,b:float}  $c
     * @return array{l:float,t:float,r:float,b:float}
     */
    public static function cropToRaw(array $c, int $exifRotation): array
    {
        return match ($exifRotation % 360) {
            90 => ['l' => $c['t'], 't' => $c['r'], 'r' => $c['b'], 'b' => $c['l']],
            180 => ['l' => $c['r'], 't' => $c['b'], 'r' => $c['l'], 'b' => $c['t']],
            270 => ['l' => $c['b'], 't' => $c['l'], 'r' => $c['t'], 'b' => $c['r']],
            default => $c,
        };
    }

    /** Clockwise quarter turns needed to display a JPEG upright for an EXIF orientation. */
    public static function exifRotation(int $orientation): int
    {
        return [3 => 180, 6 => 90, 8 => 270][$orientation] ?? 0;
    }
}

<?php

namespace App\Services\Printing;

use App\Services\Pricing\PageRange;
use InvalidArgumentException;

/**
 * Builds the PDF that is actually printed from the customer's validated settings and edits:
 *  - documents: the converted PDF's pages are rasterised (Poppler `pdftoppm`) and placed on sheets of the chosen
 *    paper size and orientation with the customer's order, rotation, blanks, copies of a page and position;
 *  - images: laid out N to a sheet with margins, fit/fill and rotation.
 * Copies, duplex and colour are NOT baked in: they are print-job options so the printer handles them.
 * "Pages per sheet" (2, 4, 6, 9) packs the chosen pages, in order, onto each sheet.
 * An unedited document printed whole is sent as-is (`direct`) to keep its text sharp.
 */
final class PrintFileComposer
{
    /** Gap around and between the pages when several are printed on one sheet (mm). */
    public const NUP_MARGIN_MM = 8.0;

    public function __construct(
        private readonly string $pdftoppm = '',
        private readonly int $dpi = 300,
        private readonly int $timeoutSeconds = 120,
        private readonly int $maxPages = 500,
    ) {}

    public function available(): bool
    {
        return ShellRunner::find($this->pdftoppm, 'pdftoppm', ['/usr/bin/pdftoppm', '/usr/local/bin/pdftoppm', 'C:\\poppler\\Library\\bin\\pdftoppm.exe', 'C:\\Program Files\\poppler\\Library\\bin\\pdftoppm.exe']) !== null;
    }

    /** True when the original converted PDF can be sent untouched. */
    public static function isDirect(array $settings, string $kind): bool
    {
        return ! in_array($kind, ['jpg', 'png'], true)
            && empty($settings['edits'])
            && ($settings['scaling'] ?? 'fit') === 'fit'
            && ($settings['orientation'] ?? 'portrait') === 'portrait' // landscape needs the pages placed on a landscape sheet
            && (int) ($settings['pages_per_sheet'] ?? 1) === 1 // several pages to a sheet are composed
            && trim((string) ($settings['page_range'] ?? '')) === '';
    }

    /**
     * @param  array{kind:string,path?:string,page_count?:int,image_paths?:array<string,array{path:string,kind:string}>}  $source
     * @return array{pages:int}
     *
     * @throws PrintException
     */
    public function compose(array $settings, array $source, string $target, ?array $rasters = null): array
    {
        $landscape = ($settings['orientation'] ?? 'portrait') === 'landscape';
        [$pw, $ph] = PrintGeometry::paper((string) ($settings['paper_size'] ?? 'A4'));
        [$sw, $sh] = $landscape ? [$ph, $pw] : [$pw, $ph];

        try {
            return in_array($source['kind'], ['jpg', 'png'], true)
                ? $this->composeImages($settings, $source, $target, $landscape, $pw, $ph, $sw, $sh)
                : $this->composeDocument($settings, $source, $target, $landscape, $pw, $ph, $sw, $sh, $rasters);
        } catch (InvalidArgumentException $e) {
            throw new PrintException($e->getMessage());
        }
    }

    /**
     * Which source pages must be rendered to pictures, and how, for a document job. Used when another computer (the shop PC
     * print agent) does the rendering instead of this server.
     *
     * @return array{pages:list<int>,gray:bool,dpi:int}
     */
    public function plan(array $settings, array $source): array
    {
        $edits = $settings['edits']['pages'] ?? null;
        $plan = $edits ?? array_map(fn ($i) => ['src' => $i, 'rot' => 0, 'align' => null], range(1, max(1, (int) $source['page_count'])));
        try {
            $selected = PageRange::parse((string) ($settings['page_range'] ?? ''), count($plan));
        } catch (InvalidArgumentException $e) {
            throw new PrintException($e->getMessage());
        }
        if (count($selected) > $this->maxPages) {
            throw new PrintException('This job has too many pages to print.');
        }
        $needed = array_values(array_unique(array_filter(array_map(fn ($n) => $plan[$n - 1]['src'], $selected))));
        sort($needed);

        return ['pages' => array_map('intval', $needed), 'gray' => ($settings['color_mode'] ?? 'bw') === 'bw', 'dpi' => $this->dpi];
    }

    /** @param array<int,array{0:string,1:int,2:int}>|null $rasters pictures already rendered elsewhere: source page => [jpeg path, px w, px h] */
    private function composeDocument(array $settings, array $source, string $target, bool $landscape, float $pw, float $ph, float $sw, float $sh, ?array $rasters = null): array
    {
        $edits = $settings['edits']['pages'] ?? null;
        $plan = $edits ?? array_map(fn ($i) => ['src' => $i, 'rot' => 0, 'align' => null], range(1, max(1, (int) $source['page_count'])));
        $selected = PageRange::parse((string) ($settings['page_range'] ?? ''), count($plan));
        if (count($selected) > $this->maxPages) {
            throw new PrintException('This job has too many pages to print.');
        }
        $scaling = $settings['scaling'] ?? 'fit';
        $gray = ($settings['color_mode'] ?? 'bw') === 'bw';

        $dir = $this->workDir();
        try {
            $needed = array_values(array_unique(array_filter(array_map(fn ($n) => $plan[$n - 1]['src'], $selected))));
            $rasters ??= $this->rasterise($source['path'], $needed, $dir, $gray);
            foreach ($needed as $n) {
                if (! isset($rasters[$n]) || ! is_file($rasters[$n][0])) {
                    throw new PrintException("Page {$n} could not be prepared for printing.");
                }
            }

            $pdf = new TransformPdf('P', 'mm');
            $pdf->SetAutoPageBreak(false);
            $pdf->SetCreator('Taprint');
            $perSheet = max(1, (int) ($settings['pages_per_sheet'] ?? 1));
            // N pages to a sheet: the chosen (and edited) pages are packed in order, N to each printed sheet.
            $sheets = array_chunk(array_values($selected), $perSheet);
            $cells = $perSheet > 1 ? PrintGeometry::cells($perSheet, $landscape, $sw, $sh, self::NUP_MARGIN_MM) : null;
            foreach ($sheets as $si => $group) {
                $pdf->AddPage($landscape ? 'L' : 'P', [$pw, $ph]);
                foreach ($group as $ci => $n) {
                    $item = $plan[$n - 1];
                    if ($cells !== null) {
                        [$bx, $by, $bw, $bh] = $cells[$ci];
                        $mode = 'contain';
                    } else {
                        $align = $edits !== null ? ($item['align'] ?? 'fit') : match ($scaling) {
                            'fill' => 'fill', 'actual' => 'actual', default => 'edge',
                        };
                        [$bx, $by, $bw, $bh, $mode] = PrintGeometry::pageBox($align, $sw, $sh);
                    }
                    if ($item['src'] === null) {
                        // customer-added blank page: it can still carry typed text
                        $this->drawMarks($pdf, $item['marks'] ?? [], [$bx, $by, $bw, $bh], [$bx, $by, $bw, $bh]);
                        if ($cells !== null) {
                            $pdf->cellFrame($bx, $by, $bw, $bh);
                        }
                        continue;
                    }
                    [$file, $px, $py] = $rasters[$item['src']];
                    $mmW = $px / $this->dpi * 25.4;
                    $mmH = $py / $this->dpi * 25.4;
                    $rect = $pdf->placeInBox($file, 'JPG', $px, $py, (int) ($item['rot'] ?? 0), $bx, $by, $bw, $bh, $mode, $mmW, $mmH);
                    $this->drawMarks($pdf, $item['marks'] ?? [], $rect, [$bx, $by, $bw, $bh]);
                    if ($cells !== null) {
                        // a hairline around each slide keeps white slides apart on the sheet
                        $pdf->cellFrame($rect[0], $rect[1], $rect[2], $rect[3]);
                    }
                }
                $this->drawStamp($pdf, $settings['edits']['stamp'] ?? null, $sw, $sh, $si + 1, count($sheets));
            }
            $pdf->Output('F', $target);
        } finally {
            $this->deleteDir($dir);
        }

        return ['pages' => count($sheets)];
    }

    /**
     * Customer drawings on top of a page: white-out, highlight and typed text. `$rect` is the picture as displayed;
     * the marks' 0-1 coordinates are relative to it. Everything is clipped to the page box.
     *
     * @param  list<array<string,mixed>>  $marks
     * @param  array{0:float,1:float,2:float,3:float}  $rect  x, y, w, h (mm)
     * @param  array{0:float,1:float,2:float,3:float}  $box  clip box (mm)
     */
    private function drawMarks(TransformPdf $pdf, array $marks, array $rect, array $box): void
    {
        if ($marks === []) {
            return;
        }
        [$rx, $ry, $rw, $rh] = $rect;
        $pdf->clip($box[0], $box[1], $box[2], $box[3]);
        foreach ($marks as $m) {
            $x = $rx + $m['x'] * $rw;
            $y = $ry + $m['y'] * $rh;
            $w = $m['w'] * $rw;
            $h = $m['h'] * $rh;
            switch ($m['t']) {
                case 'cover':
                    $pdf->markRect($x, $y, $w, $h, $m['color'] ?? '#ffffff');
                    break;
                case 'hl':
                    $pdf->markRect($x, $y, $w, $h, $m['color'] ?? '#ffe600', 0.4);
                    break;
                case 'text':
                    if (! empty($m['cover'])) {
                        $pdf->markRect($x, $y, $w, $h, '#ffffff');
                    }
                    if (trim((string) ($m['text'] ?? '')) !== '') {
                        $pt = max(4.0, (float) ($m['fs'] ?? 0.02) * $rh * 72 / 25.4);
                        $pdf->markText($x, $y, $w, $h, (string) $m['text'], $pt, $m['color'] ?? '#000000', ! empty($m['bold']), (string) ($m['align'] ?? 'l'));
                    }
                    break;
            }
        }
        $pdf->endClip();
    }

    /** Page number (bottom centre) and diagonal watermark on every output page. */
    private function drawStamp(TransformPdf $pdf, ?array $stamp, float $sw, float $sh, int $number, int $total): void
    {
        if ($stamp === null) {
            return;
        }
        $wm = trim((string) ($stamp['watermark'] ?? ''));
        if ($wm !== '') {
            $len = max(4, mb_strlen($wm));
            // size so the text spans about 70% of the sheet diagonal
            $diag = sqrt($sw * $sw + $sh * $sh);
            $pt = min(110.0, max(18.0, ($diag * 0.7 / $len) * 72 / 25.4 / 0.55));
            $pdf->stampText($sw / 2, $sh / 2, $wm, $pt, '#808080', 0.16, rad2deg(atan2($sh, $sw)), true);
        }
        if (! empty($stamp['numbers'])) {
            $pdf->stampText($sw / 2, $sh - 7.0, $number.' / '.$total, 9.0, '#555555');
        }
    }

    private function composeImages(array $settings, array $source, string $target, bool $landscape, float $pw, float $ph, float $sw, float $sh): array
    {
        $sheet = $settings['edits']['sheet'] ?? [
            'per_page' => 1, 'mode' => 'sequence', 'fit' => 'fit', 'margin' => 5,
            'images' => [['document_id' => $source['id'], 'rot' => 0]],
        ];
        $sheets = PrintGeometry::sheets($sheet);
        $selected = PageRange::parse((string) ($settings['page_range'] ?? ''), count($sheets));
        if (count($selected) > $this->maxPages) {
            throw new PrintException('This job has too many pages to print.');
        }
        $cells = PrintGeometry::cells((int) $sheet['per_page'], $landscape, $sw, $sh, (float) $sheet['margin']);
        $mode = ($sheet['fit'] ?? 'fit') === 'fill' ? 'cover' : 'contain';

        $temps = [];
        $pdf = new TransformPdf('P', 'mm');
        $pdf->SetAutoPageBreak(false);
        $pdf->SetCreator('Taprint');
        foreach ($selected as $n) {
            $pdf->AddPage($landscape ? 'L' : 'P', [$pw, $ph]);
            foreach ($sheets[$n - 1] as $i => $img) {
                $info = $source['image_paths'][$img['document_id']] ?? null;
                if ($info === null || ! is_file($info['path'])) {
                    throw new PrintException('One of the images is no longer available.');
                }
                $size = @getimagesize($info['path']);
                if ($size === false) {
                    throw new PrintException('One of the images could not be read.');
                }
                $type = $info['kind'] === 'png' ? 'PNG' : 'JPG';
                $exif = $type === 'JPG' ? PrintGeometry::exifRotation(PrintGeometry::jpegOrientation($info['path'])) : 0;
                $rot = ((int) ($img['rot'] ?? 0) + $exif) % 360;
                $crop = isset($img['crop']) ? PrintGeometry::cropToRaw($img['crop'], $exif) : null; // the customer cropped the upright picture
                [$bx, $by, $bw, $bh] = $cells[$i];
                $path = $info['path'];
                if (! empty($img['adjust'])) { // brightness / contrast / enhance: the processed copy is already upright
                    $done = ImageEnhancer::process($path, $type, $exif, $img['adjust'], max($bw, $bh) * (float) ($img['zoom'] ?? 1), sys_get_temp_dir());
                    if ($done !== null) {
                        $temps[] = $done['path'];
                        $path = $done['path'];
                        $size = [$done['w'], $done['h']];
                        $rot = (int) ($img['rot'] ?? 0) % 360;
                        $crop = $img['crop'] ?? null;
                    }
                }
                $pdf->placeInBox($path, $type, $size[0], $size[1], $rot, $bx, $by, $bw, $bh, $mode, 0, 0,
                    (float) ($img['x'] ?? 0), (float) ($img['y'] ?? 0), (float) ($img['zoom'] ?? 1), $crop);
            }
        }
        $pdf->Output('F', $target);
        foreach ($temps as $t) {
            @unlink($t);
        }

        return ['pages' => count($selected)];
    }

    /** @return array<int,array{0:string,1:int,2:int}> source page => [jpeg path, px width, px height] */
    private function rasterise(string $pdfPath, array $pages, string $dir, bool $gray): array
    {
        $bin = ShellRunner::find($this->pdftoppm, 'pdftoppm', ['/usr/bin/pdftoppm', '/usr/local/bin/pdftoppm', 'C:\\poppler\\Library\\bin\\pdftoppm.exe', 'C:\\Program Files\\poppler\\Library\\bin\\pdftoppm.exe']);
        if ($bin === null) {
            throw new PrintException('The page renderer (Poppler pdftoppm) is not installed on the server.');
        }
        $out = [];
        foreach ($pages as $p) {
            $prefix = $dir.DIRECTORY_SEPARATOR.'p'.$p;
            $cmd = [$bin, '-r', (string) $this->dpi, '-f', (string) $p, '-l', (string) $p, '-jpeg', '-jpegopt', 'quality=92'];
            if ($gray) {
                $cmd[] = '-gray';
            }
            array_push($cmd, $pdfPath, $prefix);
            $r = ShellRunner::run($cmd, $this->timeoutSeconds);
            $files = glob($prefix.'-*.jpg') ?: [];
            if ($r['exit'] !== 0 || $files === []) {
                throw new PrintException("Page {$p} could not be prepared for printing.");
            }
            $size = @getimagesize($files[0]);
            if ($size === false) {
                throw new PrintException("Page {$p} could not be prepared for printing.");
            }
            $out[$p] = [$files[0], $size[0], $size[1]];
        }

        return $out;
    }

    private function workDir(): string
    {
        $d = sys_get_temp_dir().DIRECTORY_SEPARATOR.'pb-print-'.bin2hex(random_bytes(6));
        if (! @mkdir($d, 0770, true) && ! is_dir($d)) {
            throw new PrintException('Could not create a working folder for printing.');
        }

        return $d;
    }

    private function deleteDir(string $dir): void
    {
        foreach (glob($dir.DIRECTORY_SEPARATOR.'*') ?: [] as $f) {
            @unlink($f);
        }
        @rmdir($dir);
    }
}

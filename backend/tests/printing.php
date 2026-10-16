<?php
// Print composition and printer drivers. Included by tests/run.php.
require_once __DIR__ . '/../app/Services/Pricing/PageRange.php';
require_once __DIR__ . '/../app/Services/Pricing/PagePlan.php';
foreach (['PrintException', 'PrintGeometry', 'ShellRunner', 'TransformPdf', 'PrintFileComposer', 'PrinterDriver', 'CupsPrinter', 'SumatraPrinter', 'FilePrinter'] as $c) {
    require_once __DIR__ . "/../app/Services/Printing/$c.php";
}
require_once __DIR__ . '/../vendor/setasign/fpdf/fpdf.php';

use App\Services\Pricing\PagePlan;
use App\Services\Printing\{CupsPrinter, FilePrinter, PrintException, PrintFileComposer, PrintGeometry, SumatraPrinter};

echo "\n-- print geometry --\n";
check('grid follows orientation', PrintGeometry::grid(2, false) === [1, 2] && PrintGeometry::grid(2, true) === [2, 1] && PrintGeometry::grid(6, false) === [2, 3] && PrintGeometry::grid(4, true) === [2, 2]);
$cells = PrintGeometry::cells(2, false, 210.0, 297.0, 5.0);
check('2-up cells: 5mm margin and gap, equal height', count($cells) === 2 && abs($cells[0][1] - 5) < 1e-9 && abs($cells[0][3] - 141) < 1e-9 && abs($cells[1][1] - 151) < 1e-9);
check('sequence sheets pack in order', PrintGeometry::sheets(['per_page' => 2, 'mode' => 'sequence', 'images' => [1, 2, 3]]) === [[1, 2], [3]]);
check('copies sheets repeat each image', PrintGeometry::sheets(['per_page' => 4, 'mode' => 'copies', 'images' => ['a', 'b']]) === [['a', 'a', 'a', 'a'], ['b', 'b', 'b', 'b']]);
[$w, $h] = PrintGeometry::fitSize(100, 50, 40, 40, 'contain'); check('contain keeps whole picture', abs($w - 40) < 1e-9 && abs($h - 20) < 1e-9);
[$w, $h] = PrintGeometry::fitSize(100, 50, 40, 40, 'cover'); check('cover fills the box', abs($w - 80) < 1e-9 && abs($h - 40) < 1e-9);
check('paper sizes', PrintGeometry::paper('Letter') === [215.9, 279.4] && PrintGeometry::paper('nope') === [210.0, 297.0]);

$jpeg = function (int $w, int $h, array $leftRgb, array $rightRgb, int $orientation = 1): string {
    $im = imagecreatetruecolor($w, $h);
    imagefilledrectangle($im, 0, 0, intdiv($w, 2) - 1, $h, imagecolorallocate($im, ...$leftRgb));
    imagefilledrectangle($im, intdiv($w, 2), 0, $w, $h, imagecolorallocate($im, ...$rightRgb));
    $f = tempnam(sys_get_temp_dir(), 'pbj') . '.jpg';
    imagejpeg($im, $f, 95);
    if ($orientation !== 1) { // inject an EXIF APP1 segment carrying the orientation tag (little endian)
        $tiff = "II\x2A\x00\x08\x00\x00\x00" . pack('v', 1) . pack('vvVv', 0x0112, 3, 1, $orientation) . "\x00\x00" . "\x00\x00\x00\x00";
        $seg = "\xFF\xE1" . pack('n', 2 + 6 + strlen($tiff)) . "Exif\0\0" . $tiff;
        $raw = file_get_contents($f);
        file_put_contents($f, substr($raw, 0, 2) . $seg . substr($raw, 2));
    }
    return $f;
};
check('EXIF orientation is read without the exif extension', PrintGeometry::jpegOrientation($jpeg(20, 10, [255, 0, 0], [0, 0, 255], 6)) === 6 && PrintGeometry::jpegOrientation($jpeg(20, 10, [255, 0, 0], [0, 0, 255])) === 1);
check('EXIF orientation -> clockwise turns', PrintGeometry::exifRotation(6) === 90 && PrintGeometry::exifRotation(3) === 180 && PrintGeometry::exifRotation(8) === 270 && PrintGeometry::exifRotation(1) === 0);

echo "\n-- print composer (renders real PDFs) --\n";
$composer = new PrintFileComposer('', 100);
if (!$composer->available()) {
    echo "  skip Poppler pdftoppm not installed\n";
} else {
    // Source: three solid pages, red / green / blue.
    $solid = function (array $colors): string {
        $f = tempnam(sys_get_temp_dir(), 'pbs') . '.pdf';
        $p = new FPDF('P', 'mm', 'A4');
        foreach ($colors as $c) { $p->AddPage(); $p->SetFillColor(...$c); $p->Rect(0, 0, 210, 297, 'F'); }
        $p->Output('F', $f);
        return $f;
    };
    $src = $solid([[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
    // pixel (0..1 fractions) of page n of a pdf -> [r,g,b]
    $px = function (string $pdf, int $n, float $fx, float $fy): array {
        $pre = tempnam(sys_get_temp_dir(), 'pbr');
        shell_exec(sprintf('pdftoppm -r 40 -f %d -l %d -jpeg %s %s 2>/dev/null', $n, $n, escapeshellarg($pdf), escapeshellarg($pre)));
        $f = glob($pre . '-*.jpg')[0]; $im = imagecreatefromjpeg($f);
        $rgb = imagecolorat($im, (int) ((imagesx($im) - 1) * $fx), (int) ((imagesy($im) - 1) * $fy));
        foreach (glob($pre . '*') as $x) { @unlink($x); }
        return [($rgb >> 16) & 255, ($rgb >> 8) & 255, $rgb & 255];
    };
    $is = fn(array $got, array $want) => abs($got[0] - $want[0]) < 40 && abs($got[1] - $want[1]) < 40 && abs($got[2] - $want[2]) < 40;
    $pages = fn(string $pdf) => (int) preg_match_all('/\/Type\s*\/Page[^s]/', (string) file_get_contents($pdf));
    $base = ['page_range' => '', 'copies' => 1, 'color_mode' => 'color', 'paper_size' => 'A4', 'orientation' => 'portrait', 'duplex' => false, 'scaling' => 'fit', 'edits' => null];
    $source = ['kind' => 'pdf', 'path' => $src, 'page_count' => 3];

    check('unedited whole document is sent directly (keeps text sharp)', PrintFileComposer::isDirect($base, 'pdf') && !PrintFileComposer::isDirect(['page_range' => '1'] + $base, 'pdf') && !PrintFileComposer::isDirect(['scaling' => 'fill'] + $base, 'pdf') && !PrintFileComposer::isDirect(['orientation' => 'landscape'] + $base, 'pdf') && !PrintFileComposer::isDirect($base, 'png'));

    $out = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $r = $composer->compose(['edits' => ['pages' => [
        ['src' => 3, 'rot' => 0, 'align' => 'fill'], ['src' => 1, 'rot' => 0, 'align' => 'fill'],
        ['src' => null, 'rot' => 0, 'align' => 'fit'], ['src' => 2, 'rot' => 90, 'align' => 'fill'],
    ]]] + $base, $source, $out);
    check('edited plan: 4 output pages, in the customer\'s order', $r['pages'] === 4 && $pages($out) === 4);
    check('page 1 is source page 3 (blue)', $is($px($out, 1, .5, .5), [0, 0, 255]));
    check('page 2 is source page 1 (red)', $is($px($out, 2, .5, .5), [255, 0, 0]));
    check('page 3 is a blank sheet', $is($px($out, 3, .5, .5), [255, 255, 255]));
    check('page 4 is source page 2 (green), rotated', $is($px($out, 4, .5, .5), [0, 255, 0]));

    $out2 = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $composer->compose(['edits' => ['pages' => [['src' => 1, 'rot' => 0, 'align' => 'tl'], ['src' => 1, 'rot' => 0, 'align' => 'center'], ['src' => 1, 'rot' => 0, 'align' => 'fit']]]] + $base, $source, $out2);
    check('top-left: ink at the top-left, white at the bottom-right', $is($px($out2, 1, .1, .1), [255, 0, 0]) && $is($px($out2, 1, .95, .95), [255, 255, 255]));
    check('centre: ink in the middle, white corners', $is($px($out2, 2, .5, .5), [255, 0, 0]) && $is($px($out2, 2, .03, .03), [255, 255, 255]) && $is($px($out2, 2, .95, .95), [255, 255, 255]));
    check('fit: a white border around the page', $is($px($out2, 3, .5, .5), [255, 0, 0]) && $is($px($out2, 3, .01, .01), [255, 255, 255]));

    $out3 = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $r = $composer->compose(['page_range' => '2-3', 'scaling' => 'fill'] + $base, $source, $out3);
    check('page range selects among the pages; scaling fill covers the sheet', $r['pages'] === 2 && $is($px($out3, 1, .02, .02), [0, 255, 0]) && $is($px($out3, 2, .98, .98), [0, 0, 255]));

    $out4 = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $composer->compose(['page_range' => '1', 'orientation' => 'landscape', 'paper_size' => 'Letter'] + $base, $source, $out4);
    $mb = (string) file_get_contents($out4);
    check('Letter landscape sheet size', preg_match('/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/', $mb, $m) && abs($m[1] - 792) < 1 && abs($m[2] - 612) < 1);

    echo "\n-- pages per sheet (slides) --\n";
    check('several pages per sheet is never sent directly', !PrintFileComposer::isDirect(['pages_per_sheet' => 2] + $base, 'pdf') && PrintFileComposer::isDirect(['pages_per_sheet' => 1] + $base, 'pdf'));
    $o2 = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $r = $composer->compose(['pages_per_sheet' => 2] + $base, $source, $o2);
    check('3 pages at 2 per sheet = 2 sheets', $r['pages'] === 2 && $pages($o2) === 2);
    check('2 per sheet: page 1 on top, page 2 below (portrait sheet)', $is($px($o2, 1, .5, .25), [255, 0, 0]) && $is($px($o2, 1, .5, .75), [0, 255, 0]));
    check('2 per sheet: sheet 2 has page 3 on top and an empty cell below', $is($px($o2, 2, .5, .25), [0, 0, 255]) && $is($px($o2, 2, .5, .75), [255, 255, 255]));
    $o4 = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $r = $composer->compose(['pages_per_sheet' => 4] + $base, $source, $o4);
    check('4 per sheet: one sheet, 2x2 grid in reading order', $r['pages'] === 1 && $is($px($o4, 1, .25, .25), [255, 0, 0]) && $is($px($o4, 1, .75, .25), [0, 255, 0]) && $is($px($o4, 1, .25, .75), [0, 0, 255]) && $is($px($o4, 1, .75, .75), [255, 255, 255]));
    $o9 = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $r = $composer->compose(['pages_per_sheet' => 9] + $base, $source, $o9);
    check('9 per sheet: 3x3 grid, first three cells filled', $r['pages'] === 1 && $is($px($o9, 1, .17, .17), [255, 0, 0]) && $is($px($o9, 1, .5, .17), [0, 255, 0]) && $is($px($o9, 1, .83, .17), [0, 0, 255]) && $is($px($o9, 1, .5, .5), [255, 255, 255]));
    $oL = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $composer->compose(['pages_per_sheet' => 2, 'orientation' => 'landscape'] + $base, $source, $oL);
    check('2 per sheet on a landscape sheet sits side by side', $is($px($oL, 1, .25, .5), [255, 0, 0]) && $is($px($oL, 1, .75, .5), [0, 255, 0]));
    $oR = tempnam(sys_get_temp_dir(), 'pbo') . '.pdf';
    $r = $composer->compose(['pages_per_sheet' => 2, 'page_range' => '2-3'] + $base, $source, $oR);
    check('page range is applied first, then packed: pages 2+3 on one sheet', $r['pages'] === 1 && $is($px($oR, 1, .5, .25), [0, 255, 0]) && $is($px($oR, 1, .5, .75), [0, 0, 255]));

    $bad = false; try { $composer->compose(['page_range' => '9'] + $base, $source, $out); } catch (PrintException $e) { $bad = true; }
    check('page range beyond the document is refused', $bad);

    echo "\n-- image sheets --\n";
    $red = $jpeg(60, 30, [255, 0, 0], [255, 0, 0]);
    $blue = $jpeg(60, 30, [0, 0, 255], [0, 0, 255]);
    $split = $jpeg(80, 40, [255, 0, 0], [0, 0, 255]); // red left, blue right
    $imgs = ['r' => ['path' => $red, 'kind' => 'jpg'], 'b' => ['path' => $blue, 'kind' => 'jpg'], 's' => ['path' => $split, 'kind' => 'jpg']];
    $isrc = fn(string $id) => ['kind' => 'jpg', 'id' => $id, 'image_paths' => $imgs];
    $sheet = fn(array $o) => ['edits' => ['sheet' => $o + ['per_page' => 2, 'mode' => 'sequence', 'fit' => 'fit', 'margin' => 5, 'images' => [['document_id' => 'r', 'rot' => 0], ['document_id' => 'b', 'rot' => 0]]]]] + $base;

    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $r = $composer->compose($sheet([]), $isrc('r'), $o);
    check('2 images, 2 per page: one sheet, top red, bottom blue', $r['pages'] === 1 && $is($px($o, 1, .5, .25), [255, 0, 0]) && $is($px($o, 1, .5, .75), [0, 0, 255]));
    check('margin keeps the edge of the sheet white', $is($px($o, 1, .01, .01), [255, 255, 255]));

    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $r = $composer->compose($sheet(['mode' => 'copies', 'per_page' => 4, 'images' => [['document_id' => 'r', 'rot' => 0]]]), $isrc('r'), $o);
    check('4 copies of one image on a single sheet (all four cells red)', $r['pages'] === 1 && $is($px($o, 1, .25, .25), [255, 0, 0]) && $is($px($o, 1, .75, .25), [255, 0, 0]) && $is($px($o, 1, .25, .75), [255, 0, 0]) && $is($px($o, 1, .75, .75), [255, 0, 0]));

    // dragging: a half-size picture pushed left by a quarter of the sheet lands in the left half
    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $composer->compose($sheet(['per_page' => 1, 'margin' => 0, 'images' => [['document_id' => 'r', 'rot' => 0]]]), $isrc('r'), $o);
    check('centred picture covers the middle of the sheet', $is($px($o, 1, .5, .5), [255, 0, 0]));
    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $composer->compose($sheet(['per_page' => 1, 'margin' => 0, 'images' => [['document_id' => 'r', 'rot' => 0, 'x' => -0.25, 'zoom' => 0.5]]]), $isrc('r'), $o);
    check('dragged left and made smaller: red on the left, white on the right', $is($px($o, 1, .25, .5), [255, 0, 0]) && $is($px($o, 1, .75, .5), [255, 255, 255]));
    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $composer->compose($sheet(['per_page' => 1, 'margin' => 0, 'images' => [['document_id' => 'r', 'rot' => 0, 'y' => -0.4, 'zoom' => 0.5]]]), $isrc('r'), $o);
    check('dragged up: red near the top, white at the bottom', $is($px($o, 1, .5, .1), [255, 0, 0]) && $is($px($o, 1, .5, .9), [255, 255, 255]));
    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $composer->compose($sheet(['per_page' => 2, 'margin' => 0, 'images' => [['document_id' => 'r', 'rot' => 0, 'x' => 0.5, 'zoom' => 2], ['document_id' => 'b', 'rot' => 0]]]), $isrc('r'), $o);
    check('a big dragged picture is clipped to its own cell (the next cell stays blue)', $is($px($o, 1, .5, .75), [0, 0, 255]));

    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $composer->compose($sheet(['per_page' => 1, 'margin' => 0, 'fit' => 'fill', 'images' => [['document_id' => 's', 'rot' => 0]]]), $isrc('s'), $o);
    check('unrotated: red on the left, blue on the right', $is($px($o, 1, .1, .5), [255, 0, 0]) && $is($px($o, 1, .9, .5), [0, 0, 255]));
    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $composer->compose($sheet(['per_page' => 1, 'margin' => 0, 'fit' => 'fill', 'images' => [['document_id' => 's', 'rot' => 90]]]), $isrc('s'), $o);
    check('rotated 90° clockwise: red moves to the top, blue to the bottom', $is($px($o, 1, .5, .1), [255, 0, 0]) && $is($px($o, 1, .5, .9), [0, 0, 255]));
    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $composer->compose($sheet(['per_page' => 1, 'margin' => 0, 'fit' => 'fill', 'images' => [['document_id' => 's', 'rot' => 270]]]), $isrc('s'), $o);
    check('rotated 270° clockwise: blue at the top', $is($px($o, 1, .5, .1), [0, 0, 255]) && $is($px($o, 1, .5, .9), [255, 0, 0]));
    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $composer->compose($sheet(['per_page' => 1, 'margin' => 0, 'fit' => 'fill', 'images' => [['document_id' => 's', 'rot' => 0]]]), ['kind' => 'jpg', 'id' => 'e', 'image_paths' => ['s' => ['path' => $jpeg(80, 40, [255, 0, 0], [0, 0, 255], 6), 'kind' => 'jpg'], 'e' => ['path' => $jpeg(80, 40, [255, 0, 0], [0, 0, 255], 6), 'kind' => 'jpg']]], $o);
    check('phone photo with EXIF "rotate 90" prints upright (red on top)', $is($px($o, 1, .5, .1), [255, 0, 0]));

    $o = tempnam(sys_get_temp_dir(), 'pbi') . '.pdf';
    $r = $composer->compose(['edits' => null] + $base, $isrc('r'), $o);
    check('an unedited single image prints on one sheet', $r['pages'] === 1 && $is($px($o, 1, .5, .5), [255, 0, 0]));

    $r = $composer->compose(array_merge($sheet(['images' => array_map(fn($i) => ['document_id' => $i, 'rot' => 0], ['r', 'b', 'r', 'b', 'r'])]), ['page_range' => '2-3']), $isrc('r'), $o);
    check('page range applies to sheets (5 images 2-up = 3 sheets, pick 2-3)', $r['pages'] === 2);
    $bad = false; try { $composer->compose($sheet(['images' => [['document_id' => 'zzz', 'rot' => 0]]]), $isrc('r'), $o); } catch (PrintException) { $bad = true; }
    check('a missing image fails clearly instead of printing blanks', $bad);
}

echo "\n-- printer drivers --\n";
$job = ['reference' => 'PB-1', 'title' => 'My file; rm -rf /', 'copies' => 3, 'color' => false, 'duplex' => true, 'landscape' => false, 'paper' => 'A4', 'direct' => false];
$cups = new CupsPrinter('', 'Front_Desk', 30, fn() => ['exit' => 0, 'out' => 'request id is Front_Desk-42 (1 file(s))', 'err' => '']);
$cmd = $cups->command('/tmp/x.pdf', $job);
check('CUPS: printer, copies, duplex, mono, media passed as separate arguments', in_array('Front_Desk', $cmd, true) && in_array('3', $cmd, true) && in_array('sides=two-sided-long-edge', $cmd, true) && in_array('print-color-mode=monochrome', $cmd, true) && in_array('media=A4', $cmd, true));
check('CUPS: title cannot inject arguments and the file follows `--`', !in_array('My file; rm -rf /', $cmd, true) && $cmd[count($cmd) - 2] === '--' && end($cmd) === '/tmp/x.pdf');
check('CUPS: landscape duplex flips on the short edge, single is one-sided', in_array('sides=two-sided-short-edge', $cups->command('/x', ['landscape' => true] + $job), true) && in_array('sides=one-sided', $cups->command('/x', ['duplex' => false] + $job), true));
check('CUPS: copies are clamped 1..100', in_array('100', $cups->command('/x', ['copies' => 9999] + $job), true) && in_array('1', $cups->command('/x', ['copies' => 0] + $job), true));
check('CUPS: job id parsed from lp output', $cups->send('/tmp/x.pdf', $job) === 'Front_Desk-42');
$threw = null; try { (new CupsPrinter('', '', 30, fn() => ['exit' => 1, 'out' => '', 'err' => 'lp: Destination offline']))->send('/x', $job); } catch (PrintException $e) { $threw = $e; }
check('CUPS: a rejected job is retryable and hides lp\'s raw output', $threw && $threw->retryable && !str_contains($threw->getMessage(), 'offline'));
$sum = new SumatraPrinter('', 'HP LaserJet', 60, fn() => ['exit' => 0, 'out' => '', 'err' => '']);
$cmd = $sum->command('C:\\x.pdf', $job);
check('Sumatra: silent print-to with copies, duplex, monochrome, paper', $cmd[1] === '-print-to' && $cmd[2] === 'HP LaserJet' && in_array('-silent', $cmd, true) && $cmd[4] === '3x,duplexlong,monochrome,paper=a4,fit');
check('Sumatra: default printer when none named', in_array('-print-to-default', (new SumatraPrinter('', '', 60, fn() => ['exit' => 0, 'out' => '', 'err' => '']))->command('x', $job), true));
$dir = sys_get_temp_dir() . '/pb-printed-' . bin2hex(random_bytes(3));
$tmp = tempnam(sys_get_temp_dir(), 'pbp'); file_put_contents($tmp, '%PDF-1.4 test');
$name = (new FilePrinter($dir))->send($tmp, $job);
check('File driver saves the PDF and its print options', is_file("$dir/$name") && count(glob("$dir/*.json")) === 1 && str_contains((string) file_get_contents(glob("$dir/*.json")[0]), '"copies": 3'));
foreach (glob("$dir/*") as $f) { @unlink($f); } @rmdir($dir);

echo "\n-- marks on a PDF page (edit in place) --\n";
if ($composer->available()) {
    $white = $solid([[255, 255, 255], [255, 255, 255]]);
    $wsrc = ['kind' => 'pdf', 'path' => $white, 'page_count' => 2];
    $mk = fn(array $marks, ?array $stamp = null) => ['edits' => ['pages' => [['src' => 1, 'rot' => 0, 'align' => 'fill', 'marks' => $marks], ['src' => 2, 'rot' => 0, 'align' => 'fill']]] + ($stamp ? ['stamp' => $stamp] : [])] + $base;
    $o = tempnam(sys_get_temp_dir(), 'pbk') . '.pdf';
    $composer->compose($mk([
        ['t' => 'cover', 'x' => 0.1, 'y' => 0.1, 'w' => 0.2, 'h' => 0.1, 'color' => '#ff0000'],
        ['t' => 'hl', 'x' => 0.5, 'y' => 0.1, 'w' => 0.3, 'h' => 0.1, 'color' => '#0000ff'],
        ['t' => 'text', 'x' => 0.1, 'y' => 0.4, 'w' => 0.6, 'h' => 0.1, 'text' => 'HELLO WORLD', 'fs' => 0.05, 'color' => '#000000', 'bold' => true, 'align' => 'l', 'cover' => true],
    ]), $wsrc, $o);
    check('white-out rectangle is drawn solid red where asked', $is($px($o, 1, .2, .15), [255, 0, 0]) && $is($px($o, 1, .8, .5), [255, 255, 255]));
    $hl = $px($o, 1, .65, .15);
    check('highlight is see-through (a tint, not solid blue)', $hl[2] > 200 && $hl[0] > 60 && $hl[0] < 230);
    // dark pixels exist inside the text box, none elsewhere on the white page
    $dark = function (string $pdf, int $n, array $box, int $thr = 100) {
        $pre = tempnam(sys_get_temp_dir(), 'pbd');
        shell_exec(sprintf('pdftoppm -r 40 -f %d -l %d -jpeg %s %s 2>/dev/null', $n, $n, escapeshellarg($pdf), escapeshellarg($pre)));
        $f = glob($pre . '-*.jpg')[0]; $im = imagecreatefromjpeg($f); $W = imagesx($im); $H = imagesy($im); $c = 0;
        for ($x = (int) ($box[0] * $W); $x < (int) ($box[2] * $W); $x++) for ($y = (int) ($box[1] * $H); $y < (int) ($box[3] * $H); $y++) { if ((imagecolorat($im, $x, $y) & 255) < $thr) { $c++; } }
        foreach (glob($pre . '*') as $x2) { @unlink($x2); }
        return $c;
    };
    check('typed text appears inside its box', $dark($o, 1, [.1, .4, .7, .5]) > 15 && $dark($o, 1, [.1, .6, .9, .9]) === 0);
    check('the other page is untouched', $dark($o, 2, [0, 0, 1, 1]) === 0);

    $o2 = tempnam(sys_get_temp_dir(), 'pbk') . '.pdf';
    $composer->compose($mk([], ['numbers' => true, 'watermark' => 'CONFIDENTIAL']), $wsrc, $o2);
    check('page number printed at the bottom and a watermark across the page', $dark($o2, 1, [.35, .94, .65, .99], 245) > 2 && $dark($o2, 2, [.35, .94, .65, .99], 245) > 2);
    $wmDark = (function () use ($o2, $px) { $c = $px($o2, 1, .5, .5); return $c; })();
    check('watermark is faint (grey, not black)', $wmDark[0] > 150 || $wmDark === [255, 255, 255]);

    $o3 = tempnam(sys_get_temp_dir(), 'pbk') . '.pdf';
    $composer->compose(['edits' => ['pages' => [['src' => null, 'rot' => 0, 'align' => 'fit', 'marks' => [['t' => 'text', 'x' => .1, 'y' => .1, 'w' => .8, 'h' => .15, 'text' => 'Typed on a blank page', 'fs' => .05, 'color' => '#000000', 'bold' => false, 'align' => 'l', 'cover' => false]]], ['src' => 1, 'rot' => 0, 'align' => 'fit']]]] + $base, $wsrc, $o3);
    check('a blank page can carry typed text', $dark($o3, 1, [.1, .1, .9, .25]) > 10);

    $o4 = tempnam(sys_get_temp_dir(), 'pbk') . '.pdf';
    $composer->compose($mk([['t' => 'text', 'x' => .1, 'y' => .1, 'w' => .8, 'h' => .1, 'text' => "Caf\u{e9} na\u{ef}ve \u{20b9}500 \u{0939}\u{093f}", 'fs' => .03, 'color' => '#000000', 'bold' => false, 'align' => 'c', 'cover' => false]]), $wsrc, $o4);
    check('non-Latin characters do not crash the print', is_file($o4) && filesize($o4) > 500);
}

echo "\n-- marks validation --\n";
$okMarks = [['t' => 'text', 'x' => .1, 'y' => .1, 'w' => .5, 'h' => .1, 'text' => 'Hi', 'fs' => .02, 'color' => '#AABBCC', 'bold' => true, 'align' => 'c', 'cover' => true, 'evil' => 'x']];
$norm = PagePlan::normalize(['pages' => [['src' => 1, 'marks' => $okMarks]], 'stamp' => ['numbers' => true, 'watermark' => '  DRAFT  ']], 3, 'pdf', [], 'A', 500);
check('marks are normalised: unknown keys dropped, colour lower-cased', isset($norm['pages'][0]['marks'][0]) && !isset($norm['pages'][0]['marks'][0]['evil']) && $norm['pages'][0]['marks'][0]['color'] === '#aabbcc');
check('stamp normalised', $norm['stamp'] === ['numbers' => true, 'watermark' => 'DRAFT']);
check('marks never change the billed page count', PagePlan::pageCount($norm, 3) === 1);
$bm = fn(array $m) => (function () use ($m) { try { PagePlan::normalize(['pages' => [['src' => 1, 'marks' => [$m]]]], 3, 'pdf', [], 'A', 500); return false; } catch (InvalidArgumentException) { return true; } })();
check('unknown mark type refused', $bm(['t' => 'script', 'x' => 0, 'y' => 0, 'w' => .1, 'h' => .1]));
check('bad colour refused', $bm(['t' => 'cover', 'x' => 0, 'y' => 0, 'w' => .1, 'h' => .1, 'color' => 'red; x']));
check('non-numeric position refused', $bm(['t' => 'cover', 'x' => '0', 'y' => 0, 'w' => .1, 'h' => .1]));
check('overlong text refused', $bm(['t' => 'text', 'x' => 0, 'y' => 0, 'w' => .1, 'h' => .1, 'text' => str_repeat('a', 401)]));
check('positions are clamped into the page', PagePlan::normalize(['pages' => [['src' => 1, 'marks' => [['t' => 'cover', 'x' => .9, 'y' => 2, 'w' => .9, 'h' => .1]]]]], 3, 'pdf', [], 'A', 500)['pages'][0]['marks'][0]['x'] === 0.9);
$many = array_fill(0, 61, ['t' => 'cover', 'x' => 0, 'y' => 0, 'w' => .1, 'h' => .1]);
check('too many marks refused', (function () use ($many) { try { PagePlan::normalize(['pages' => [['src' => 1, 'marks' => $many]]], 3, 'pdf', [], 'A', 500); return false; } catch (InvalidArgumentException) { return true; } })());

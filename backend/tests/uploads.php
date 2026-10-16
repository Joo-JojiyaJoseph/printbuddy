<?php
// Upload type detection and combining files. Included by tests/run.php (needs printing.php's requires).
require_once __DIR__ . '/../app/Services/Documents/FileTypeDetector.php';
require_once __DIR__ . '/../app/Services/Documents/PdfMerger.php';

use App\Services\Documents\{FileTypeDetector, PdfMerger};
use App\Services\Printing\PrintFileComposer;

echo "\n-- upload type detection --\n";
$det = new FileTypeDetector;
$allowed = ['pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
$mk = function (string $kind, string $ext): string {
    $f = tempnam(sys_get_temp_dir(), 'pbu') . '.' . $ext;
    $im = imagecreatetruecolor(8, 8);
    if ($kind === 'png') { imagepng($im, $f); } elseif ($kind === 'jpg') { imagejpeg($im, $f); } elseif ($kind === 'webp') { imagewebp($im, $f); } else { file_put_contents($f, $kind === 'pdf' ? "%PDF-1.4\n%%EOF" : "hello world\n"); }
    return $f;
};
$png = $mk('png', 'png'); $jpg = $mk('jpg', 'jpg');
check('PNG named .png is accepted', ($det->inspect($png, 'image.png', $allowed)['kind'] ?? '') === 'png');
check('PNG with spaces and capital extension is accepted', ($det->inspect($png, 'Red Gradient Group Chat Icon.PNG', $allowed)['ok'] ?? false) === true);
check('JPEG named .jpg, .jpeg, .jfif and .jpe are accepted as jpg', array_reduce(['a.jpg', 'a.jpeg', 'images (14).jfif', 'a.jpe'], fn($c, $n) => $c && ($det->inspect($jpg, $n, $allowed)['kind'] ?? '') === 'jpg' && ($det->inspect($jpg, $n, $allowed)['ext'] ?? '') === 'jpg', true));
check('a PNG renamed .jpg is refused', ($det->inspect($png, 'a.jpg', $allowed)['ok'] ?? true) === false);
check('a PNG with no/unknown extension is accepted by content', ($det->inspect($png, 'image', $allowed)['kind'] ?? '') === 'png' && ($det->inspect($png, 'photo.bin', $allowed)['kind'] ?? '') === 'png');
check('a text file with an unknown extension is refused', ($det->inspect($mk('txt', 'xyz'), 'a.xyz', $allowed)['status'] ?? 0) === 415);
if (function_exists('imagewebp')) {
    $r = $det->inspect($mk('webp', 'png'), 'a.png', $allowed);
    check('WebP is refused with a helpful message', ($r['ok'] ?? true) === false && str_contains($r['error'] ?? '', 'WebP'));
}

echo "\n-- combining files --\n";
$merger = new PdfMerger(new PrintFileComposer('', 100));
if (!$merger->available()) {
    echo "  skip pdfunite not installed\n";
} else {
    $solid = function (array $colors): string {
        $f = tempnam(sys_get_temp_dir(), 'pbm') . '.pdf';
        $p = new FPDF('P', 'mm', 'A4');
        foreach ($colors as $c) { $p->AddPage(); $p->SetFillColor(...$c); $p->Rect(0, 0, 210, 297, 'F'); }
        $p->Output('F', $f);
        return $f;
    };
    $a = $solid([[255, 0, 0], [0, 255, 0]]); $b = $solid([[0, 0, 255]]);
    $img = tempnam(sys_get_temp_dir(), 'pbm') . '.jpg'; $im = imagecreatetruecolor(60, 30); imagefilledrectangle($im, 0, 0, 60, 30, imagecolorallocate($im, 255, 255, 0)); imagejpeg($im, $img, 95);
    $out = tempnam(sys_get_temp_dir(), 'pbm') . '.pdf';
    $merger->merge([['kind' => 'pdf', 'path' => $a], ['kind' => 'jpg', 'path' => $img], ['kind' => 'pdf', 'path' => $b]], $out);
    $pages = preg_match_all('/\/Type\s*\/Page[^s]/', (string) file_get_contents($out));
    $px = function (int $n): array {
        global $out;
        $pre = tempnam(sys_get_temp_dir(), 'pbr');
        shell_exec(sprintf('pdftoppm -r 30 -f %d -l %d -jpeg %s %s 2>/dev/null', $n, $n, escapeshellarg($out), escapeshellarg($pre)));
        $f = glob($pre . '-*.jpg')[0]; $im = imagecreatefromjpeg($f); $rgb = imagecolorat($im, (int) (imagesx($im) / 2), (int) (imagesy($im) / 2));
        foreach (glob($pre . '*') as $x) { @unlink($x); }
        return [($rgb >> 16) & 255, ($rgb >> 8) & 255, $rgb & 255];
    };
    $is = fn(array $g, array $w) => abs($g[0] - $w[0]) < 40 && abs($g[1] - $w[1]) < 40 && abs($g[2] - $w[2]) < 40;
    check('2-page PDF + picture + 1-page PDF = 4 pages', $pages === 4);
    check('order is kept: red, green, picture (yellow), blue', $is($px(1), [255, 0, 0]) && $is($px(2), [0, 255, 0]) && $is($px(3), [255, 255, 0]) && $is($px(4), [0, 0, 255]));
    $threw = false; try { $merger->merge([['kind' => 'pdf', 'path' => '/nope.pdf'], ['kind' => 'pdf', 'path' => $a]], $out . '2'); } catch (RuntimeException) { $threw = true; }
    check('a missing file fails cleanly', $threw && !is_file($out . '2'));
}

echo "\n-- merge command builders --\n";
check('qpdf command', PdfMerger::command(['qpdf', 'Q'], ['a', 'b'], 'o') === ['Q', '--empty', '--pages', 'a', 'b', '--', 'o']);
check('gs command', PdfMerger::command(['gs', 'G'], ['a'], 'o')[4] === '-sDEVICE=pdfwrite');

echo "\n-- session device id --\n";
require_once __DIR__ . '/../app/Services/Sessions/QrSessionService.php';
check('device id is hashed, not stored raw', \App\Services\Sessions\QrSessionService::deviceHash(str_repeat('a', 24)) === hash('sha256', str_repeat('a', 24)));
check('a malformed device id is ignored', \App\Services\Sessions\QrSessionService::deviceHash('x y') === null && \App\Services\Sessions\QrSessionService::deviceHash(null) === null);


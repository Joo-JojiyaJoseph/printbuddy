<?php
// Page-plan, HTML sanitiser, PDF text extraction and Word<->PDF bridge. Included by tests/run.php.
require_once __DIR__ . '/../app/Services/Pricing/PagePlan.php';
require_once __DIR__ . '/../app/Services/Documents/Editing/EditingException.php';
require_once __DIR__ . '/../app/Services/Documents/Editing/HtmlSanitizer.php';
require_once __DIR__ . '/../app/Services/Documents/Editing/PdfTextExtractor.php';
require_once __DIR__ . '/../app/Services/Documents/Editing/OfficeHtmlBridge.php';
require_once __DIR__ . '/../vendor/setasign/fpdf/fpdf.php';
spl_autoload_register(function ($c) {
    $p = __DIR__ . '/../vendor/smalot/pdfparser/src/' . str_replace('\\', '/', $c) . '.php';
    if (is_file($p)) { require_once $p; }
});

use App\Services\Pricing\{PagePlan, PrintPricingService};
use App\Services\Documents\Editing\{EditingException, HtmlSanitizer, PdfTextExtractor, OfficeHtmlBridge};

echo "\n-- page plan --\n";
$plan = fn(array $e, string $kind = 'pdf', int $src = 6, array $ids = ['A', 'B', 'C'], string $primary = 'A', int $max = 500) =>
    PagePlan::normalize($e, $src, $kind, $ids, $primary, $max);
$bad = function (callable $f): bool { try { $f(); return false; } catch (InvalidArgumentException) { return true; } };

check('no edits -> null', PagePlan::normalize(null, 6, 'pdf', [], 'A', 500) === null && PagePlan::normalize([], 6, 'pdf', [], 'A', 500) === null);
$n = $plan(['pages' => [['src' => 1], ['src' => 3, 'rot' => 90, 'align' => 'center'], ['src' => null], ['src' => 3]]]);
check('delete/reorder/blank/copy: 4 output pages', PagePlan::pageCount($n, 6) === 4);
check('defaults filled and unknown keys dropped', $plan(['pages' => [['src' => 2, 'evil' => 'x']]])['pages'][0] === ['src' => 2, 'rot' => 0, 'align' => 'fit']);
check('page beyond document rejected', $bad(fn() => $plan(['pages' => [['src' => 7]]])));
check('page 0 rejected', $bad(fn() => $plan(['pages' => [['src' => 0]]])));
check('string page number rejected', $bad(fn() => $plan(['pages' => [['src' => '2']]])));
check('bad rotation rejected', $bad(fn() => $plan(['pages' => [['src' => 1, 'rot' => 45]]])));
check('bad position rejected', $bad(fn() => $plan(['pages' => [['src' => 1, 'align' => 'diagonal']]])));
check('empty plan rejected', $bad(fn() => $plan(['pages' => []])));
check('all-blank plan rejected', $bad(fn() => $plan(['pages' => [['src' => null], ['src' => null]]])));
check('page limit enforced', $bad(fn() => $plan(['pages' => [['src' => 1], ['src' => 2], ['src' => 3]]], 'pdf', 6, [], 'A', 2)));
check('image doc cannot carry page edits', $bad(fn() => $plan(['pages' => [['src' => 1]]], 'png', 1)));
check('document cannot carry image layout', $bad(fn() => $plan(['sheet' => ['images' => [['document_id' => 'A']]]], 'pdf')));

$img = fn(array $o) => ['sheet' => array_merge(['per_page' => 2, 'mode' => 'sequence', 'fit' => 'fit', 'margin' => 5, 'images' => [['document_id' => 'A'], ['document_id' => 'B'], ['document_id' => 'C']]], $o)];
check('3 images, 2 per page = 2 sheets', PagePlan::pageCount($plan($img([]), 'png', 1), 1) === 2);
check('5 images, 2 per page = 3 sheets', PagePlan::pageCount($plan($img(['images' => array_map(fn($i) => ['document_id' => $i], ['A', 'B', 'C', 'A', 'B'])]), 'png', 1), 1) === 3);
check('copies mode: 1 image x 4 per page = 1 sheet', PagePlan::pageCount($plan($img(['mode' => 'copies', 'per_page' => 4, 'images' => [['document_id' => 'A']]]), 'png', 1), 1) === 1);
check('copies mode: 3 images = 3 sheets', PagePlan::pageCount($plan($img(['mode' => 'copies', 'per_page' => 2]), 'jpg', 1), 1) === 3);
check('someone else\'s image rejected', $bad(fn() => $plan($img(['images' => [['document_id' => 'A'], ['document_id' => 'ZZZ']]]), 'png', 1)));
check('layout must include the edited image', $bad(fn() => $plan($img(['images' => [['document_id' => 'B']]]), 'png', 1)));
check('3 per page not offered', $bad(fn() => $plan($img(['per_page' => 3]), 'png', 1)));
check('margin out of range rejected', $bad(fn() => $plan($img(['margin' => 99]), 'png', 1)) && $bad(fn() => $plan($img(['margin' => -1]), 'png', 1)));
check('image rotation validated', $bad(fn() => $plan($img(['images' => [['document_id' => 'A', 'rot' => 33]]]), 'png', 1)));

// dragged picture position and size, and the new page positions
$moved = fn(array $i) => $plan($img(['per_page' => 1, 'images' => [['document_id' => 'A'] + $i]]), 'png', 1)['sheet']['images'][0];
check('untouched picture keeps only id and rotation', $moved([]) === ['document_id' => 'A', 'rot' => 0]);
check('dragged position and size are kept', $moved(['x' => 0.25, 'y' => -0.1, 'zoom' => 0.5]) === ['document_id' => 'A', 'rot' => 0, 'x' => 0.25, 'y' => -0.1, 'zoom' => 0.5]);
check('position is clamped to half a cell, size to 0.2..4', $moved(['x' => 9, 'y' => -9, 'zoom' => 99]) === ['document_id' => 'A', 'rot' => 0, 'x' => 0.5, 'y' => -0.5, 'zoom' => 4.0] && $moved(['zoom' => 0.01])['zoom'] === 0.2);
check('position and size must be numbers', $bad(fn() => $moved(['x' => '0.2'])) && $bad(fn() => $moved(['y' => NAN])) && $bad(fn() => $moved(['zoom' => INF])));
check('crop is kept, rounded, and dropped when nothing is trimmed', $moved(['crop' => ['l' => 0.1, 't' => 0.25, 'r' => 0, 'b' => 0.5]])['crop'] === ['l' => 0.1, 't' => 0.25, 'r' => 0.0, 'b' => 0.5] && !isset($moved(['crop' => ['l' => 0, 't' => 0, 'r' => 0, 'b' => 0]])['crop']) && !isset($moved(['crop' => []])['crop']));
check('crop cannot take (nearly) the whole picture on either axis', $bad(fn() => $moved(['crop' => ['l' => 0.5, 'r' => 0.5]])) && $bad(fn() => $moved(['crop' => ['t' => 0.2, 'b' => 0.8]])) && !$bad(fn() => $moved(['crop' => ['l' => 0.45, 'r' => 0.45]])));
check('a negative crop is clamped to nothing', !isset($moved(['crop' => ['l' => -0.1]])['crop']));
check('crop values must be numbers', $bad(fn() => $moved(['crop' => ['l' => '0.1']])) && $bad(fn() => $moved(['crop' => 'all'])));
check('whole page to the edge and real size are valid positions', $plan(['pages' => [['src' => 1, 'align' => 'edge'], ['src' => 2, 'align' => 'actual']]])['pages'][1]['align'] === 'actual');

$rules = ['rates' => [['paper_size' => 'A4', 'color_mode' => 'bw', 'per_side_paise' => 200]], 'duplex_discount_bps' => 0, 'service_fee_paise' => 0, 'tax_bps' => 0];
$count = PagePlan::pageCount($plan(['pages' => [['src' => 1], ['src' => 1], ['src' => 2], ['src' => null]]]), 6);
$q = (new PrintPricingService($rules))->quote($count, '2-4', 2, 'A4', 'bw', false);
check('price follows edited pages: range 2-4 of 4-page plan x2 copies = ₹12', $q['pages_selected'] === 3 && $q['total_paise'] === 1200);

echo "\n-- html sanitiser --\n";
$c = fn(string $h) => HtmlSanitizer::clean($h);
check('script removed with contents', !str_contains($c('<p>Hi</p><script>alert(1)</script>'), 'alert'));
check('event handlers stripped', !str_contains($c('<p onclick="x()" onmouseover="y()">Hi</p>'), 'on'));
check('javascript: link unwrapped to text', $c('<a href="javascript:alert(1)">click</a>') === 'click');
check('external image removed (no server-side fetch)', !str_contains($c('<p>a</p><img src="http://169.254.169.254/x.png">'), 'img'));
check('file:// image removed', !str_contains($c('<img src="file:///etc/passwd">'), 'img'));
check('inline PNG data image kept', str_contains($c('<img src="data:image/png;base64,iVBORw0KGgo=">'), 'data:image/png;base64,iVBORw0KGgo='));
check('svg data image rejected', !str_contains($c('<img src="data:image/svg+xml;base64,PHN2Zz4=">'), 'img'));
check('iframe/object/style dropped', $c('<iframe src="x"></iframe><object data="x"></object><style>p{}</style><p>ok</p>') === '<p>ok</p>');
check('formatting survives', $c('<p align="center"><b>Bold</b> <i>it</i> <u>un</u></p>') === '<p align="center"><b>Bold</b> <i>it</i> <u>un</u></p>');
check('safe style kept, unsafe dropped', $c('<p style="text-align:center;position:fixed;background:url(http://x/y.png);font-size:14pt">x</p>') === '<p style="text-align: center; font-size: 14pt">x</p>');
check('css expression/url rejected', !str_contains($c('<p style="color:expression(alert(1))">x</p>'), 'expression'));
check('editor font-size keywords kept', str_contains($c('<span style="font-size: x-large">x</span>'), 'font-size: x-large'));
check('absurd font size rejected', !str_contains($c('<p style="font-size:9999pt">x</p>'), 'font-size'));
check('table kept, class/id removed', $c('<table class="c" id="i"><tr><td colspan="2">x</td></tr></table>') === '<table><tr><td colspan="2">x</td></tr></table>');
check('comments removed', $c('<p>a<!-- secret --></p>') === '<p>a</p>');
check('text is escaped, not executed', $c('<p>&lt;script&gt;x&lt;/script&gt;</p>') === '<p>&lt;script&gt;x&lt;/script&gt;</p>');
check('empty input', $c('   ') === '');

echo "\n-- pdf text extraction --\n";
$mk = function (array $pages): string {
    $f = tempnam(sys_get_temp_dir(), 'pb') . '.pdf';
    $pdf = new FPDF(); $pdf->SetFont('Helvetica', '', 12);
    foreach ($pages as $lines) { $pdf->AddPage(); foreach ($lines as $l) { $pdf->Cell(0, 8, $l, 0, 1); } }
    $pdf->Output('F', $f);
    return $f;
};
$f = $mk([['Routes to heaven', 'Second line'], ['Page two text']]);
$html = (new PdfTextExtractor())->toHtml($f, 500);
check('extracts lines in reading order with <br>', str_contains($html, 'Routes to heaven<br>Second line'));
check('second page starts with a page break', str_contains($html, '<p style="page-break-before: always">Page two text</p>'));
check('page limit honoured', !str_contains((new PdfTextExtractor())->toHtml($f, 1), 'Page two'));
check('extracted html survives sanitiser unchanged', HtmlSanitizer::clean($html) === $html);
$blank = $mk([[]]);
check('PDF without text refused with clear message', (function () use ($blank) { try { (new PdfTextExtractor())->toHtml($blank, 5); return false; } catch (EditingException $e) { return str_contains($e->getMessage(), 'no selectable text'); } })());
check('too-large PDF refused', (function () use ($f) { try { (new PdfTextExtractor(10))->toHtml($f, 5); return false; } catch (EditingException) { return true; } })());
@unlink($f); @unlink($blank);

echo "\n-- Word <-> PDF bridge (LibreOffice) --\n";
$bridge = new OfficeHtmlBridge('soffice', 120, sys_get_temp_dir() . '/pb-bridge-test');
if (!$bridge->available()) {
    echo "  skip LibreOffice not installed\n";
} else {
    $t0 = microtime(true);
    $raw = $bridge->wordToHtml(__DIR__ . '/fixtures/sample.docx', 'docx');
    $clean = HtmlSanitizer::clean($raw);
    check('docx -> html contains the text', str_contains($clean, 'Routes to heaven') && str_contains($clean, '<b>bold</b>'));
    check('docx -> html keeps centre alignment', str_contains($clean, 'align="center"'));
    $edited = str_replace('Routes to heaven', 'Routes to EDITED heaven', $clean);
    $out = sys_get_temp_dir() . '/pb-edited-' . bin2hex(random_bytes(4)) . '.pdf';
    $bridge->htmlToPdf($edited, $out);
    check('edited html -> real PDF', is_file($out) && str_starts_with((string) file_get_contents($out), '%PDF'));
    $text = (new Smalot\PdfParser\Parser())->parseFile($out)->getText();
    check('PDF contains the edit', str_contains($text, 'Routes to EDITED heaven') && str_contains($text, 'Second paragraph'));
    check('one A4 page', count((new Smalot\PdfParser\Parser())->parseFile($out)->getPages()) === 1);
    @unlink($out);
    // Hostile HTML must not make LibreOffice reach out or run anything.
    $hostile = HtmlSanitizer::clean('<p>Safe text</p><img src="http://127.0.0.1:9/x.png"><script>1</script><iframe src="file:///etc/passwd"></iframe>');
    $out2 = sys_get_temp_dir() . '/pb-hostile-' . bin2hex(random_bytes(4)) . '.pdf';
    $bridge->htmlToPdf($hostile, $out2);
    check('hostile html renders only its safe text', str_contains((new Smalot\PdfParser\Parser())->parseFile($out2)->getText(), 'Safe text'));
    @unlink($out2);
    check('non-Word extension refused', (function () use ($bridge) { try { $bridge->wordToHtml(__DIR__ . '/fixtures/sample.docx', 'xlsx'); return false; } catch (EditingException) { return true; } })());
    check('work directories cleaned up', (glob(sys_get_temp_dir() . '/pb-bridge-test/*') ?: []) === []);
    printf("  (bridge round trip took %.1fs)\n", microtime(true) - $t0);
}

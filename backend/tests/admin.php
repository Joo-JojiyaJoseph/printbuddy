<?php
// Admin panel support classes (reports, CSV, printer discovery, test page). Included by tests/run.php.
foreach (['PrintException', 'ShellRunner', 'PrinterInspector', 'PrintTestPage'] as $c) {
    require_once __DIR__ . "/../app/Services/Printing/$c.php";
}
require_once __DIR__ . '/../app/Services/Reports/ReportBuilder.php';
require_once __DIR__ . '/../app/Services/Reports/Csv.php';
require_once __DIR__ . '/../vendor/setasign/fpdf/fpdf.php';

use App\Services\Printing\{PrinterInspector, PrintTestPage};
use App\Services\Reports\{Csv, ReportBuilder};

echo "\n-- admin: reports --\n";
$rows = [
    ['date' => '2026-10-14', 'total' => 2400, 'sides' => 12, 'paper' => 'A4', 'color' => 'bw', 'kiosk' => 'demo'],
    ['date' => '2026-10-14', 'total' => 800, 'sides' => 1, 'paper' => 'A4', 'color' => 'color', 'kiosk' => 'demo'],
    ['date' => '2026-10-16', 'total' => 1000, 'sides' => 5, 'paper' => 'A5', 'color' => 'bw', 'kiosk' => 'k2'],
];
$r = ReportBuilder::summarize($rows, '2026-10-13', '2026-10-16');
check('totals: 3 orders, ₹42, 18 sides, avg ₹14', $r['totals'] === ['orders' => 3, 'revenue_paise' => 4200, 'billable_sides' => 18, 'average_order_paise' => 1400]);
check('daily series covers every day, zeros included', count($r['daily']) === 4 && $r['daily'][0]['orders'] === 0 && $r['daily'][1]['revenue_paise'] === 3200 && $r['daily'][3]['orders'] === 1);
check('grouped by paper, best revenue first', $r['by_paper'][0]['key'] === 'A4' && $r['by_paper'][0]['revenue_paise'] === 3200 && $r['by_paper'][1]['key'] === 'A5');
check('grouped by colour and kiosk', $r['by_color'][0]['key'] === 'bw' && $r['by_kiosk'][0]['key'] === 'demo' && $r['by_kiosk'][1]['orders'] === 1);
$e = ReportBuilder::summarize([], '2026-10-01', '2026-10-01');
check('empty range: zero average, one empty day', $e['totals']['average_order_paise'] === 0 && count($e['daily']) === 1);
check('missing kiosk is "unknown"', ReportBuilder::summarize([['date' => '2026-10-01', 'total' => 1, 'sides' => 1, 'paper' => 'A4', 'color' => 'bw']], '2026-10-01', '2026-10-01')['by_kiosk'][0]['key'] === 'unknown');
check('reversed range rejected', throws(fn() => ReportBuilder::summarize([], '2026-10-05', '2026-10-01')));
check('range over a year rejected', throws(fn() => ReportBuilder::summarize([], '2025-01-01', '2026-10-01')));

echo "\n-- admin: csv --\n";
check('plain cell quoted', Csv::cell('a b') === '"a b"');
check('quotes doubled', Csv::cell('say "hi"') === '"say ""hi"""');
check('formula cells neutralised', Csv::cell('=HYPERLINK("x")') === '"\'=HYPERLINK(""x"")"' && Csv::cell('@SUM(A1)') === '"\'@SUM(A1)"' && Csv::cell('+1+1') !== '"+1+1"');
check('negative numbers stay numbers', Csv::cell('-5') === '"-5"');
check('newlines flattened', Csv::cell("a\nb") === '"a b"');
check('row ends with CRLF', Csv::row(['x', 2]) === "\"x\",\"2\"\r\n");

echo "\n-- admin: printers --\n";
check('parse list, de-duplicated, blanks dropped', PrinterInspector::parse("HP_LaserJet\r\n\nCanon MG\nHP_LaserJet\n") === ['HP_LaserJet', 'Canon MG']);
check('linux uses lpstat without a shell', (function () { $cmd = null; (new PrinterInspector(function ($c) use (&$cmd) { $cmd = $c; return ['exit' => 0, 'out' => 'a', 'err' => '']; }, 'Linux'))->installed(); return $cmd === ['lpstat', '-e']; })());
check('windows uses Get-Printer', (function () { $cmd = null; (new PrinterInspector(function ($c) use (&$cmd) { $cmd = $c; return ['exit' => 0, 'out' => '', 'err' => '']; }, 'Windows'))->installed(); return $cmd[0] === 'powershell' && str_contains(end($cmd), 'Get-Printer'); })());
$bad = (new PrinterInspector(fn() => ['exit' => 1, 'out' => '', 'err' => 'x'], 'Linux'))->installed();
check('listing failure is reported, not thrown', $bad['names'] === [] && is_string($bad['error']));
check('printer names: normal ones allowed', PrinterInspector::validName('HP LaserJet Pro M404') && PrinterInspector::validName('Canon_MG3600-series (Copy 1)') && PrinterInspector::validName(''));
check('printer names: option flags and odd characters refused', ! PrinterInspector::validName('-o evil') && ! PrinterInspector::validName('a;b') && ! PrinterInspector::validName("a\nb") && ! PrinterInspector::validName(str_repeat('a', 121)));
$f = sys_get_temp_dir() . '/tptest-' . bin2hex(random_bytes(4)) . '.pdf';
PrintTestPage::write($f, 'cups', 'HP');
$pdfBytes = (string) file_get_contents($f);
check('test page is a real one-page PDF', str_starts_with($pdfBytes, '%PDF') && str_contains($pdfBytes, '/Count 1') && str_contains(rtrim($pdfBytes), '%%EOF'));
@unlink($f);


echo "\n-- admin: payment and printer settings --\n";
require_once __DIR__ . '/../app/Support/IntegrationRules.php';
use App\Support\IntegrationRules as R;
check('admin value wins over .env', R::pick('rzp_live_abc', 'rzp_test_env') === 'rzp_live_abc');
check('empty or blank admin value falls back to .env', R::pick('', 'cups') === 'cups' && R::pick('   ', 'cups') === 'cups' && R::pick(null, 'cups') === 'cups');
check('values are trimmed', R::pick('  sumatra ', 'file') === 'sumatra');
$yes = fn($p) => true; $no = fn($p) => false;
check('program path: right file accepted (Windows and Linux)', R::binaryError('sumatra_path', 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe', $yes) === null && R::binaryError('lp_path', '/usr/bin/lp', $yes) === null && R::binaryError('pdftoppm_path', 'C:\\poppler\\bin\\pdftoppm.exe', $yes) === null);
check('program path: empty is allowed (use .env / auto-detect)', R::binaryError('lp_path', '', $yes) === null);
check('program path: some other program is refused', R::binaryError('lp_path', '/bin/sh', $yes) !== null && R::binaryError('sumatra_path', 'C:\\Windows\\System32\\cmd.exe', $yes) !== null);
check('program path: relative, traversal and control characters refused', R::binaryError('lp_path', 'lp', $yes) !== null && R::binaryError('lp_path', '/usr/../bin/lp', $yes) !== null && R::binaryError("lp_path", "/usr/\nbin/lp", $yes) !== null && R::binaryError("lp_path", "/usr/b\0in/lp", $yes) !== null);
check('program path: a missing file is reported', R::binaryError('lp_path', '/usr/bin/lp', $no) === 'That file was not found on the server.');
check('Razorpay needs a key id and key secret (webhook secret is optional)', R::paymentGaps('razorpay', '', false) === ['Razorpay Key ID', 'Razorpay Key Secret'] && R::paymentGaps('razorpay', 'rzp_test_x1', true) === []);
check('other providers have no gaps', R::paymentGaps('fake', '', false) === []);

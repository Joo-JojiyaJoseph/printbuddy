<?php
// Dependency-free test runner (Composer/PHPUnit unavailable in the build sandbox).
// Laravel projects should port these to PHPUnit; the logic under test has no framework deps.
require __DIR__ . '/../app/Services/Pricing/PageRange.php';
require __DIR__ . '/../app/Services/Pricing/PagePlan.php';
require __DIR__ . '/../app/Services/Pricing/PrintPricingService.php';
require_once __DIR__ . '/../app/Services/Printing/PrintGeometry.php';
require __DIR__ . '/../app/Services/OrderStateMachine.php';

use App\Services\Pricing\{PageRange, PrintPricingService};
use App\Services\OrderStateMachine as M;

$pass = 0; $fail = 0;
function check(string $name, bool $ok): void { global $pass, $fail; $ok ? $pass++ : $fail++; echo ($ok ? "  ok   " : "  FAIL ") . $name . "\n"; }
function throws(callable $f): bool { try { $f(); return false; } catch (InvalidArgumentException) { return true; } }

check('empty range = all pages', PageRange::parse('', 3) === [1, 2, 3]);
check('1-3,5 of 6', PageRange::parse('1-3,5', 6) === [1, 2, 3, 5]);
check('duplicates collapse, sorted', PageRange::parse('5,2,2-3', 6) === [2, 3, 5]);
check('out of bounds rejected', throws(fn() => PageRange::parse('7', 6)));
check('reversed range rejected', throws(fn() => PageRange::parse('3-1', 6)));
check('garbage rejected', throws(fn() => PageRange::parse('1;DROP', 6)));
check('zero page rejected', throws(fn() => PageRange::parse('0-2', 6)));

$rules = ['rates' => [
    ['paper_size' => 'A4', 'color_mode' => 'bw', 'per_side_paise' => 200],
    ['paper_size' => 'A4', 'color_mode' => 'color', 'per_side_paise' => 800],
], 'duplex_discount_bps' => 0, 'service_fee_paise' => 0, 'tax_bps' => 0];

$q = (new PrintPricingService($rules))->quote(6, '', 2, 'A4', 'bw', false);
check('simplex: 6 pages x2 copies x ₹2 = ₹24', $q['total_paise'] === 2400 && $q['billable_sides'] === 12 && $q['sheets'] === 12);

$q = (new PrintPricingService($rules))->quote(7, '', 1, 'A4', 'bw', true);
check('duplex odd pages: 7 sides, 4 sheets, no discount', $q['billable_sides'] === 7 && $q['sheets'] === 4 && $q['total_paise'] === 1400);

$rules2 = $rules; $rules2['duplex_discount_bps'] = 1000; $rules2['service_fee_paise'] = 500; $rules2['tax_bps'] = 1800;
$q = (new PrintPricingService($rules2))->quote(6, '', 2, 'A4', 'bw', true);
check('duplex 10% off: eff rate 180, subtotal 2160', $q['effective_per_side_rate_paise'] === 180 && $q['subtotal_paise'] === 2160 && $q['sheets'] === 6);
check('fee 500 + 18% tax on 2660 = 479; total 3139', $q['tax_paise'] === 479 && $q['total_paise'] === 3139);

$q = (new PrintPricingService($rules))->quote(10, '2-4', 1, 'A4', 'color', false);
check('page range 2-4 colour: 3 x ₹8 = ₹24', $q['pages_selected'] === 3 && $q['total_paise'] === 2400);
check('snapshot embedded in quote', $q['rules_snapshot'] === $rules);

$svc = new PrintPricingService($rules);
// pages per sheet: customers pay for printed sides, not source pages
$q = (new PrintPricingService($rules))->quote(10, '', 1, 'A4', 'bw', false, 2);
check('10 pages at 2 per sheet bill 5 sides', $q['billable_sides'] === 5 && $q['sides_per_copy'] === 5 && $q['pages_selected'] === 10 && $q['pages_per_sheet'] === 2 && $q['sheets'] === 5);
$q = (new PrintPricingService($rules))->quote(10, '', 1, 'A4', 'bw', false, 4);
check('10 pages at 4 per sheet round up to 3 sides', $q['billable_sides'] === 3);
$q = (new PrintPricingService($rules))->quote(10, '2-7', 2, 'A4', 'bw', false, 9);
check('range first, then packed: 6 pages at 9 per sheet x 2 copies = 2 sides', $q['billable_sides'] === 2 && $q['pages_selected'] === 6);
$q = (new PrintPricingService($rules))->quote(7, '', 1, 'A4', 'bw', true, 2);
check('duplex counts physical sheets after packing (4 sides -> 2 sheets)', $q['billable_sides'] === 4 && $q['sheets'] === 2);
check('default is 1 per sheet (unchanged price)', (new PrintPricingService($rules))->quote(6, '', 2, 'A4', 'bw', false)['billable_sides'] === 12);
check('3 pages per sheet is not offered', throws(fn() => $svc->quote(3, '', 1, 'A4', 'bw', false, 3)));
check('grid for 9 is 3x3', \App\Services\Printing\PrintGeometry::grid(9, false) === [3, 3]);
check('unknown paper size rejected', throws(fn() => $svc->quote(1, '', 1, 'A3', 'bw', false)));
check('copies 0 rejected', throws(fn() => $svc->quote(1, '', 0, 'A4', 'bw', false)));
check('copies 101 rejected', throws(fn() => $svc->quote(1, '', 101, 'A4', 'bw', false)));
check('bad colour mode rejected', throws(fn() => $svc->quote(1, '', 1, 'A4', 'sepia', false)));

check('paid is terminal', !M::can('paid', 'cancelled') && !M::can('paid', 'awaiting_payment'));
check('cannot skip to paid from draft', !M::can('draft', 'paid') && !M::can('configured', 'paid'));
check('awaiting_payment -> paid allowed', M::can('awaiting_payment', 'paid'));
check('failed payment may retry', M::can('payment_failed', 'awaiting_payment'));
check('unknown state rejected', !M::can('bogus', 'paid') && throws(fn() => M::assert('paid', 'draft')));

require __DIR__ . '/payments.php';
require __DIR__ . '/editing.php';
require __DIR__ . '/printing.php';
require __DIR__ . '/uploads.php';
require __DIR__ . '/security.php';

echo "\n$pass passed, $fail failed\n";
exit($fail ? 1 : 0);

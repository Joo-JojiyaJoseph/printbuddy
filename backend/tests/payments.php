<?php
// Payment-integrity tests (loaded by run.php).
require __DIR__ . '/../app/Services/Payments/PaymentProvider.php';
require __DIR__ . '/../app/Services/Payments/WebhookSignature.php';
require __DIR__ . '/../app/Services/Payments/PaymentStore.php';
require __DIR__ . '/../app/Services/Payments/PaymentProcessor.php';
require __DIR__ . '/../app/Services/Payments/FakeUpiProvider.php';
require __DIR__ . '/support/InMemoryPaymentStore.php';

use App\Services\Payments\{FakeUpiProvider, PaymentProcessor, WebhookSignature};

const SECRET = 'whsec_test';
const NOW = 1_800_000_000;

/** Build a world: one order awaiting payment for 2400 paise with a pending provider payment. */
function world(string $orderStatus = 'awaiting_payment'): array
{
    $provider = new FakeUpiProvider();
    $store = new InMemoryPaymentStore();
    $p = $provider->createPayment('PB-1', 2400, 'INR');
    $id = $p['provider_payment_id'];
    $store->orders['PB-1'] = ['status' => $orderStatus, 'total_paise' => 2400, 'currency' => 'INR'];
    $store->payments[$id] = ['order_reference' => 'PB-1', 'amount_paise' => 2400, 'currency' => 'INR', 'status' => 'pending'];
    return [$provider, $store, new PaymentProcessor($provider, $store, SECRET), $id];
}
function hook(PaymentProcessor $proc, string $id, string $eventId, array $overrides = [], ?int $ts = null, ?string $sig = null): string
{
    $raw = json_encode(['event_id' => $eventId, 'provider_payment_id' => $id, 'status' => 'succeeded'] + $overrides);
    $ts ??= NOW;
    return $proc->handleWebhook($raw, $sig ?? WebhookSignature::sign($raw, $ts, SECRET), $ts, NOW);
}

[$prov, $store, $proc, $id] = world();
$prov->simulate($id, 'succeeded');
check('valid signed webhook + provider confirms => paid', hook($proc, $id, 'evt_1') === 'paid' && $store->orders['PB-1']['status'] === 'paid' && $store->payments[$id]['status'] === 'succeeded');
check('duplicate event id is a no-op', hook($proc, $id, 'evt_1') === 'duplicate' && $store->applyCalls === 1);
check('a different event for an already-paid order does not re-apply', hook($proc, $id, 'evt_2') === 'already_paid' && $store->applyCalls === 1);

[$prov, $store, $proc, $id] = world(); $prov->simulate($id, 'succeeded');
check('bad signature rejected, order untouched', hook($proc, $id, 'e', [], null, 'deadbeef') === 'invalid_signature' && $store->orders['PB-1']['status'] === 'awaiting_payment');
check('replayed (stale) timestamp rejected even with correct signature', hook($proc, $id, 'e', [], NOW - 301) === 'invalid_signature');
$raw = json_encode(['event_id' => 'e9', 'provider_payment_id' => $id]);
$goodSig = WebhookSignature::sign($raw, NOW, SECRET);
check('tampered body rejected', $proc->handleWebhook($raw . ' ', $goodSig, NOW, NOW) === 'invalid_signature');
check('empty secret never validates', !WebhookSignature::verify('x', WebhookSignature::sign('x', NOW, ''), NOW, '', NOW));
check('malformed payload rejected after signature check', (function () use ($proc) {
    $raw = '{"nope":1}'; return $proc->handleWebhook($raw, WebhookSignature::sign($raw, NOW, SECRET), NOW, NOW) === 'malformed'; })());

[$prov, $store, $proc, $id] = world();   // provider still says pending
check('webhook CLAIMING success is ignored when provider says pending', hook($proc, $id, 'evt_x', ['status' => 'succeeded']) === 'pending' && $store->orders['PB-1']['status'] === 'awaiting_payment');

[$prov, $store, $proc, $id] = world(); $prov->simulate($id, 'succeeded', 100);
check('amount mismatch never marks paid', hook($proc, $id, 'evt_m') === 'mismatch' && $store->orders['PB-1']['status'] === 'awaiting_payment');

[$prov, $store, $proc, $id] = world(); $prov->simulate($id, 'failed');
check('provider failure => payment_failed', hook($proc, $id, 'evt_f') === 'failed' && $store->orders['PB-1']['status'] === 'payment_failed');

[$prov, $store, $proc, $id] = world('expired'); $prov->simulate($id, 'succeeded');
check('money for an expired order is flagged for review, order stays expired', hook($proc, $id, 'evt_e') === 'needs_review' && $store->orders['PB-1']['status'] === 'expired' && isset($store->flags[$id]));

[$prov, $store, $proc, $id] = world('configured'); $prov->simulate($id, 'succeeded');
check('cannot jump configured -> paid', hook($proc, $id, 'evt_c') === 'needs_review' && $store->orders['PB-1']['status'] === 'configured');

[$prov, $store, $proc, $id] = world(); $prov->simulate($id, 'succeeded');
check('polling reconcile also verifies with provider', $proc->reconcile($id) === 'paid' && $store->orders['PB-1']['status'] === 'paid');
check('unknown payment id handled', $proc->reconcile('nope') === 'unknown_payment');

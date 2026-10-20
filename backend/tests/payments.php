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

// ---------- Razorpay Checkout (card / netbanking / wallet window): the pure parts ----------
require_once __DIR__ . '/../app/Services/Payments/CheckoutProvider.php';
require_once __DIR__ . '/../app/Services/Payments/RazorpayProvider.php';
use App\Services\Payments\{CheckoutProvider, RazorpayProvider};

echo "\n-- Razorpay Checkout --\n";
$rz = new RazorpayProvider('rzp_test_key', 'sekret', 'whsec', 'https://api.razorpay.com/v1', 300);
check('Razorpay supports the Checkout window', $rz instanceof CheckoutProvider && $rz->checkoutKeyId() === 'rzp_test_key');
check('the sandbox provider does not offer it', !(new FakeUpiProvider() instanceof CheckoutProvider));

$good = hash_hmac('sha256', 'order_A|pay_B', 'sekret');
check('Checkout signature: order_id|payment_id signed with the secret key is accepted', $rz->verifyCheckoutSignature('order_A', 'pay_B', $good));
check('a signature for other ids is refused', !$rz->verifyCheckoutSignature('order_A', 'pay_C', $good) && !$rz->verifyCheckoutSignature('order_X', 'pay_B', $good));
check('an empty or made-up signature is refused', !$rz->verifyCheckoutSignature('order_A', 'pay_B', '') && !$rz->verifyCheckoutSignature('order_A', 'pay_B', 'abc123'));
check('a signature made with another secret is refused', !$rz->verifyCheckoutSignature('order_A', 'pay_B', hash_hmac('sha256', 'order_A|pay_B', 'other')));

check('checkout ids are told apart from QR ids', RazorpayProvider::isCheckoutId('order_Abc123') && !RazorpayProvider::isCheckoutId('qr_Abc123'));
$paid = RazorpayProvider::mapOrder(['status' => 'paid', 'amount' => 2400, 'amount_paid' => 2400, 'currency' => 'INR', 'notes' => ['order_reference' => 'PB-1']]);
check('a paid Razorpay order maps to succeeded with the amount actually paid', $paid === ['status' => 'succeeded', 'amount_paise' => 2400, 'currency' => 'INR', 'order_reference' => 'PB-1']);
$under = RazorpayProvider::mapOrder(['status' => 'paid', 'amount' => 2400, 'amount_paid' => 100, 'currency' => 'INR', 'notes' => ['order_reference' => 'PB-1']]);
check('an underpaid order reports the smaller amount (the processor then refuses it)', $under['amount_paise'] === 100);
foreach (['created', 'attempted'] as $st) {
    $o = RazorpayProvider::mapOrder(['status' => $st, 'amount' => 2400, 'amount_paid' => 0, 'currency' => 'INR', 'notes' => ['order_reference' => 'PB-1']]);
    check("a Razorpay order that is '$st' is still pending", $o['status'] === 'pending' && $o['amount_paise'] === 2400);
}

$sign = fn (string $body) => hash_hmac('sha256', $body, 'whsec');
$hook = function (array $event) use ($rz, $sign) {
    $raw = json_encode($event);
    return $rz->parseWebhook($raw, $sign($raw), 'evt_x');
};
check('webhook: qr_code.credited still names the QR', ($hook(['payload' => ['qr_code' => ['entity' => ['id' => 'qr_1']]]])['provider_payment_id'] ?? null) === 'qr_1');
check('webhook: order.paid names the Checkout order', ($hook(['payload' => ['order' => ['entity' => ['id' => 'order_1']]]])['provider_payment_id'] ?? null) === 'order_1');
check('webhook: payment.captured names the Checkout order', ($hook(['payload' => ['payment' => ['entity' => ['id' => 'pay_1', 'order_id' => 'order_2']]]])['provider_payment_id'] ?? null) === 'order_2');
check('webhook: an event with no payment we know about is ignored', $hook(['payload' => ['payment' => ['entity' => ['id' => 'pay_1', 'order_id' => null]]]]) === null);
$raw = json_encode(['payload' => ['order' => ['entity' => ['id' => 'order_1']]]]);
check('webhook: wrong signature refused', $rz->parseWebhook($raw, 'deadbeef', 'e') === null && $rz->parseWebhook($raw, null, 'e') === null);

// The processor treats a Checkout order exactly like any provider payment: amount, currency and reference must agree.
[$prov, $store, $proc, $id] = world();
$prov->simulate($id, 'succeeded', 100);
check('an underpayment never marks the order paid (any method)', $proc->reconcile($id) === 'mismatch' && $store->orders['PB-1']['status'] === 'awaiting_payment');

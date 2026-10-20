<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\PrintOrder;
use App\Models\QrSession;
use App\Services\Payments\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    /** POST /orders/{reference}/payment — create (or re-open) a provider payment for the exact server amount. */
    public function store(Request $request, string $reference): JsonResponse
    {
        $order = $this->find($request, $reference);
        $payment = $this->payments->initiate($order);
        $order->refresh();

        return response()->json(['data' => ['payment' => new PaymentResource($payment), 'order_status' => $order->status, 'checkout_available' => $this->payments->checkoutAvailable()]],
            $payment->wasRecentlyCreated ? 201 : 200);
    }

    /** POST /orders/{reference}/payment/checkout: the card / netbanking / wallet window. The amount is fixed here, on the server. */
    public function checkout(Request $request, string $reference): JsonResponse
    {
        $order = $this->find($request, $reference);
        ['payment' => $payment, 'key_id' => $key] = $this->payments->initiateCheckout($order);
        $order->refresh();

        return response()->json(['data' => [
            'checkout' => [
                'key_id' => $key,
                'provider_order_id' => $payment->provider_payment_id,
                'amount_paise' => $payment->amount_paise,
                'currency' => $payment->currency,
                'name' => 'Taprint',
                'description' => 'Print order '.$order->reference,
            ],
            'payment' => new PaymentResource($payment),
            'order_status' => $order->status,
        ]], 201);
    }

    /** POST /orders/{reference}/payment/confirm: the window finished; verify with the provider before anything changes. */
    public function confirm(Request $request, string $reference): JsonResponse
    {
        $order = $this->find($request, $reference);
        $in = $request->validate([
            'provider_order_id' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_]+$/'],
            'provider_payment_id' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_]+$/'],
            'signature' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9]+$/'],
        ]);
        $payment = $this->payments->confirmCheckout($order, $in['provider_order_id'], $in['provider_payment_id'], $in['signature']);
        $order->refresh();

        return response()->json(['data' => ['payment' => new PaymentResource($payment), 'order_status' => $order->status]]);
    }

    /** GET /orders/{reference}/payment — poll; verifies with the provider server-side. */
    public function show(Request $request, string $reference): JsonResponse
    {
        $order = $this->find($request, $reference);
        $all = $order->payments()->latest()->get();
        abort_if($all->isEmpty(), 404, 'No payment has been started for this order.');
        // Every open attempt (QR and card window) is checked; a paid one wins, then an open QR, then an open card window, then the newest.
        $checked = $all->map(fn ($p) => $this->payments->refresh($p));
        $pending = $checked->where('status', \App\Models\Payment::PENDING);
        $payment = $checked->firstWhere('status', \App\Models\Payment::SUCCEEDED)
            ?? $pending->first(fn ($p) => ! $p->isCheckout()) // the QR page keeps its QR while it is open
            ?? $pending->first()
            ?? $checked->first();
        $order->refresh();

        return response()->json(['data' => ['payment' => new PaymentResource($payment), 'order_status' => $order->status, 'checkout_available' => $this->payments->checkoutAvailable()]]);
    }

    private function find(Request $request, string $reference): PrintOrder
    {
        /** @var QrSession $session */
        $session = $request->attributes->get('qr_session');

        return $session->orders()->where('reference', $reference)->firstOr(fn () => abort(404, 'Order not found.'));
    }
}

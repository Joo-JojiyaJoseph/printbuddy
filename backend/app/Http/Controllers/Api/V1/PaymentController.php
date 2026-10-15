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

        return response()->json(['data' => ['payment' => new PaymentResource($payment), 'order_status' => $order->status]],
            $payment->wasRecentlyCreated ? 201 : 200);
    }

    /** GET /orders/{reference}/payment — poll; verifies with the provider server-side. */
    public function show(Request $request, string $reference): JsonResponse
    {
        $order = $this->find($request, $reference);
        $payment = $order->payments()->latest()->first();
        abort_if($payment === null, 404, 'No payment has been started for this order.');
        $payment = $this->payments->refresh($payment);
        $order->refresh();

        return response()->json(['data' => ['payment' => new PaymentResource($payment), 'order_status' => $order->status]]);
    }

    private function find(Request $request, string $reference): PrintOrder
    {
        /** @var QrSession $session */
        $session = $request->attributes->get('qr_session');

        return $session->orders()->where('reference', $reference)->firstOr(fn () => abort(404, 'Order not found.'));
    }
}

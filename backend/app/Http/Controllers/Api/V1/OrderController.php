<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\PrintJob;
use App\Http\Controllers\Controller;
use App\Http\Requests\PrintSettingsRequest;
use App\Http\Resources\OrderResource;
use App\Models\Document;
use App\Models\PrintOrder;
use App\Models\QrSession;
use App\Services\Orders\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    /** POST /quotes — authoritative server price for a document + settings (nothing is stored). */
    public function quote(PrintSettingsRequest $request): JsonResponse
    {
        $doc = $this->document($request, $request->validated('document_id'));
        $quote = $this->orders->quote($doc, $request->printSettings());
        unset($quote['rules_snapshot']);

        return response()->json(['data' => $quote]);
    }

    /** POST /orders — re-prices on the server and stores a pricing snapshot. Idempotency-Key header optional. */
    public function store(PrintSettingsRequest $request): JsonResponse
    {
        $doc = $this->document($request, $request->validated('document_id'));
        $key = $request->header('Idempotency-Key');
        $key = is_string($key) && preg_match('/^[\w\-]{8,64}$/', $key) ? $key : null;
        $order = $this->orders->create($this->session($request), $doc, $request->printSettings(), $key);

        return (new OrderResource($order->load(['document', 'latestPayment'])))->response()->setStatusCode($order->wasRecentlyCreated ? 201 : 200);
    }

    public function show(Request $request, string $reference): OrderResource
    {
        $order = $this->find($request, $reference);
        // A print that was started and then lost (the PHP process died, the printer dialog hung) would stay "preparing" forever.
        // After 3 minutes without progress say so, so the customer sees a clear message and staff can use Retry print.
        PrintJob::query()
            ->where('print_order_id', $order->id)
            ->where('status', PrintJob::WAITING)
            ->where('updated_at', '<', now()->subMinutes(3))
            ->update(['status' => PrintJob::FAILED, 'failure_reason' => 'The shop print computer did not collect this job. Make sure it is on and the Taprint print program is running, then use Retry print.']);
        PrintJob::query()
            ->where('print_order_id', $order->id)
            ->whereIn('status', PrintJob::IN_FLIGHT)
            ->where('updated_at', '<', now()->subMinutes(3))
            ->update(['status' => PrintJob::FAILED, 'failure_reason' => 'Printing did not finish in time. Check the printer, then use Retry print.']);

        return new OrderResource($order->load(['document', 'latestPayment', 'printJob']));
    }

    public function status(Request $request, string $reference): JsonResponse
    {
        $o = $this->find($request, $reference);

        return response()->json(['data' => ['reference' => $o->reference, 'status' => $o->status, 'paid_at' => $o->paid_at?->toIso8601String()]]);
    }

    public function cancel(Request $request, string $reference): OrderResource
    {
        return new OrderResource($this->orders->cancel($this->find($request, $reference))->load(['document', 'latestPayment']));
    }

    private function session(Request $request): QrSession
    {
        return $request->attributes->get('qr_session');
    }

    private function document(Request $request, string $id): Document
    {
        return $this->session($request)->documents()->whereKey($id)->firstOr(fn () => abort(404, 'We could not find that file.'));
    }

    /** Same 404 for "missing" and "someone else's" so references cannot be enumerated. */
    private function find(Request $request, string $reference): PrintOrder
    {
        return $this->session($request)->orders()->where('reference', $reference)->firstOr(fn () => abort(404, 'Order not found.'));
    }
}

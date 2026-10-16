<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Payment;
use App\Models\PrintOrder;
use App\Models\QrSession;
use App\Services\Documents\Conversion\DocumentConverter;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(DocumentConverter $converter): JsonResponse
    {
        $today = now()->startOfDay();

        return response()->json(['data' => [
            'orders_today' => PrintOrder::query()->where('created_at', '>=', $today)->count(),
            'paid_today' => PrintOrder::query()->where('status', 'paid')->where('paid_at', '>=', $today)->count(),
            'revenue_today_paise' => (int) PrintOrder::query()->where('status', 'paid')->where('paid_at', '>=', $today)->sum('total_paise'),
            'revenue_total_paise' => (int) PrintOrder::query()->where('status', 'paid')->sum('total_paise'),
            'active_sessions' => QrSession::query()->usable()->count(),
            'pending_payments' => Payment::query()->where('status', Payment::PENDING)->where('expires_at', '>', now())->count(),
            'payments_needing_review' => Payment::query()->whereNotNull('review_reason')->count(),
            'failed_conversions' => Document::query()->whereNull('deleted_at')->where('status', Document::FAILED)->count(),
            'converting' => Document::query()->whereNull('deleted_at')->where('status', Document::CONVERTING)->count(),
            'documents_due_for_purge' => Document::query()->dueForPurge()->count(),
            'documents_on_disk' => Document::query()->whereNull('deleted_at')->count(),
            'storage_bytes' => (int) Document::query()->whereNull('deleted_at')->sum('size_bytes'),
            'conversion_available' => $converter->available(),
            'payment_provider' => app(\App\Support\Integrations::class)->paymentProvider(),
            'orders_by_status' => PrintOrder::query()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status'),
        ]]);
    }
}

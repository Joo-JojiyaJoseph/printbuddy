<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\SessionController;
use App\Http\Controllers\Api\V1\DocumentController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\SandboxController;
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Controllers\Api\V1\Admin;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Create a new kiosk QR session.
Route::post(
    '/v1/kiosks/{kiosk}/sessions',
    [SessionController::class, 'store']
)->middleware('throttle:session-create');

// Get the current QR session or claim it from a phone.
Route::get(
    '/v1/sessions/current',
    [SessionController::class, 'current']
)->middleware('qr.session');

// End the current QR session.
Route::post(
    '/v1/sessions/current/end',
    [SessionController::class, 'end']
)->middleware('qr.session');


// Documents belonging to the current QR session.
Route::middleware('qr.session')->prefix('v1/documents')->group(function () {
    // List documents.
    Route::get('/', [DocumentController::class, 'index']);

    // Upload a document.
    Route::post('/', [DocumentController::class, 'store']);

    // Combine several documents into one PDF (declared before '/{id}' routes).
    Route::post('/merge', [DocumentController::class, 'merge'])->middleware('throttle:heavy');

    // Get a document.
    Route::get('/{id}', [DocumentController::class, 'show']);

    // Delete a document.
    Route::delete('/{id}', [DocumentController::class, 'destroy']);

    // Retry document processing.
    Route::post('/{id}/retry', [DocumentController::class, 'retry']);

    // Text editing (Word / PDF text / TXT). LibreOffice is heavy, so these are tightly rate-limited.
    Route::post('/{id}/editable', [DocumentController::class, 'editable'])->middleware('throttle:heavy');
    Route::put('/{id}/content', [DocumentController::class, 'saveContent'])->middleware('throttle:heavy');
    Route::post('/{id}/revert', [DocumentController::class, 'revert'])->middleware('throttle:heavy');
});

// Signed, time-limited document preview.
Route::get(
    '/v1/documents/{document}/preview',
    [DocumentController::class, 'preview']
)->middleware('signed')->name('v1.documents.preview');

// Quotes, orders and payments, scoped to the current QR session.
Route::middleware('qr.session')->prefix('v1')->group(function () {
    Route::post('/quotes', [OrderController::class, 'quote'])->middleware('throttle:quote');
    Route::post('/orders', [OrderController::class, 'store'])->middleware('throttle:order');
    Route::get('/orders/{reference}', [OrderController::class, 'show']);
    Route::get('/orders/{reference}/status', [OrderController::class, 'status']);
    Route::post('/orders/{reference}/cancel', [OrderController::class, 'cancel']);
    Route::post('/orders/{reference}/payment', [PaymentController::class, 'store'])->middleware('throttle:order');
    Route::get('/orders/{reference}/payment', [PaymentController::class, 'show']);

    // Fake-provider demo controls; the controller returns 404 unless PAYMENT_PROVIDER=fake.
    Route::post('/orders/{reference}/sandbox/simulate', [SandboxController::class, 'simulate']);
    Route::post('/orders/{reference}/sandbox/expire', [SandboxController::class, 'expire']);
});

// Provider webhooks: authenticated by signature inside the controller, not by session.
Route::post('/v1/webhooks/{provider}', [WebhookController::class, 'handle'])->middleware('throttle:120,1');

// Administration.
Route::prefix('v1/admin')->group(function () {
    Route::post('/login', [Admin\AuthController::class, 'login'])->middleware('throttle:admin-login');

    Route::middleware(['auth:sanctum', 'role:admin,operator,viewer'])->group(function () {
        Route::get('/me', [Admin\AuthController::class, 'me']);
        Route::post('/logout', [Admin\AuthController::class, 'logout']);
        Route::get('/dashboard', Admin\DashboardController::class);
        Route::get('/orders', [Admin\OrderController::class, 'index']);
        Route::get('/orders/{reference}', [Admin\OrderController::class, 'show']);
        Route::get('/payments', [Admin\PaymentController::class, 'index']);
        Route::get('/payments/{id}', [Admin\PaymentController::class, 'show']);
        Route::get('/sessions', [Admin\SessionController::class, 'index']);
        Route::get('/sessions/{id}', [Admin\SessionController::class, 'show']);
        Route::get('/pricing', [Admin\PricingController::class, 'show']);
        Route::get('/settings', [Admin\SettingController::class, 'show']);
    });

    Route::middleware(['auth:sanctum', 'role:admin,operator'])->group(function () {
        Route::post('/orders/{reference}/print/retry', [Admin\OrderController::class, 'retryPrint'])->middleware('throttle:heavy');
        Route::post('/orders/{reference}/cancel', [Admin\OrderController::class, 'cancel']);
        Route::post('/payments/{id}/reconcile', [Admin\PaymentController::class, 'reconcile']);
        Route::post('/sessions/{id}/revoke', [Admin\SessionController::class, 'revoke']);
    });

    Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
        Route::put('/pricing', [Admin\PricingController::class, 'update']);
        Route::put('/settings', [Admin\SettingController::class, 'update']);
    });
});

<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\SessionController;
use App\Http\Controllers\Api\V1\DocumentController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Create a new kiosk QR session.
Route::post(
    '/v1/kiosks/{kiosk}/sessions',
    [SessionController::class, 'store']
)->middleware('throttle:30,1');

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

    // Get a document.
    Route::get('/{id}', [DocumentController::class, 'show']);

    // Delete a document.
    Route::delete('/{id}', [DocumentController::class, 'destroy']);

    // Retry document processing.
    Route::post('/{id}/retry', [DocumentController::class, 'retry']);
});

// Signed, time-limited document preview.
Route::get(
    '/v1/documents/{document}/preview',
    [DocumentController::class, 'preview']
)->middleware('signed')->name('v1.documents.preview');

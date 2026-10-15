<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\SessionResource;
use App\Models\Kiosk;
use App\Models\QrSession;
use App\Services\Sessions\QrSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionController extends Controller
{
    public function __construct(private readonly QrSessionService $sessions) {}

    /** POST /kiosks/{kiosk}/sessions — the kiosk screen asks for a fresh QR code. */
    public function store(Kiosk $kiosk): JsonResponse
    {
        abort_unless($kiosk->active, 404, 'Kiosk not found.');
        ['session' => $session, 'token' => $token] = $this->sessions->create($kiosk);
        $session->load('kiosk');

        return (new SessionResource($session, $token, $this->sessions->joinUrl($token)))->response()->setStatusCode(201);
    }

    /** GET /sessions/current — status for both the kiosk (polling) and the phone (?claim=1). */
    public function current(Request $request): SessionResource
    {
        /** @var QrSession $session */
        $session = $request->attributes->get('qr_session');
        if ($request->boolean('claim')) {
            $this->sessions->claim($session);
        }

        return new SessionResource($session);
    }

    /** POST /sessions/current/end — the customer leaves; the session can no longer be used. */
    public function end(Request $request): JsonResponse
    {
        $this->sessions->revoke($request->attributes->get('qr_session'), 'customer');

        return response()->json(null, 204);
    }
}

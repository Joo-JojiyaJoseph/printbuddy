<?php

namespace App\Http\Middleware;

use App\Models\QrSession;
use App\Services\Sessions\QrSessionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Scopes a customer request to exactly one QR session via the opaque X-Session-Token header.
 * 401: missing/unknown token. 410: session expired or revoked. The resolved session is attached
 * as the `qr_session` request attribute; controllers must never look up another session.
 */
class ResolveQrSession
{
    public function __construct(private readonly QrSessionService $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $session = $this->sessions->findByToken($request->header('X-Session-Token'));
        if ($session === null) {
            return response()->json(['message' => 'We could not find this page. Please scan the code on the printer screen again.'], 401);
        }
        if (! $session->isUsable()) {
            if ($session->status === QrSession::ACTIVE && $session->isExpired()) {
                $session->forceFill(['status' => QrSession::EXPIRED])->save();
            }

            return response()->json(['message' => 'This QR code has expired. Please scan the code on the printer screen again.'], 410);
        }
        if ($this->sessions->ownedByOther($session, $request->header('X-Device-Id'))) {
            return response()->json(['message' => 'Someone else is using this printer right now. Please wait until they finish, then scan the new code on the printer screen.'], 423);
        }
        $request->attributes->set('qr_session', $session);

        return $next($request);
    }
}

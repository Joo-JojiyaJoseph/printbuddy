<?php

namespace App\Http\Middleware;

use App\Models\Kiosk;
use App\Services\Printing\AgentKey;
use App\Support\Settings;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Only a shop PC print program holding a key may collect print jobs. A kiosk key (made in Admin > Kiosks) limits the
 * program to that kiosk's own orders. The older single shared key still works and can collect every kiosk's orders.
 */
class AuthenticateAgent
{
    public function __construct(private readonly Settings $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = (string) $request->bearerToken();
        $kioskId = null;
        $ok = false;
        if ($token !== '' && str_starts_with($token, AgentKey::PREFIX) && strlen($token) <= 80) {
            $kioskId = Kiosk::query()->where('agent_key_hash', AgentKey::hash($token))->where('active', true)->value('id');
            $ok = $kioskId !== null || AgentKey::valid($token, (string) $this->settings->get('agent_key_hash', ''));
        }
        if (! $ok) {
            return response()->json(['message' => 'The print program key is not valid.'], 401);
        }
        $request->attributes->set('agent_kiosk_id', $kioskId);
        Cache::put('agent.last_seen', now()->toIso8601String(), now()->addDays(2));
        if ($kioskId !== null) {
            Cache::put('agent.seen.'.$kioskId, now()->toIso8601String(), now()->addDays(2));
        }

        return $next($request);
    }
}

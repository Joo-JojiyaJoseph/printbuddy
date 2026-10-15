<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Usage: ->middleware('role:admin') or 'role:admin,operator'. Runs after auth:sanctum. */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        if ($user === null || ! in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'This action is not allowed for your role.'], 403);
        }

        return $next($request);
    }
}

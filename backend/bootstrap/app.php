<?php

use App\Exceptions\ApiProblem;
use App\Http\Middleware\AuthenticateAgent;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\ResolveQrSession;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [SecurityHeaders::class]);
        $middleware->alias([
            'qr.session' => ResolveQrSession::class,
            'role' => EnsureRole::class,
            'agent.key' => AuthenticateAgent::class,
        ]);
        // Webhook bodies are verified by signature, never by a CSRF token.
        $middleware->validateCsrfTokens(except: ['api/*']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->render(fn (ApiProblem $e, Request $r) => response()->json(
            array_filter(['message' => $e->getMessage(), 'errors' => $e->errors ?: null]), $e->status));
        // Domain validation errors from the pricing / page-range services carry customer-safe messages.
        $exceptions->render(function (InvalidArgumentException $e, Request $r) {
            if ($r->is('api/*')) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        });
        $exceptions->dontReport([ApiProblem::class]);
    })->create();

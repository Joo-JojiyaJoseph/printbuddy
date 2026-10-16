<?php
namespace {
  echo "\n-- security headers --\n";
}
// Tiny stand-ins for the Laravel/Symfony classes the middleware touches (the framework is not bootable here).
namespace Symfony\Component\HttpFoundation { class HeaderBag { public array $h = []; function set($k, $v) { $this->h[$k] = $v; } function has($k) { return isset($this->h[$k]); } function get($k, $d = null) { return $this->h[$k] ?? $d; } } class Response { public HeaderBag $headers; function __construct() { $this->headers = new HeaderBag(); } } }
namespace Illuminate\Http { class Request { function __construct(public bool $https = false) {} function isSecure() { return $this->https; } } }
namespace {
    require_once __DIR__ . '/../app/Http/Middleware/SecurityHeaders.php';
    $mw = new \App\Http\Middleware\SecurityHeaders();
    $mk = fn (bool $https) => $mw->handle(new \Illuminate\Http\Request($https), fn () => new \Symfony\Component\HttpFoundation\Response());
    $r = $mk(false);
    check('nosniff + no framing + CSP on every API response', $r->headers->get('X-Content-Type-Options') === 'nosniff' && $r->headers->get('X-Frame-Options') === 'DENY' && str_contains($r->headers->get('Content-Security-Policy'), "default-src 'none'"));
    check('responses are not cached', $r->headers->get('Cache-Control') === 'no-store');
    check('HSTS only over https', $r->headers->get('Strict-Transport-Security') === null && $mk(true)->headers->get('Strict-Transport-Security') !== null);
}

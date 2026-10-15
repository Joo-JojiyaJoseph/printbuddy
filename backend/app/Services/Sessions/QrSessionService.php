<?php

namespace App\Services\Sessions;

use App\Models\Kiosk;
use App\Models\QrSession;
use App\Services\Audit\AuditLogger;
use App\Support\Settings;
use Illuminate\Support\Str;

class QrSessionService
{
    public function __construct(private readonly Settings $settings, private readonly AuditLogger $audit) {}

    /**
     * Create a time-limited session. The raw token is returned exactly once (to embed in the QR URL);
     * only its SHA-256 is stored, so a database leak does not expose live sessions.
     *
     * @return array{session: QrSession, token: string}
     */
    public function create(Kiosk $kiosk): array
    {
        $token = Str::random(48); // 48 alphanumerics ≈ 285 bits of entropy
        $session = QrSession::query()->create([
            'kiosk_id' => $kiosk->id,
            'token_hash' => self::hash($token),
            'status' => QrSession::ACTIVE,
            'expires_at' => now()->addMinutes($this->settings->int('session_ttl_minutes')),
        ]);
        $this->audit->log('session.created', $session, ['kiosk' => $kiosk->code]);

        return ['session' => $session, 'token' => $token];
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public function findByToken(?string $token): ?QrSession
    {
        if (! is_string($token) || strlen($token) < 32 || strlen($token) > 128) {
            return null;
        }

        return QrSession::query()->with('kiosk')->where('token_hash', self::hash($token))->first();
    }

    public function joinUrl(string $token): string
    {
        return rtrim(config('printbuddy.frontend_url'), '/').'/s/'.$token;
    }

    public function claim(QrSession $session): void
    {
        if ($session->claimed_at === null) {
            $session->forceFill(['claimed_at' => now()])->save();
            $this->audit->log('session.claimed', $session);
        }
    }

    public function revoke(QrSession $session, string $reason = 'revoked'): void
    {
        if (in_array($session->status, [QrSession::EXPIRED, QrSession::CANCELLED], true)) {
            return;
        }
        $session->forceFill(['status' => QrSession::CANCELLED])->save();
        $this->audit->log('session.revoked', $session, ['reason' => $reason]);
    }

    /** Ensure the customer has time to finish a payment that outlives the session. */
    public function extendUntil(QrSession $session, \DateTimeInterface $until): void
    {
        if ($session->expires_at->lt($until)) {
            $session->forceFill(['expires_at' => $until])->save();
        }
    }

    /** Mark past-due active sessions as expired. Safe to rerun. Returns the number changed. */
    public function expireStale(): int
    {
        $stale = QrSession::query()->where('status', QrSession::ACTIVE)->where('expires_at', '<=', now())->get();
        foreach ($stale as $s) {
            $s->forceFill(['status' => QrSession::EXPIRED])->save();
            $this->audit->log('session.expired', $s);
        }

        return $stale->count();
    }
}

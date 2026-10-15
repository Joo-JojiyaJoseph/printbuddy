<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Records security-relevant events. Callers must never pass document contents, raw tokens,
 * credentials or payment secrets in $meta; a small deny-list is enforced defensively.
 */
class AuditLogger
{
    private const FORBIDDEN_META_KEYS = ['password', 'token', 'secret', 'authorization', 'key_secret', 'webhook_secret'];

    public function log(string $action, Model|string|null $subject = null, array $meta = [], ?int $userId = null): AuditLog
    {
        $subjectType = $subjectId = null;
        if ($subject instanceof Model) {
            $subjectType = class_basename($subject);
            $subjectId = (string) $subject->getKey();
        } elseif (is_string($subject)) {
            $subjectType = $subject;
        }

        foreach (self::FORBIDDEN_META_KEYS as $k) {
            unset($meta[$k]);
        }

        return AuditLog::query()->create([
            'user_id' => $userId ?? Auth::id(),
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'meta' => $meta ?: null,
            'created_at' => now(),
        ]);
    }
}

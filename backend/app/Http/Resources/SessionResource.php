<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\QrSession */
class SessionResource extends JsonResource
{
    public function __construct($resource, private readonly ?string $token = null, private readonly ?string $joinUrl = null)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return array_filter([
            'id' => $this->id,
            'status' => $this->displayStatus(),
            'kiosk' => ['code' => $this->kiosk->code, 'name' => $this->kiosk->name],
            'expires_at' => $this->expires_at->toIso8601String(),
            'claimed_at' => $this->claimed_at?->toIso8601String(),
            'sandbox' => config('printbuddy.payment.provider') === 'fake',
            'token' => $this->token,       // only present on creation (kiosk)
            'join_url' => $this->joinUrl,  // only present on creation (kiosk)
        ], fn ($v) => $v !== null);
    }
}

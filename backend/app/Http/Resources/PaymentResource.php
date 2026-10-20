<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Payment */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $payload = (string) $this->qr_payload;
        $isUpi = str_starts_with($payload, 'upi://');

        return [
            'id' => $this->id,
            'provider' => $this->provider,
            'amount_paise' => $this->amount_paise,
            'currency' => $this->currency,
            'method' => $this->isCheckout() ? 'checkout' : 'upi',
            'status' => $this->status,
            'upi_uri' => $isUpi ? $payload : null,
            'qr_image_url' => ! $isUpi && str_starts_with($payload, 'https://') ? $payload : null,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'verified_at' => $this->verified_at?->toIso8601String(),
        ];
    }
}

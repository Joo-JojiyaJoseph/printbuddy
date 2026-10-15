<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PrintOrder */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $snapshot = $this->pricing_snapshot;
        unset($snapshot['rules_snapshot']); // internal rate table; admins see it via the admin API

        return [
            'reference' => $this->reference,
            'status' => $this->status,
            'currency' => $this->currency,
            'total_paise' => $this->total_paise,
            'document' => $this->whenLoaded('document', fn () => [
                'id' => $this->document->id,
                'name' => $this->document->original_name,
                'page_count' => $this->document->page_count,
            ]),
            'settings' => $this->print_settings,
            'pricing_snapshot' => $snapshot,
            'payment' => $this->whenLoaded('latestPayment', fn () => $this->latestPayment ? new PaymentResource($this->latestPayment) : null),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

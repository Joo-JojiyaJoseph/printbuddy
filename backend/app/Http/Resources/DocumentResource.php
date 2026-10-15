<?php

namespace App\Http\Resources;

use App\Services\Documents\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Customer-facing document metadata. Never includes storage paths or hashes. */
class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'original_name' => $this->original_name,
            'kind' => $this->kind,
            'size_bytes' => $this->size_bytes,
            'status' => $this->status,
            'page_count' => $this->page_count,
            'preview_url' => app(DocumentService::class)->previewUrl($this->resource),
            'failure_reason' => $this->failure_reason,
            'can_retry' => $this->canRetry(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

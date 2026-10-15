<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebhookEvent extends Model
{
    protected $fillable = ['provider', 'event_id', 'signature_valid', 'result', 'payload', 'processed_at'];

    protected function casts(): array
    {
        return ['signature_valid' => 'boolean', 'payload' => 'array', 'processed_at' => 'datetime'];
    }
}

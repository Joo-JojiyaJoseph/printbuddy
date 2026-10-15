<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PricingRule extends Model
{
    protected $fillable = ['paper_size', 'color_mode', 'per_side_paise', 'active'];

    protected function casts(): array
    {
        return ['per_side_paise' => 'integer', 'active' => 'boolean'];
    }
}

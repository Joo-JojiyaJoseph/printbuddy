<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Kiosk extends Model
{
    use HasUuids;

    protected $fillable = ['code', 'name', 'location', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    /** Kiosk URLs use the human-friendly code, never the database id. */
    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /** A mistyped capital letter in a kiosk link must not break it: "Test", "test" and "TEST" are the same kiosk. */
    public function resolveRouteBinding($value, $field = null)
    {
        return $this->newQuery()->whereRaw('lower(code) = ?', [mb_strtolower((string) $value)])->first();
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(QrSession::class);
    }
}

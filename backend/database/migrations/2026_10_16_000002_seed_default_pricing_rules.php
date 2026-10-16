<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Additive and safe to re-run: inserts a default rate for every paper size x colour mode that has no row yet.
// Existing rows (including any the admin has changed) are never touched.
return new class extends Migration
{
    public function up(): void
    {
        $defaults = [
            ['A4', 'bw', 200], ['A4', 'color', 800],
            ['A5', 'bw', 150], ['A5', 'color', 600],
            ['Letter', 'bw', 200], ['Letter', 'color', 800],
        ];
        foreach ($defaults as [$paper, $mode, $paise]) {
            $exists = DB::table('pricing_rules')->where('paper_size', $paper)->where('color_mode', $mode)->exists();
            if (! $exists) {
                DB::table('pricing_rules')->insert(['paper_size' => $paper, 'color_mode' => $mode, 'per_side_paise' => $paise, 'active' => true, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
        \Illuminate\Support\Facades\Cache::forget('printbuddy.pricing_rules');
    }

    public function down(): void
    {
        // Intentionally empty: rates may have been edited since; never delete pricing data on rollback.
    }
};

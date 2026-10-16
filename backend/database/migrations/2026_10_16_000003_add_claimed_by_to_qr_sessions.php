<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('qr_sessions', 'claimed_by')) {
            Schema::table('qr_sessions', fn (Blueprint $t) => $t->string('claimed_by', 64)->nullable());
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('qr_sessions', 'claimed_by')) {
            Schema::table('qr_sessions', fn (Blueprint $t) => $t->dropColumn('claimed_by'));
        }
    }
};

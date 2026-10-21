<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Additive: each kiosk (shop) can have its own print-agent key, so its orders print only on its own PC.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kiosks', function (Blueprint $t) {
            $t->string('agent_key_hash', 64)->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('kiosks', fn (Blueprint $t) => $t->dropColumn('agent_key_hash'));
    }
};

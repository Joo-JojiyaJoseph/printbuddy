<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Additive: lets a job wait for the shop PC's print agent (status `waiting`) and records the hand-over.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_jobs', function (Blueprint $t) {
            $t->string('agent_file', 160)->nullable()->after('failure_reason'); // spool path of the prepared PDF, removed once printed
            $t->json('agent_meta')->nullable()->after('agent_file');             // copies / colour / duplex / paper for the agent
            $t->timestamp('claimed_at')->nullable()->after('sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('print_jobs', function (Blueprint $t) {
            $t->dropColumn(['agent_file', 'agent_meta', 'claimed_at']);
        });
    }
};

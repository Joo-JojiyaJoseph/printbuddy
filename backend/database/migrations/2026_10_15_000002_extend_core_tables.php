<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Additive, backward-compatible extensions to the core tables (all columns nullable or defaulted). */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('kiosks', function (Blueprint $t) {
            $t->string('code', 40)->nullable()->unique()->after('id'); // human-friendly id used in kiosk URLs
        });

        Schema::table('documents', function (Blueprint $t) {
            $t->string('kind', 10)->nullable()->after('detected_mime');          // pdf|jpg|png|txt|ole|ooxml
            $t->unsignedTinyInteger('conversion_attempts')->default(0)->after('failure_reason');
        });

        Schema::table('print_orders', function (Blueprint $t) {
            $t->string('idempotency_key', 64)->nullable()->after('reference');
            $t->unique(['qr_session_id', 'idempotency_key']);
        });

        Schema::table('payments', function (Blueprint $t) {
            $t->string('review_reason', 255)->nullable()->after('verified_at');
            $t->json('provider_meta')->nullable()->after('review_reason');
        });

        Schema::table('webhook_events', function (Blueprint $t) {
            $t->string('result', 30)->nullable()->after('signature_valid');
        });
    }

    public function down(): void
    {
        Schema::table('webhook_events', fn (Blueprint $t) => $t->dropColumn('result'));
        Schema::table('payments', fn (Blueprint $t) => $t->dropColumn(['review_reason', 'provider_meta']));
        Schema::table('print_orders', function (Blueprint $t) {
            $t->dropUnique(['qr_session_id', 'idempotency_key']);
            $t->dropColumn('idempotency_key');
        });
        Schema::table('documents', fn (Blueprint $t) => $t->dropColumn(['kind', 'conversion_attempts']));
        Schema::table('kiosks', fn (Blueprint $t) => $t->dropColumn('code'));
    }
};

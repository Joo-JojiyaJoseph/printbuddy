<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('role', 20)->default('viewer')->index(); // admin | operator | viewer
        });

        Schema::create('kiosks', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 80);
            $t->string('location', 160)->nullable();
            $t->boolean('active')->default(true);
            $t->timestamps();
        });

        Schema::create('qr_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('kiosk_id')->constrained('kiosks')->cascadeOnDelete();
            $t->char('token_hash', 64)->unique();          // sha256 of the URL token; raw token never stored
            $t->string('status', 20)->default('active')->index(); // active | completed | expired | cancelled
            $t->timestamp('expires_at')->index();
            $t->timestamp('claimed_at')->nullable();
            $t->timestamps();
        });

        Schema::create('documents', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('qr_session_id')->constrained('qr_sessions')->cascadeOnDelete();
            $t->string('original_name', 255);
            $t->string('detected_mime', 100);               // from content sniffing, never from the client
            $t->string('storage_path', 255);                // private disk, opaque name
            $t->string('preview_path', 255)->nullable();    // converted PDF
            $t->char('sha256', 64);
            $t->unsignedBigInteger('size_bytes');
            $t->unsignedInteger('page_count')->nullable();
            $t->string('status', 20)->default('uploaded')->index(); // uploaded | converting | ready | failed
            $t->string('failure_reason', 255)->nullable();
            $t->timestamp('delete_after')->index();         // retention
            $t->timestamp('deleted_at')->nullable();
            $t->timestamps();
        });

        Schema::create('pricing_rules', function (Blueprint $t) {
            $t->id();
            $t->string('paper_size', 20);
            $t->string('color_mode', 10);
            $t->unsignedInteger('per_side_paise');
            $t->boolean('active')->default(true);
            $t->timestamps();
            $t->unique(['paper_size', 'color_mode']);
        });

        Schema::create('settings', function (Blueprint $t) {
            $t->string('key', 80)->primary();  // duplex_discount_bps, service_fee_paise, tax_bps, max_upload_mb, max_files, allowed_types
            $t->json('value');
            $t->timestamps();
        });

        Schema::create('print_orders', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('reference', 24)->unique();
            $t->foreignUuid('qr_session_id')->constrained('qr_sessions');
            $t->foreignUuid('document_id')->constrained('documents');
            $t->string('status', 20)->default('draft')->index();
            // draft|uploaded|configured|awaiting_payment|paid|payment_failed|expired|cancelled
            $t->json('print_settings');   // range, copies, colour, paper, orientation, duplex, scaling
            $t->json('pricing_snapshot'); // full quote incl. rules_snapshot
            $t->unsignedInteger('total_paise');
            $t->char('currency', 3)->default('INR');
            $t->timestamp('paid_at')->nullable();
            $t->timestamps();
            $t->index(['status', 'created_at']);
        });

        Schema::create('payments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('print_order_id')->constrained('print_orders');
            $t->string('provider', 30);
            $t->string('provider_payment_id', 100)->nullable()->unique();
            $t->unsignedInteger('amount_paise');
            $t->char('currency', 3)->default('INR');
            $t->string('status', 20)->default('pending')->index(); // pending|succeeded|failed|expired
            $t->string('qr_payload', 1024)->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->timestamp('verified_at')->nullable();
            $t->timestamps();
        });

        Schema::create('webhook_events', function (Blueprint $t) {
            $t->id();
            $t->string('provider', 30);
            $t->string('event_id', 100);
            $t->boolean('signature_valid');
            $t->json('payload');
            $t->timestamp('processed_at')->nullable();
            $t->timestamps();
            $t->unique(['provider', 'event_id']); // idempotency: duplicate deliveries hit this constraint
        });

        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action', 80)->index();
            $t->string('subject_type', 60)->nullable();
            $t->string('subject_id', 40)->nullable();
            $t->json('meta')->nullable(); // never document contents or payment secrets
            $t->timestamp('created_at')->useCurrent()->index();
            $t->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        foreach (['audit_logs', 'webhook_events', 'payments', 'print_orders', 'settings', 'pricing_rules', 'documents', 'qr_sessions', 'kiosks'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('role'));
    }
};

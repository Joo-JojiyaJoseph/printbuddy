<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Additive: one print job per paid order. Order status is untouched (`paid` stays terminal).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('print_jobs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('print_order_id')->unique()->constrained('print_orders');
            $t->string('status', 20)->default('queued')->index(); // queued|preparing|sending|sent|failed
            $t->unsignedSmallInteger('attempts')->default(0);
            $t->string('driver', 20)->nullable();
            $t->string('printer_job_id', 100)->nullable();
            $t->unsignedSmallInteger('pages')->nullable();
            $t->string('failure_reason', 250)->nullable(); // customer-safe, never a path or raw command output
            $t->timestamp('sent_at')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('print_jobs');
    }
};

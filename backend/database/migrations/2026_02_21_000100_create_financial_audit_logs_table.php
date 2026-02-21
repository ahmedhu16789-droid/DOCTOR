<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('financial_audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action_type', 100);
            $table->string('target_entity_type', 120);
            $table->string('target_entity_id', 80)->nullable();
            $table->json('before_snapshot')->nullable();
            $table->json('after_snapshot')->nullable();
            $table->text('reason')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['clinic_id', 'occurred_at']);
            $table->index(['invoice_id', 'occurred_at']);
            $table->index(['target_entity_type', 'target_entity_id'], 'financial_audit_logs_target_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_audit_logs');
    }
};

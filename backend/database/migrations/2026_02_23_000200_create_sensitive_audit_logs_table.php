<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sensitive_audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action_type', 100);
            $table->string('target_record_type', 100);
            $table->unsignedBigInteger('target_record_id');
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['clinic_id', 'patient_id', 'created_at'], 'sensitive_audit_logs_patient_idx');
            $table->index(['target_record_type', 'target_record_id'], 'sensitive_audit_logs_target_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sensitive_audit_logs');
    }
};


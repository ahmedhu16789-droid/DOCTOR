<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctor_payroll_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('doctor_id')->constrained('users')->cascadeOnDelete();
            $table->string('period_month', 7);
            $table->decimal('total_earned', 12, 2)->default(0);
            $table->decimal('total_adjustments', 12, 2)->default(0);
            $table->decimal('total_settled', 12, 2)->default(0);
            $table->enum('status', ['OPEN', 'CLOSED', 'SETTLED'])->default('OPEN');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->unique(['clinic_id', 'doctor_id', 'period_month'], 'doctor_payroll_periods_unique_period');
            $table->index(['clinic_id', 'status'], 'doctor_payroll_periods_clinic_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_payroll_periods');
    }
};

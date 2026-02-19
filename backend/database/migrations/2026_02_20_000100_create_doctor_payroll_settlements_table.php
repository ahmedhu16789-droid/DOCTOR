<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctor_payroll_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('period_id')->constrained('doctor_payroll_periods')->cascadeOnDelete();
            $table->date('settlement_date');
            $table->decimal('amount', 12, 2);
            $table->string('method', 32);
            $table->string('reference')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['clinic_id', 'period_id'], 'doctor_payroll_settlements_clinic_period_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_payroll_settlements');
    }
};

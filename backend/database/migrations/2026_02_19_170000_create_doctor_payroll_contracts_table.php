<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctor_payroll_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('doctor_id')->constrained('users')->cascadeOnDelete();
            $table->enum('model', ['FIXED_SALARY', 'PERCENTAGE', 'HYBRID', 'PER_CASE', 'HYBRID_PER_CASE']);
            $table->decimal('base_salary', 12, 2);
            $table->decimal('commission_percentage', 5, 2)->nullable();
            $table->decimal('per_case_amount', 12, 2)->nullable();
            $table->unsignedInteger('per_day_cap_cases')->nullable();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['clinic_id', 'doctor_id']);
            $table->index(['doctor_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_payroll_contracts');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctor_earnings_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('doctor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('appointment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->string('period_month', 7);
            $table->enum('earning_type', ['COMMISSION', 'FIXED_SALARY_ACCRUAL', 'PER_CASE_ACCRUAL', 'ADJUSTMENT', 'CLAWBACK']);
            $table->decimal('basis_amount', 12, 2);
            $table->decimal('rate', 8, 4)->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3);
            $table->enum('status', ['PENDING', 'APPROVED', 'SETTLED'])->default('PENDING');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['clinic_id', 'doctor_id', 'period_month', 'status'], 'doctor_earnings_ledger_clinic_doctor_period_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_earnings_ledger');
    }
};

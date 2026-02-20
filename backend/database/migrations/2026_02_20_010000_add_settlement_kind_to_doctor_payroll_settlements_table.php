<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('doctor_payroll_settlements', function (Blueprint $table): void {
            $table->enum('settlement_kind', ['PARTIAL', 'FINAL'])
                ->default('PARTIAL')
                ->after('amount');
        });
    }

    public function down(): void
    {
        Schema::table('doctor_payroll_settlements', function (Blueprint $table): void {
            $table->dropColumn('settlement_kind');
        });
    }
};

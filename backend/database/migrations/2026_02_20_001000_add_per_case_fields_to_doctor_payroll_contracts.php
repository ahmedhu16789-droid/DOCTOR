<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('doctor_payroll_contracts', function (Blueprint $table): void {
            if (! Schema::hasColumn('doctor_payroll_contracts', 'per_case_amount')) {
                $table->decimal('per_case_amount', 12, 2)->nullable()->after('commission_percentage');
            }

            if (! Schema::hasColumn('doctor_payroll_contracts', 'per_day_cap_cases')) {
                $table->unsignedInteger('per_day_cap_cases')->nullable()->after('per_case_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('doctor_payroll_contracts', function (Blueprint $table): void {
            $columns = array_filter([
                Schema::hasColumn('doctor_payroll_contracts', 'per_case_amount') ? 'per_case_amount' : null,
                Schema::hasColumn('doctor_payroll_contracts', 'per_day_cap_cases') ? 'per_day_cap_cases' : null,
            ]);

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};

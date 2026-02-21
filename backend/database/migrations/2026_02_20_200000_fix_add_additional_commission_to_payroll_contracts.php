<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('doctor_payroll_contracts', function (Blueprint $table): void {
            if (! Schema::hasColumn('doctor_payroll_contracts', 'additional_services_commission_enabled')) {
                $table->boolean('additional_services_commission_enabled')->default(false);
            }

            if (! Schema::hasColumn('doctor_payroll_contracts', 'additional_services_commission_percentage')) {
                $table->decimal('additional_services_commission_percentage', 5, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('doctor_payroll_contracts', function (Blueprint $table): void {
            if (Schema::hasColumn('doctor_payroll_contracts', 'additional_services_commission_enabled')) {
                $table->dropColumn('additional_services_commission_enabled');
            }
            if (Schema::hasColumn('doctor_payroll_contracts', 'additional_services_commission_percentage')) {
                $table->dropColumn('additional_services_commission_percentage');
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('doctor_payroll_contracts', function (Blueprint $table): void {
            $table->boolean('additional_services_commission_enabled')->default(false)->after('commission_percentage');
            $table->decimal('additional_services_commission_percentage', 5, 2)->nullable()->after('additional_services_commission_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('doctor_payroll_contracts', function (Blueprint $table): void {
            $table->dropColumn(['additional_services_commission_enabled', 'additional_services_commission_percentage']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table): void {
            $table->index(['clinic_id', 'created_at'], 'patients_clinic_created_idx');
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->index(['clinic_id', 'created_at'], 'appointments_clinic_created_idx');
            $table->index(['clinic_id', 'doctor_id', 'date'], 'appointments_clinic_doctor_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table): void {
            $table->dropIndex('patients_clinic_created_idx');
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropIndex('appointments_clinic_created_idx');
            $table->dropIndex('appointments_clinic_doctor_date_idx');
        });
    }
};

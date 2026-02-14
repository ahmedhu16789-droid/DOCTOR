<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table): void {
            $table->index(['clinic_id', 'phone'], 'patients_clinic_phone_idx');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->index(['clinic_id', 'role', 'specialty'], 'users_clinic_role_specialty_idx');
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->index(['clinic_id', 'branch_id', 'doctor_id', 'date', 'status'], 'appointments_availability_idx');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table): void {
            $table->dropIndex('patients_clinic_phone_idx');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_clinic_role_specialty_idx');
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropIndex('appointments_availability_idx');
        });
    }
};

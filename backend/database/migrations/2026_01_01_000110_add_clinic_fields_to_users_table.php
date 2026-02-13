<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('clinic_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->string('role')->nullable()->after('email');
            $table->string('specialty')->nullable()->after('role');
            $table->decimal('consultation_fee', 10, 2)->nullable()->after('specialty');
            $table->json('schedule')->nullable()->after('consultation_fee');
            $table->json('payroll')->nullable()->after('schedule');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('clinic_id');
            $table->dropColumn(['role', 'specialty', 'consultation_fee', 'schedule', 'payroll']);
        });
    }
};

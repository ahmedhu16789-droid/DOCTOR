<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointment_slot_shifts', function (Blueprint $table): void {
            $table->foreignId('applied_by_user_id')->nullable()->after('shift_minutes')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('appointment_slot_shifts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('applied_by_user_id');
        });
    }
};

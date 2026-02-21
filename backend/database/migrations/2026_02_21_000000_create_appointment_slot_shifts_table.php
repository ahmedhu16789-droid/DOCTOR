<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointment_slot_shifts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('doctor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('from_time', 5);
            $table->unsignedSmallInteger('shift_minutes');
            $table->timestamps();

            $table->index(['clinic_id', 'doctor_id', 'branch_id', 'date'], 'appointment_slot_shifts_scope_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_slot_shifts');
    }
};

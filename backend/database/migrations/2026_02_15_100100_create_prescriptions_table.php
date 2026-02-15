<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('medical_encounter_id')->constrained()->cascadeOnDelete();
            $table->string('medication_name');
            $table->string('active_ingredient')->nullable();
            $table->string('dosage')->nullable();
            $table->string('frequency')->nullable();
            $table->string('duration')->nullable();
            $table->text('instructions')->nullable();
            $table->timestamps();

            $table->index(['clinic_id', 'active_ingredient']);
            $table->index(['clinic_id', 'medication_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prescriptions');
    }
};

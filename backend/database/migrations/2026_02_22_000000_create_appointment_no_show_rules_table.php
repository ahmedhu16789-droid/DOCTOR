<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('appointment_no_show_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('specialty')->nullable();
            $table->unsignedSmallInteger('grace_minutes')->nullable();
            $table->boolean('include_waiting')->nullable();
            $table->time('end_of_day_cutoff_time')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['clinic_id', 'branch_id', 'specialty'], 'appointment_no_show_rule_scope_unique');
            $table->index(['clinic_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_no_show_rules');
    }
};

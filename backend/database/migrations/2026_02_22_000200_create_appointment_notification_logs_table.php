<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('appointment_notification_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('appointment_id')->constrained()->cascadeOnDelete();
            $table->string('event', 50);
            $table->string('channel', 20)->default('sms');
            $table->string('locale', 5)->default('en');
            $table->string('recipient', 100)->nullable();
            $table->string('status', 20)->default('QUEUED');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['appointment_id', 'event', 'status'], 'appointment_notification_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_notification_logs');
    }
};

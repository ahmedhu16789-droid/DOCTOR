<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->json('default_limits')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('clinic_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained()->restrictOnDelete();
            $table->enum('subscription_type', ['ANNUAL', 'LIFETIME']);
            $table->string('status')->default('active');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();

            $table->index(['clinic_id', 'status']);
            $table->index(['clinic_id', 'starts_at', 'ends_at']);
        });

        Schema::create('clinic_entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('clinic_subscription_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('max_branches')->nullable();
            $table->unsignedInteger('max_doctors')->nullable();
            $table->unsignedInteger('max_staff')->nullable();
            $table->unsignedInteger('max_patients_per_month')->nullable();
            $table->timestamps();

            $table->unique('clinic_subscription_id');
            $table->index('clinic_id');
        });

        $now = now();

        $defaultLimits = [
            'max_branches' => 3,
            'max_doctors' => 10,
            'max_staff' => 25,
            'max_patients_per_month' => 1000,
        ];

        $planId = DB::table('plans')->insertGetId([
            'code' => 'DEFAULT',
            'name' => 'Default Plan',
            'description' => 'Default plan and limits for existing clinics.',
            'default_limits' => json_encode($defaultLimits),
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $clinics = DB::table('clinics')->select(['id', 'created_at', 'subscription_status'])->get();

        foreach ($clinics as $clinic) {
            $startsAt = $clinic->created_at ?? $now;
            $isLifetime = strtolower((string) $clinic->subscription_status) === 'active';

            $subscriptionId = DB::table('clinic_subscriptions')->insertGetId([
                'clinic_id' => $clinic->id,
                'plan_id' => $planId,
                'subscription_type' => $isLifetime ? 'LIFETIME' : 'ANNUAL',
                'status' => $clinic->subscription_status ?: 'active',
                'starts_at' => $startsAt,
                'ends_at' => $isLifetime ? null : \Illuminate\Support\Carbon::parse($startsAt)->addYear(),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('clinic_entitlements')->insert([
                'clinic_id' => $clinic->id,
                'clinic_subscription_id' => $subscriptionId,
                'max_branches' => $defaultLimits['max_branches'],
                'max_doctors' => $defaultLimits['max_doctors'],
                'max_staff' => $defaultLimits['max_staff'],
                'max_patients_per_month' => $defaultLimits['max_patients_per_month'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_entitlements');
        Schema::dropIfExists('clinic_subscriptions');
        Schema::dropIfExists('plans');
    }
};

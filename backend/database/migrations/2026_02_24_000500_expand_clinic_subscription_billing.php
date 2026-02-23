<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('clinic_subscriptions', function (Blueprint $table): void {
            $table->enum('license_type', ['ANNUAL', 'LIFETIME'])->nullable()->after('subscription_type');
            $table->timestamp('license_starts_at')->nullable()->after('ends_at');
            $table->timestamp('license_ends_at')->nullable()->after('license_starts_at');
            $table->timestamp('hosting_starts_at')->nullable()->after('license_ends_at');
            $table->timestamp('hosting_ends_at')->nullable()->after('hosting_starts_at');
        });

        DB::table('clinic_subscriptions')->orderBy('id')->chunkById(100, function ($subscriptions): void {
            foreach ($subscriptions as $subscription) {
                $licenseType = $subscription->subscription_type ?: 'ANNUAL';
                $licenseStartsAt = $subscription->starts_at;
                $licenseEndsAt = $licenseType === 'LIFETIME' ? null : $subscription->ends_at;

                DB::table('clinic_subscriptions')
                    ->where('id', $subscription->id)
                    ->update([
                        'license_type' => $licenseType,
                        'license_starts_at' => $licenseStartsAt,
                        'license_ends_at' => $licenseEndsAt,
                        'hosting_starts_at' => $licenseStartsAt,
                        'hosting_ends_at' => $subscription->ends_at,
                    ]);
            }
        });

        Schema::table('clinic_subscriptions', function (Blueprint $table): void {
            $table->index(['clinic_id', 'license_starts_at', 'license_ends_at'], 'clinic_subscriptions_license_window_idx');
            $table->index(['clinic_id', 'hosting_starts_at', 'hosting_ends_at'], 'clinic_subscriptions_hosting_window_idx');
        });

        Schema::create('clinic_subscription_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('clinic_subscription_id')->constrained()->cascadeOnDelete();
            $table->enum('payment_kind', ['LICENSE', 'HOSTING']);
            $table->unsignedInteger('period_years')->default(1);
            $table->decimal('amount', 12, 2);
            $table->timestamp('paid_at');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->string('receipt_ref')->nullable();
            $table->timestamps();

            $table->index(['clinic_subscription_id', 'payment_kind', 'paid_at'], 'clinic_subscription_payments_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_subscription_payments');

        Schema::table('clinic_subscriptions', function (Blueprint $table): void {
            $table->dropIndex('clinic_subscriptions_license_window_idx');
            $table->dropIndex('clinic_subscriptions_hosting_window_idx');
            $table->dropColumn([
                'license_type',
                'license_starts_at',
                'license_ends_at',
                'hosting_starts_at',
                'hosting_ends_at',
            ]);
        });
    }
};

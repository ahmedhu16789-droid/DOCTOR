<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('reconciliation_summaries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cash_session_id')->constrained('cash_sessions')->cascadeOnDelete();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('reconciliation_date');
            $table->decimal('opening_balance', 12, 2)->default(0);
            $table->decimal('expected_cash', 12, 2)->default(0);
            $table->decimal('collected_cash', 12, 2)->default(0);
            $table->decimal('variance', 12, 2)->default(0);
            $table->timestamps();

            $table->index(['clinic_id', 'branch_id', 'reconciliation_date'], 'recon_summaries_scope_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reconciliation_summaries');
    }
};

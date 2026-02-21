<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->foreignId('cash_session_id')->nullable()->after('invoice_id')->constrained('cash_sessions')->nullOnDelete();
            $table->index(['clinic_id', 'cash_session_id'], 'transactions_clinic_session_idx');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropIndex('transactions_clinic_session_idx');
            $table->dropConstrainedForeignId('cash_session_id');
        });
    }
};

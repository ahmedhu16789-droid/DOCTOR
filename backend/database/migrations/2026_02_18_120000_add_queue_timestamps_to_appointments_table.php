<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table): void {
            $table->timestamp('called_at')->nullable()->after('status');
            $table->timestamp('started_at')->nullable()->after('called_at');
            $table->timestamp('completed_at')->nullable()->after('started_at');
            $table->timestamp('no_show_at')->nullable()->after('completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropColumn(['called_at', 'started_at', 'completed_at', 'no_show_at']);
        });
    }
};

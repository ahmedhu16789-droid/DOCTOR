<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('medical_encounters', function (Blueprint $table): void {
            $table->date('next_visit_date')->nullable()->after('plan');
        });
    }

    public function down(): void
    {
        Schema::table('medical_encounters', function (Blueprint $table): void {
            $table->dropColumn('next_visit_date');
        });
    }
};

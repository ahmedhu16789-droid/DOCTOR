<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('medical_encounters', function (Blueprint $table): void {
            $table->string('next_visit_type')->nullable()->after('next_visit_date');
            $table->integer('next_visit_interval')->nullable()->after('next_visit_type');
        });
    }

    public function down(): void
    {
        Schema::table('medical_encounters', function (Blueprint $table): void {
            $table->dropColumn(['next_visit_type', 'next_visit_interval']);
        });
    }
};

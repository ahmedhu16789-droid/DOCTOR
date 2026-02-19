<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->json('exam_finding_templates')->nullable()->after('payroll');
            $table->json('diagnosis_templates')->nullable()->after('exam_finding_templates');
            $table->json('plan_templates')->nullable()->after('diagnosis_templates');
        });
    }

   public function down(): void
{
    // SQLite may not have the column (or migration state may be out of sync)
    if (Schema::hasColumn('users', 'exam_finding_templates')) {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('exam_finding_templates');
        });
    }

    if (Schema::hasColumn('users', 'diagnosis_templates')) {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('diagnosis_templates');
        });
    }

    if (Schema::hasColumn('users', 'plan_templates')) {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('plan_templates');
        });
    }
}

};

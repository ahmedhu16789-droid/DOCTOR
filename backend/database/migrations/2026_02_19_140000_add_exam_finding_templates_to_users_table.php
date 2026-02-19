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
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['exam_finding_templates', 'diagnosis_templates', 'plan_templates']);
        });
    }
};

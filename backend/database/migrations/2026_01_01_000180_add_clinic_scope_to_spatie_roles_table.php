<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('roles')) {
            return;
        }

        Schema::table('roles', function (Blueprint $table) {
            if (! Schema::hasColumn('roles', 'clinic_id')) {
                $table->unsignedBigInteger('clinic_id')->nullable()->after('id');
                $table->index(['clinic_id', 'name']);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasColumn('roles', 'clinic_id')) {
            return;
        }

        Schema::table('roles', function (Blueprint $table) {
            $table->dropIndex(['clinic_id', 'name']);
            $table->dropColumn('clinic_id');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('clinics', function (Blueprint $table): void {
            $table->uuid('public_uuid')->nullable()->after('id')->unique();
        });

        DB::table('clinics')->select(['id'])->orderBy('id')->chunkById(100, function ($clinics): void {
            foreach ($clinics as $clinic) {
                DB::table('clinics')->where('id', $clinic->id)->update([
                    'public_uuid' => (string) Str::uuid(),
                ]);
            }
        });

        Schema::table('clinics', function (Blueprint $table): void {
            $table->uuid('public_uuid')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('clinics', function (Blueprint $table): void {
            $table->dropUnique('clinics_public_uuid_unique');
            $table->dropColumn('public_uuid');
        });
    }
};

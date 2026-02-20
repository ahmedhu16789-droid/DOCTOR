<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->cleanupSqliteTempUsersTable();

        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        $this->cleanupSqliteTempUsersTable();
        $this->backfillNullEmails();

        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
        });
    }

    private function backfillNullEmails(): void
    {
        DB::table('users')
            ->whereNull('email')
            ->orderBy('id')
            ->select('id')
            ->get()
            ->each(function (object $user): void {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update([
                        'email' => sprintf('restored-user-%d@local.invalid', $user->id),
                    ]);
            });
    }

    private function cleanupSqliteTempUsersTable(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::statement('DROP TABLE IF EXISTS "__temp__users"');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('medications', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('active_ingredient')->nullable();
            $table->string('form')->nullable();
            $table->string('strength')->nullable();
            $table->timestamps();

            $table->index('name');
            $table->index('active_ingredient');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medications');
    }
};

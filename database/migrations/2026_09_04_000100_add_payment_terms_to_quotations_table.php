<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->unsignedTinyInteger('advance_percentage')->default(50)->after('total');
            $table->text('extra_terms')->nullable()->after('advance_percentage');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn(['advance_percentage', 'extra_terms']);
        });
    }
};

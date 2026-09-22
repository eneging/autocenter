<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_catalog_items', function (Blueprint $table) {
            $table->text('measurement_hint')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('site_catalog_items', function (Blueprint $table) {
            $table->dropColumn('measurement_hint');
        });
    }
};

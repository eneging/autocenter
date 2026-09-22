<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_requests', function (Blueprint $table) {
            $table->string('vehicle_plate')->nullable()->after('description');
            $table->string('vehicle_brand')->nullable()->after('vehicle_plate');
            $table->string('vehicle_model')->nullable()->after('vehicle_brand');
        });
    }

    public function down(): void
    {
        Schema::table('project_requests', function (Blueprint $table) {
            $table->dropColumn(['vehicle_plate', 'vehicle_brand', 'vehicle_model']);
        });
    }
};

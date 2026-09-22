<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->date('next_maintenance_at')->nullable()->after('color');
            $table->date('maintenance_reminded_for')->nullable()->after('next_maintenance_at');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['next_maintenance_at', 'maintenance_reminded_for']);
        });
    }
};

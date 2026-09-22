<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->string('bank_bcp_account')->nullable();
            $table->string('bank_cci_account')->nullable();
            $table->string('yape_number')->nullable();
            $table->string('yape_holder_name')->nullable();
            $table->string('manager_name')->nullable();
            $table->string('manager_title')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->dropColumn(['bank_bcp_account', 'bank_cci_account', 'yape_number', 'yape_holder_name', 'manager_name', 'manager_title']);
        });
    }
};

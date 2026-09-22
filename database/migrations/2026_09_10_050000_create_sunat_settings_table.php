<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sunat_settings', function (Blueprint $table) {
            $table->id();
            $table->string('env')->default('sandbox');
            $table->string('token_production')->nullable();
            $table->timestamps();
        });

        Schema::table('sunat_documents', function (Blueprint $table) {
            $table->string('entorno')->nullable()->after('estado');
        });
    }

    public function down(): void
    {
        Schema::table('sunat_documents', function (Blueprint $table) {
            $table->dropColumn('entorno');
        });

        Schema::dropIfExists('sunat_settings');
    }
};

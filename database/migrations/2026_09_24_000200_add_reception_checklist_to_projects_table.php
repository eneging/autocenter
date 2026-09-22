<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Digitaliza la hoja de "Orden de Servicio" en papel: kilometraje, nivel de combustible,
 * la revisión detallada de recepción del vehículo y las autorizaciones del cliente.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->unsignedInteger('mileage')->nullable()->after('problem_description');
            $table->string('fuel_level')->nullable()->after('mileage');
            $table->json('reception_checklist')->nullable()->after('fuel_level');
            $table->boolean('client_requests_prior_budget')->default(false)->after('reception_checklist');
            $table->boolean('client_authorizes_repair_without_budget')->default(false)->after('client_requests_prior_budget');
            $table->boolean('client_authorizes_test_drive')->default(false)->after('client_authorizes_repair_without_budget');
            $table->dateTime('client_accepted_terms_at')->nullable()->after('client_authorizes_test_drive');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn([
                'mileage', 'fuel_level', 'reception_checklist',
                'client_requests_prior_budget', 'client_authorizes_repair_without_budget',
                'client_authorizes_test_drive', 'client_accepted_terms_at',
            ]);
        });
    }
};

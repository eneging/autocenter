<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('vehicle_id')->nullable()->after('client_id')->constrained()->nullOnDelete();
            $table->text('problem_description')->nullable()->after('description');
            $table->text('technical_diagnostic')->nullable()->after('problem_description');
            $table->text('solution')->nullable()->after('technical_diagnostic');
            $table->string('service_type')->nullable()->after('solution');
            $table->decimal('budget', 12, 2)->nullable()->after('estimated_cost');
            $table->string('estimated_time')->nullable()->after('estimated_delivery_at');
            $table->date('exit_date')->nullable()->after('estimated_time');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vehicle_id');
            $table->dropColumn([
                'problem_description',
                'technical_diagnostic',
                'solution',
                'service_type',
                'budget',
                'estimated_time',
                'exit_date',
            ]);
        });
    }
};

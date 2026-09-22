<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['Repuesto', 'Herramienta'])->default('Repuesto');
            $table->string('code')->unique()->nullable();
            $table->string('name');
            $table->integer('stock')->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->string('qr_data')->unique()->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};

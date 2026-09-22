<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->unsignedInteger('min_stock')->default(0)->after('stock');
            $table->decimal('sale_price', 12, 2)->nullable()->after('unit_cost');
            $table->boolean('includes_igv')->default(false)->after('sale_price');
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['Entrada', 'Salida']);
            $table->unsignedInteger('quantity');
            $table->integer('stock_after');
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->string('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn(['min_stock', 'sale_price', 'includes_igv']);
        });
    }
};

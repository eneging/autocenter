<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_register_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['Ingreso', 'Gasto Fijo', 'Gasto Variable']);
            $table->enum('payment_method', ['Yape', 'Efectivo', 'Transferencia'])->nullable();
            $table->string('category');
            $table->decimal('amount', 12, 2);
            $table->boolean('is_taxable')->default(false);
            $table->decimal('igv_amount', 12, 2)->default(0);
            $table->text('description')->nullable();
            $table->date('transaction_date');
            $table->foreignId('registered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};

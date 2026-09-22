<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('complaint_book_entries', function (Blueprint $table) {
            $table->id();
            $table->enum('tipo', ['reclamo', 'queja']);
            $table->enum('bien_tipo', ['producto', 'servicio']);
            $table->decimal('monto_reclamado', 10, 2)->nullable();
            $table->text('bien_descripcion');
            $table->string('consumidor_nombre');
            $table->string('consumidor_domicilio');
            $table->string('consumidor_documento');
            $table->string('consumidor_telefono')->nullable();
            $table->string('consumidor_email');
            $table->boolean('es_menor')->default(false);
            $table->string('representante_nombre')->nullable();
            $table->text('detalle');
            $table->text('pedido');
            $table->boolean('enviar_copia_email')->default(false);
            $table->string('consumidor_ip')->nullable();
            $table->timestamp('consumidor_acepta_at');
            $table->text('respuesta_texto')->nullable();
            $table->date('respuesta_fecha')->nullable();
            $table->enum('estado', ['pendiente', 'respondido'])->default('pendiente');
            $table->string('access_token', 40)->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('complaint_book_entries');
    }
};

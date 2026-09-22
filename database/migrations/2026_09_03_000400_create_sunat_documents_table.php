<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sunat_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('tipo');
            $table->string('serie');
            $table->unsignedInteger('numero');
            $table->string('moneda')->default('PEN');
            $table->string('estado');
            $table->text('mensaje')->nullable();
            $table->string('hash')->nullable();
            $table->string('xml_url')->nullable();
            $table->string('cdr_url')->nullable();
            $table->string('pdf_ticket_url')->nullable();
            $table->string('pdf_a4_url')->nullable();
            $table->json('payload')->nullable();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sunat_documents');
    }
};

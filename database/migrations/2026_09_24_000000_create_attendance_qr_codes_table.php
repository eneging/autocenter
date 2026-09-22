<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_qr_codes', function (Blueprint $table) {
            $table->id();
            $table->string('token')->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            // null = sin vencimiento ("infinito"), lo decide el administrador al generarlo.
            $table->dateTime('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->dateTime('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_qr_codes');
    }
};

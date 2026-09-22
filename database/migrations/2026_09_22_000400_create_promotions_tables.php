<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['evento', 'sorteo', 'cupon']);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('image_url')->nullable();
            $table->unsignedTinyInteger('discount_percent')->nullable();
            $table->string('coupon_prefix', 12)->nullable();
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('winner_entry_id')->nullable();
            $table->timestamps();
        });

        Schema::create('promotion_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->string('document_number')->nullable();
            $table->string('coupon_code')->nullable()->unique();
            $table->dateTime('redeemed_at')->nullable();
            $table->boolean('accepted_terms')->default(false);
            $table->timestamps();

            $table->unique(['promotion_id', 'phone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_entries');
        Schema::dropIfExists('promotions');
    }
};

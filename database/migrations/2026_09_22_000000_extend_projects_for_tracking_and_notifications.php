<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->text('client_comment')->nullable()->after('notes');
            $table->unsignedTinyInteger('client_rating')->nullable()->after('client_comment');
            $table->dateTime('client_commented_at')->nullable()->after('client_rating');
            $table->string('last_notified_status')->nullable()->after('client_commented_at');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['client_comment', 'client_rating', 'client_commented_at', 'last_notified_status']);
        });
    }
};

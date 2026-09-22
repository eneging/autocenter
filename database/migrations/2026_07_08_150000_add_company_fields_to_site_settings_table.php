<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->string('company_name')->nullable()->after('id');
            $table->string('tagline')->nullable()->after('company_name');
            $table->string('project_role')->nullable()->after('tagline');
            $table->string('community_platform')->nullable()->after('social_embeds');
            $table->string('community_join_method')->nullable()->after('community_platform');
            $table->string('community_qr_url')->nullable()->after('community_join_method');
        });
    }

    public function down(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->dropColumn([
                'company_name',
                'tagline',
                'project_role',
                'community_platform',
                'community_join_method',
                'community_qr_url',
            ]);
        });
    }
};

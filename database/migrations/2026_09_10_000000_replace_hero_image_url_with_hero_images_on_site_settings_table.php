<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->json('hero_images')->nullable()->after('hero_image_url');
        });

        DB::table('site_settings')->whereNotNull('hero_image_url')->get()->each(function ($row) {
            DB::table('site_settings')
                ->where('id', $row->id)
                ->update(['hero_images' => json_encode([$row->hero_image_url])]);
        });

        Schema::table('site_settings', function (Blueprint $table) {
            $table->dropColumn('hero_image_url');
        });
    }

    public function down(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->string('hero_image_url')->nullable()->after('hero_subtitle');
        });

        DB::table('site_settings')->whereNotNull('hero_images')->get()->each(function ($row) {
            $images = json_decode($row->hero_images, true) ?? [];
            DB::table('site_settings')
                ->where('id', $row->id)
                ->update(['hero_image_url' => $images[0] ?? null]);
        });

        Schema::table('site_settings', function (Blueprint $table) {
            $table->dropColumn('hero_images');
        });
    }
};

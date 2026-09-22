<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_services', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('title');
            $table->string('video_url')->nullable()->after('icon_url');
        });

        foreach (DB::table('site_services')->get() as $service) {
            $base = Str::slug($service->title) ?: 'servicio';
            $slug = $base;
            $suffix = 2;
            while (DB::table('site_services')->where('slug', $slug)->where('id', '!=', $service->id)->exists()) {
                $slug = "{$base}-{$suffix}";
                $suffix++;
            }
            DB::table('site_services')->where('id', $service->id)->update(['slug' => $slug]);
        }

        Schema::table('site_services', function (Blueprint $table) {
            $table->unique('slug');
        });
    }

    public function down(): void
    {
        Schema::table('site_services', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn(['slug', 'video_url']);
        });
    }
};

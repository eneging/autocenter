<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_name',
        'company_ruc',
        'tagline',
        'project_role',
        'hero_title',
        'hero_subtitle',
        'hero_images',
        'about_text',
        'about_video_url',
        'contact_phone',
        'contact_email',
        'contact_address',
        'contact_whatsapp',
        'social_embeds',
        'community_platform',
        'community_join_method',
        'community_qr_url',
        'bank_bcp_account',
        'bank_cci_account',
        'yape_number',
        'yape_holder_name',
        'manager_name',
        'manager_title',
    ];

    protected function casts(): array
    {
        return [
            'social_embeds' => 'array',
            'hero_images' => 'array',
        ];
    }

    public static function current(): self
    {
        $settings = static::find(1);

        if (! $settings) {
            // `id` no es asignable en masa: se fuerza para que la configuración sea siempre la fila 1.
            $settings = (new static)->forceFill(['id' => 1]);
            $settings->save();
        }

        return $settings;
    }
}

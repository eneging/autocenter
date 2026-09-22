<?php

namespace App\Services;

use App\Models\SiteSetting;
use Illuminate\Http\UploadedFile;

/**
 * Sube la foto a Cloudinary con la marca de agua del taller ya "quemada" en la imagen:
 * el cliente solo recibe la versión con marca, nunca el original.
 */
class WatermarkService
{
    public function __construct(private readonly CloudinaryUploader $uploader) {}

    public function upload(UploadedFile $image, string $folder = 'taller/tracking'): string
    {
        return $this->uploader->upload($image, $folder, 'image', [
            'transformation' => $this->transformation(),
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    public function transformation(): array
    {
        $steps = [
            ['width' => 1600, 'height' => 1600, 'crop' => 'limit'],
        ];

        $logo = config('taller.watermark.logo_public_id');
        if ($logo) {
            // Capa en tres componentes (abrir, escalar, aplicar): la forma en un solo componente pierde el logo.
            $steps[] = ['overlay' => str_replace('/', ':', $logo)];
            $steps[] = ['width' => 0.22, 'flags' => 'relative', 'crop' => 'scale'];
            $steps[] = ['opacity' => 85, 'flags' => 'layer_apply', 'gravity' => 'north_east', 'x' => 24, 'y' => 24];
        }

        $text = config('taller.watermark.text') ?: SiteSetting::current()->company_name;
        if ($text) {
            $steps[] = [
                'overlay' => [
                    'font_family' => 'Arial',
                    'font_size' => 44,
                    'font_weight' => 'bold',
                    'text' => $text,
                ],
                'color' => '#FFFFFF',
                'opacity' => 65,
                'gravity' => 'south_east',
                'x' => 24,
                'y' => 24,
            ];
        }

        return $steps;
    }
}

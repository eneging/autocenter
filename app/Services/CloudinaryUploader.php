<?php

namespace App\Services;

use Cloudinary\Cloudinary;
use Illuminate\Http\UploadedFile;

class CloudinaryUploader
{
    public function upload(UploadedFile $file, string $folder, string $resourceType = 'image', array $extraOptions = []): string
    {
        $cloudinary = new Cloudinary(['cloud' => config('services.cloudinary')]);

        $attempts = 0;
        $lastException = null;

        while ($attempts < 3) {
            try {
                $options = [
                    'folder' => $folder,
                    'resource_type' => $resourceType,
                ];

                // Las fotos de iPhone llegan en HEIC, que casi ningun navegador
                // puede mostrar en un <img>. Forzamos JPG para que la URL que
                // guardamos siempre se pueda ver en el sitio.
                if ($resourceType === 'image') {
                    $options['format'] = 'jpg';
                }

                $result = $cloudinary->uploadApi()->upload($file->getRealPath(), [...$options, ...$extraOptions]);

                return $result['secure_url'];
            } catch (\Throwable $exception) {
                $lastException = $exception;
                $attempts++;

                // Cloudinary a veces corta la conexion TLS a mitad de la subida (cURL 56);
                // un segundo intento casi siempre funciona, asi que no vale la pena
                // hacer que el usuario vea el error sin haber reintentado antes.
                if ($attempts < 3) {
                    usleep(500_000 * $attempts);
                }
            }
        }

        throw $lastException;
    }
}

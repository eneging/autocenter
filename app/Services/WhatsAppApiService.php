<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppApiService
{
    public function isConfigured(): bool
    {
        return filled(config('services.whatsapp.token')) && filled(config('services.whatsapp.phone_number_id'));
    }

    public function sendText(string $to, string $text): void
    {
        Http::withToken(config('services.whatsapp.token'))
            ->post('https://graph.facebook.com/v21.0/'.config('services.whatsapp.phone_number_id').'/messages', [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'text',
                'text' => ['body' => $text],
            ]);
    }

    /** Igual que sendText pero informa si Meta aceptó el mensaje (para notificaciones automáticas). */
    public function send(string $to, string $text): bool
    {
        if (! $this->isConfigured()) {
            return false;
        }

        $response = Http::withToken(config('services.whatsapp.token'))
            ->timeout(15)
            ->post('https://graph.facebook.com/v21.0/'.config('services.whatsapp.phone_number_id').'/messages', [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'text',
                'text' => ['body' => $text],
            ]);

        if (! $response->successful()) {
            Log::warning('WhatsApp: envío rechazado', ['to' => $to, 'status' => $response->status(), 'body' => $response->json()]);
        }

        return $response->successful();
    }
}

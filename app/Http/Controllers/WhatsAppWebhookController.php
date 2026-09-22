<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Jobs\ProcessWhatsAppMessage;

class WhatsAppWebhookController extends Controller
{
    public function verify(Request $request)
    {
        // Ojo: PHP convierte automáticamente los puntos de los query params
        // en guiones bajos, así que "hub.mode" llega como "hub_mode".
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        if ($mode === 'subscribe' && $token === config('services.whatsapp.verify_token')) {
            return response($challenge, 200);
        }

        return response('Forbidden', 403);
    }

   public function receive(Request $request, \App\Services\ClaudeService $claude, \App\Services\WhatsAppApiService $whatsapp)
{
    $signature = $request->header('X-Hub-Signature-256', '');
    $expected = 'sha256=' . hash_hmac('sha256', $request->getContent(), config('services.whatsapp.app_secret'));

    if (!hash_equals($expected, $signature)) {
        return response('Invalid signature', 403);
    }

    $message = data_get($request->all(), 'entry.0.changes.0.value.messages.0');

    if ($message && isset($message['text']['body'])) {
        $reply = $claude->reply($message['from'], $message['text']['body']);
        $whatsapp->sendText($message['from'], $reply);
    }

    return response()->json(['status' => 'ok']);
}
}
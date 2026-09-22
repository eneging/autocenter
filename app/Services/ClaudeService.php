<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Project;
use App\Models\SiteCatalogItem;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ClaudeService
{
    protected function systemPrompt(): string
    {
        $shop = SiteSetting::current();
        $name = $shop->company_name ?: config('app.name');
        $address = $shop->contact_address ? " Dirección: {$shop->contact_address}." : '';

        return "Eres el asistente virtual de {$name}, un taller de reparación y mantenimiento de vehículos (incluye mantenimiento eléctrico automotriz).{$address} "
            .'Responde por WhatsApp de forma cálida y breve. Para dar cualquier precio SIEMPRE usa cotizar_servicio, nunca inventes; los precios son referenciales y el diagnóstico final lo hace el técnico en el taller. '
            .'Si el cliente pregunta por su vehículo o su orden, usa consultar_estado_orden. '
            .'Para citas usa agendar_cita: primero consulta horarios, ofrece 2-3 opciones, y confirma con confirmar_slot cuando el cliente elija. '
            .'No des diagnósticos mecánicos definitivos por chat: invita a traer el vehículo.';
    }

    protected function tools(): array
    {
        return [
            [
                'name' => 'cotizar_servicio',
                'description' => 'Busca el precio referencial de un servicio en el catálogo del taller.',
                'input_schema' => [
                    'type' => 'object',
                    'properties' => ['servicio' => ['type' => 'string', 'description' => 'ej: cambio de aceite, revisión eléctrica, alternador']],
                    'required' => ['servicio'],
                ],
            ],
            [
                'name' => 'consultar_estado_orden',
                'description' => 'Consulta el estado de las órdenes de servicio recientes del cliente que escribe (se identifica por su número de WhatsApp).',
                'input_schema' => ['type' => 'object', 'properties' => new \stdClass, 'required' => []],
            ],
            [
                'name' => 'agendar_cita',
                'description' => 'Consulta horarios disponibles o confirma una cita para revisión del vehículo.',
                'input_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'fecha' => ['type' => 'string', 'description' => 'YYYY-MM-DD, opcional'],
                        'nombre_cliente' => ['type' => 'string'],
                        'confirmar_slot' => ['type' => 'string', 'description' => 'ID del horario a confirmar'],
                    ],
                    'required' => [],
                ],
            ],
        ];
    }

    protected function runCotizarServicio(array $input): array
    {
        $q = mb_strtolower(trim($input['servicio'] ?? ''));
        $items = SiteCatalogItem::where('is_active', true)->get();

        foreach ($items as $item) {
            $title = mb_strtolower($item->title);
            $category = mb_strtolower((string) $item->category);
            if ($q !== '' && (str_contains($title, $q) || str_contains($q, $title) || str_contains($category, $q))) {
                return [
                    'encontrado' => true,
                    'moneda' => 'PEN',
                    'servicio' => $item->title,
                    'precio_desde' => (float) $item->price,
                    'unidad' => $item->unit_label,
                    'detalle' => $item->description,
                ];
            }
        }

        return ['encontrado' => false, 'servicios_disponibles' => $items->pluck('title')->values()->all()];
    }

    protected function runConsultarEstadoOrden(string $phone): array
    {
        $digits = substr(preg_replace('/\D+/', '', $phone), -9);

        $client = Client::where('phone', 'like', '%'.$digits)->latest()->first();
        if (! $client || strlen($digits) < 9) {
            return ['encontrado' => false, 'motivo' => 'No encontré órdenes asociadas a este número.'];
        }

        $orders = Project::with('vehicle')
            ->where('client_id', $client->id)
            ->whereNotNull('vehicle_id')
            ->latest()
            ->limit(3)
            ->get()
            ->map(fn (Project $order) => [
                'orden' => $order->code,
                'vehiculo' => trim(($order->vehicle?->brand ?? '').' '.($order->vehicle?->model ?? '').' '.($order->vehicle?->plate ?? '')),
                'estado' => $order->status,
                'tiempo_estimado' => $order->estimated_time,
                'seguimiento' => rtrim(config('taller.whatsapp.tracking_base_url') ?: config('app.url'), '/').'/seguimiento/'.$order->client_access_token,
            ]);

        return $orders->isEmpty()
            ? ['encontrado' => false, 'motivo' => 'No hay órdenes registradas para este número.']
            : ['encontrado' => true, 'ordenes' => $orders->all()];
    }

    /** Horarios de los próximos días hábiles (9:00, 11:00 y 15:00); los ya reservados se guardan en caché. */
    protected function availability(): array
    {
        $booked = Cache::get('wa_booked_slots', []);
        $slots = [];

        for ($day = now()->startOfDay(), $added = 0; $added < 5; $day = $day->copy()->addDay()) {
            if ($day->isSunday() || $day->lte(now()->startOfDay())) {
                continue;
            }

            foreach (['09:00', '11:00', '15:00'] as $hour) {
                $id = $day->format('Ymd').str_replace(':', '', $hour);
                $slots[] = ['id' => $id, 'fecha' => $day->toDateString(), 'hora' => $hour, 'ocupado' => in_array($id, $booked, true)];
            }

            $added++;
        }

        return $slots;
    }

    protected function runAgendarCita(array $input): array
    {
        $slots = $this->availability();

        if (! empty($input['confirmar_slot'])) {
            foreach ($slots as $slot) {
                if ($slot['id'] === $input['confirmar_slot'] && ! $slot['ocupado']) {
                    $booked = Cache::get('wa_booked_slots', []);
                    $booked[] = $slot['id'];
                    Cache::forever('wa_booked_slots', array_values(array_unique($booked)));

                    return ['confirmado' => true, 'fecha' => $slot['fecha'], 'hora' => $slot['hora']];
                }
            }

            return ['confirmado' => false, 'motivo' => 'Ese horario ya no está disponible.'];
        }

        $disponibles = array_values(array_filter($slots, fn ($s) => ! $s['ocupado']));
        if (! empty($input['fecha'])) {
            $disponibles = array_values(array_filter($disponibles, fn ($s) => $s['fecha'] === $input['fecha']));
        }

        return ['confirmado' => false, 'opciones' => array_slice($disponibles, 0, 3)];
    }

    protected function runTool(string $name, array $input, string $phone): array
    {
        return match ($name) {
            'cotizar_servicio' => $this->runCotizarServicio($input),
            'consultar_estado_orden' => $this->runConsultarEstadoOrden($phone),
            'agendar_cita' => $this->runAgendarCita($input),
            default => ['error' => "Herramienta desconocida: $name"],
        };
    }

    protected function callClaude(array $messages): array
    {
        return Http::withHeaders([
            'x-api-key' => config('services.anthropic.key'),
            'anthropic-version' => '2023-06-01',
        ])->post('https://api.anthropic.com/v1/messages', [
            'model' => config('services.anthropic.model'),
            'max_tokens' => 500,
            'system' => $this->systemPrompt(),
            'tools' => $this->tools(),
            'messages' => $messages,
        ])->json();
    }

    public function reply(string $phone, string $userText): string
    {
        $history = Cache::get("wa_history_$phone", []);
        $history[] = ['role' => 'user', 'content' => $userText];
        $messages = $history;

        $response = $this->callClaude($messages);
        $safety = 0;

        while (($response['stop_reason'] ?? null) === 'tool_use' && $safety < 5) {
            $safety++;
            $toolResults = [];
            foreach ($response['content'] as $block) {
                if ($block['type'] === 'tool_use') {
                    $toolResults[] = [
                        'type' => 'tool_result',
                        'tool_use_id' => $block['id'],
                        'content' => json_encode($this->runTool($block['name'], $block['input'] ?? [], $phone)),
                    ];
                }
            }
            $messages[] = ['role' => 'assistant', 'content' => $response['content']];
            $messages[] = ['role' => 'user', 'content' => $toolResults];
            $response = $this->callClaude($messages);
        }

        $text = collect($response['content'] ?? [])->firstWhere('type', 'text')['text']
            ?? 'Disculpa, no pude generar una respuesta.';

        $history[] = ['role' => 'assistant', 'content' => $text];
        Cache::put("wa_history_$phone", array_slice($history, -20), now()->addHours(6));

        return $text;
    }
}

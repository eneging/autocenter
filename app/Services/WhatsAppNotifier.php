<?php

namespace App\Services;

use App\Models\Project;
use App\Models\SiteSetting;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Log;

class WhatsAppNotifier
{
    public function __construct(private readonly WhatsAppApiService $whatsapp) {}

    public function trackingUrl(Project $project): string
    {
        $base = config('taller.whatsapp.tracking_base_url') ?: config('app.url');

        return rtrim($base, '/').'/seguimiento/'.$project->client_access_token;
    }

    public function normalizePhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);
        $country = config('taller.whatsapp.country_code');

        if ($digits === '' || $digits === null) {
            return null;
        }

        $digits = ltrim($digits, '0');

        if (strlen($digits) === 9) {
            return $country.$digits;
        }

        return strlen($digits) >= 10 ? $digits : null;
    }

    /** Aviso al cliente cuando cambia el estado de su orden (una sola vez por estado). */
    public function notifyStatus(Project $project): bool
    {
        $project->loadMissing(['client', 'vehicle']);

        if ($project->last_notified_status === $project->status) {
            return false;
        }

        $phone = $this->normalizePhone($project->client?->phone);
        if (! $phone) {
            return false;
        }

        $shop = SiteSetting::current()->company_name ?: config('app.name');
        $vehicle = $project->vehicle ? "{$project->vehicle->brand} {$project->vehicle->model} ({$project->vehicle->plate})" : 'tu vehículo';
        $link = $this->trackingUrl($project);
        $name = explode(' ', trim((string) $project->client->name))[0];

        $text = match ($project->status) {
            'Pendiente' => "Hola {$name}, recibimos {$vehicle} en {$shop}. Orden {$project->code}. Sigue el avance aquí: {$link}",
            'En Proceso' => "Hola {$name}, ya estamos trabajando en {$vehicle}. Mira fotos y avances en tiempo real: {$link}",
            'Finalizado' => "Hola {$name}, {$vehicle} está listo. Revisa el detalle final y déjanos tu comentario: {$link}",
            default => "Hola {$name}, tu orden {$project->code} ahora está en \"{$project->status}\". Detalle: {$link}",
        };

        return $this->deliver($phone, $text, function () use ($project) {
            $project->forceFill(['last_notified_status' => $project->status])->saveQuietly();
        });
    }

    /**
     * Recordatorios de mantenimiento programado. Devuelve cuántos mensajes se enviaron.
     */
    public function sendMaintenanceReminders(): int
    {
        $days = (int) config('taller.whatsapp.maintenance_days_before');
        $shop = SiteSetting::current()->company_name ?: config('app.name');
        $sent = 0;

        Vehicle::with('client')
            ->whereNotNull('next_maintenance_at')
            ->whereBetween('next_maintenance_at', [today()->toDateString(), today()->addDays($days)->toDateString()])
            ->where(function ($query) {
                $query->whereNull('maintenance_reminded_for')
                    ->orWhereColumn('maintenance_reminded_for', '!=', 'next_maintenance_at');
            })
            ->each(function (Vehicle $vehicle) use ($shop, &$sent) {
                $phone = $this->normalizePhone($vehicle->client?->phone);
                if (! $phone) {
                    return;
                }

                $name = explode(' ', trim((string) $vehicle->client->name))[0];
                $date = $vehicle->next_maintenance_at->format('d/m/Y');
                $text = "Hola {$name}, te recordamos que el mantenimiento de tu {$vehicle->brand} {$vehicle->model} ({$vehicle->plate}) está programado para el {$date}. Escríbenos para separar tu cupo. — {$shop}";

                $ok = $this->deliver($phone, $text, function () use ($vehicle) {
                    $vehicle->update(['maintenance_reminded_for' => $vehicle->next_maintenance_at]);
                });

                $sent += $ok ? 1 : 0;
            });

        return $sent;
    }

    private function deliver(string $phone, string $text, callable $onSuccess): bool
    {
        try {
            if ($this->whatsapp->send($phone, $text)) {
                $onSuccess();

                return true;
            }
        } catch (\Throwable $exception) {
            Log::warning('WhatsApp: error al enviar notificación', ['message' => $exception->getMessage()]);
        }

        return false;
    }
}

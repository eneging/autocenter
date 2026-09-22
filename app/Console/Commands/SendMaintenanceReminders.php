<?php

namespace App\Console\Commands;

use App\Services\WhatsAppApiService;
use App\Services\WhatsAppNotifier;
use Illuminate\Console\Command;

class SendMaintenanceReminders extends Command
{
    protected $signature = 'taller:send-reminders';

    protected $description = 'Envía por WhatsApp los recordatorios de mantenimiento programado de los vehículos';

    public function handle(WhatsAppNotifier $notifier, WhatsAppApiService $whatsapp): int
    {
        if (! $whatsapp->isConfigured()) {
            $this->warn('WhatsApp no está configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID). No se envió nada.');

            return self::SUCCESS;
        }

        $sent = $notifier->sendMaintenanceReminders();

        $this->info("Recordatorios enviados: {$sent}");

        return self::SUCCESS;
    }
}

<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Client;
use App\Models\Project;
use App\Models\TrackingLog;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ServiceOrderService
{
    public function __construct(private readonly WhatsAppNotifier $notifier) {}

    public static function normalizePlate(string $plate): string
    {
        return Str::upper(preg_replace('/[\s\-]+/', '', $plate));
    }

    /**
     * Recepción del vehículo: crea/actualiza cliente y vehículo y abre la orden de servicio.
     */
    public function receive(array $data, User $user): Project
    {
        $project = DB::transaction(function () use ($data, $user) {
            $client = Client::updateOrCreate(
                ['document_number' => $data['document_number']],
                array_filter([
                    'document_type' => $data['document_type'],
                    'document' => ($data['document_type'] === '6' ? 'RUC ' : 'DNI ').$data['document_number'],
                    'name' => $data['name'],
                    'phone' => $data['phone'],
                    'email' => $data['email'] ?? null,
                    'address' => $data['address'] ?? null,
                ], fn ($value) => $value !== null),
            );

            $plate = self::normalizePlate($data['plate']);
            $vehicle = Vehicle::firstOrNew(['plate' => $plate]);
            $vehicle->fill([
                'client_id' => $client->id,
                'brand' => $data['brand'],
                'model' => $data['model'],
                'year' => $data['year'] ?? $vehicle->year,
                'color' => $data['color'] ?? $vehicle->color,
                'vin' => $data['vin'] ?? $vehicle->vin,
                'engine_number' => $data['engine_number'] ?? $vehicle->engine_number,
            ])->save();

            $project = Project::create([
                'code' => Project::nextCode(),
                'client_id' => $client->id,
                'vehicle_id' => $vehicle->id,
                'responsible_worker_id' => $data['responsible_worker_id'] ?? null,
                'name' => "{$vehicle->brand} {$vehicle->model} - {$vehicle->plate}",
                'type' => 'Vehículo',
                'complexity' => 'Media',
                'priority' => $data['priority'] ?? 'Media',
                'status' => 'Pendiente',
                'progress' => 0,
                'problem_description' => $data['problem_description'],
                'mileage' => $data['mileage'] ?? null,
                'fuel_level' => $data['fuel_level'] ?? null,
                'reception_checklist' => $data['reception_checklist'] ?? null,
                'client_requests_prior_budget' => (bool) ($data['client_requests_prior_budget'] ?? false),
                'client_authorizes_repair_without_budget' => (bool) ($data['client_authorizes_repair_without_budget'] ?? false),
                'client_authorizes_test_drive' => (bool) ($data['client_authorizes_test_drive'] ?? false),
                'client_accepted_terms_at' => ! empty($data['client_accepts_terms']) ? now() : null,
                'service_type' => $data['service_type'] ?? null,
                'starts_at' => $data['entry_date'] ?? now()->toDateString(),
                'estimated_delivery_at' => $data['estimated_delivery_at'] ?? null,
                'estimated_time' => $data['estimated_time'] ?? null,
                'client_access_token' => Str::random(40),
            ]);

            TrackingLog::create([
                'project_id' => $project->id,
                'created_by' => $user->id,
                'annotation' => 'Vehículo recibido en el taller.',
            ]);

            ActivityLog::create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'title' => 'Vehículo recibido',
                'description' => "{$project->code} · {$vehicle->plate}",
            ]);

            return $project;
        });

        $this->notifier->notifyStatus($project);

        return $project->load(['client', 'vehicle', 'responsible']);
    }

    /** Cambia el estado. "Finalizado" fija la fecha real de salida; salir de él la limpia. */
    public function changeStatus(Project $project, string $status, User $user): Project
    {
        $closed = config('taller.closed_status');
        $previous = $project->status;

        $attributes = ['status' => $status];

        if ($status === $closed) {
            $attributes['progress'] = 100;
            $attributes['exit_date'] = $project->exit_date ?? now()->toDateString();
        } else {
            $attributes['exit_date'] = null;
            $attributes['progress'] = $status === 'En Proceso' ? max($project->progress, 30) : min($project->progress, 10);
        }

        $project->update($attributes);

        if ($previous !== $status) {
            TrackingLog::create([
                'project_id' => $project->id,
                'created_by' => $user->id,
                'annotation' => "Estado actualizado: {$status}.",
            ]);

            ActivityLog::create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'title' => 'Estado actualizado',
                'description' => "{$project->code} ahora esta en {$status}",
            ]);

            $this->notifier->notifyStatus($project);
        }

        return $project->fresh(['client', 'vehicle', 'responsible']);
    }

    /** Total de repuestos asignados + presupuesto del servicio. */
    public function totals(Project $project): array
    {
        $project->loadMissing('partsRequests.inventoryItem');

        $parts = $project->partsRequests->map(fn ($request) => [
            'name' => $request->inventoryItem?->name ?? 'Repuesto',
            'quantity' => $request->quantity,
            'unit_price' => (float) $request->unit_price,
            'subtotal' => round($request->quantity * (float) $request->unit_price, 2),
        ]);

        $partsTotal = round((float) $parts->sum('subtotal'), 2);
        $service = round((float) ($project->budget ?? 0), 2);

        return [
            'service_budget' => $service,
            'parts' => $parts->values()->all(),
            'parts_total' => $partsTotal,
            'total' => round($service + $partsTotal, 2),
        ];
    }
}

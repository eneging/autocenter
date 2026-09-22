<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\SiteSetting;
use App\Services\ServiceOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Seguimiento público por enlace único. Solo expone lo que el cliente debe ver:
 * nunca datos internos (notas, costos internos, otros clientes) ni el modelo completo.
 */
class PublicTrackingController extends Controller
{
    public function __construct(private readonly ServiceOrderService $orders) {}

    public function show(string $token): JsonResponse
    {
        return response()->json($this->payload($this->find($token)));
    }

    public function comment(Request $request, string $token): JsonResponse
    {
        $project = $this->find($token);

        if ($project->status !== config('taller.closed_status')) {
            abort(422, 'Podrás dejar tu comentario cuando el servicio esté finalizado.');
        }

        if ($project->client_commented_at) {
            abort(422, 'Ya registramos tu comentario. ¡Gracias!');
        }

        $data = $request->validate([
            'comment' => ['required', 'string', 'min:3', 'max:1500'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $project->update([
            'client_comment' => $data['comment'],
            'client_rating' => $data['rating'] ?? null,
            'client_commented_at' => now(),
        ]);

        ActivityLog::create([
            'project_id' => $project->id,
            'title' => 'Cliente comentó en el seguimiento',
            'description' => $project->code,
        ]);

        return response()->json($this->payload($project->fresh()), 201);
    }

    private function find(string $token): Project
    {
        return Project::with(['client:id,name', 'vehicle', 'responsible:id,name', 'trackingLogs', 'partsRequests.inventoryItem'])
            ->where('client_access_token', $token)
            ->firstOrFail();
    }

    private function payload(Project $project): array
    {
        $shop = SiteSetting::current();
        $closed = $project->status === config('taller.closed_status');

        return [
            'shop' => [
                'name' => $shop->company_name,
                'ruc' => $shop->company_ruc,
                'phone' => $shop->contact_phone,
                'whatsapp' => $shop->contact_whatsapp,
                'address' => $shop->contact_address,
                'email' => $shop->contact_email,
            ],
            'order' => [
                'code' => $project->code,
                'status' => $project->status,
                'progress' => $project->progress,
                'service_type' => $project->service_type,
                'problem_description' => $project->problem_description,
                'technical_diagnostic' => $project->technical_diagnostic,
                'solution' => $project->solution,
                'estimated_time' => $project->estimated_time,
                'entry_date' => $project->starts_at?->toDateString(),
                'estimated_delivery_at' => $project->estimated_delivery_at?->toDateString(),
                'exit_date' => $project->exit_date?->toDateString(),
                'technician' => $project->responsible?->name,
            ],
            'client_name' => $project->client?->name,
            'vehicle' => $project->vehicle?->only(['plate', 'brand', 'model', 'year', 'color']),
            'timeline' => $project->trackingLogs->sortByDesc('id')->values()->map(fn ($log) => [
                'id' => $log->id,
                'annotation' => $log->annotation,
                'image' => $log->watermarked_image_path,
                'created_at' => $log->created_at->toIso8601String(),
            ])->all(),
            'receipt' => $closed ? $this->orders->totals($project) : null,
            'feedback' => [
                'can_comment' => $closed && ! $project->client_commented_at,
                'submitted' => (bool) $project->client_commented_at,
                'comment' => $project->client_commented_at ? $project->client_comment : null,
                'rating' => $project->client_commented_at ? $project->client_rating : null,
            ],
        ];
    }
}

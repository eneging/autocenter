<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Client;
use App\Models\Project;
use App\Models\ProjectRequest;
use App\Models\TrackingLog;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\CloudinaryUploader;
use App\Services\QuotationService;
use App\Services\ServiceOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class QuoteRequestController extends Controller
{
    public function __construct(
        private readonly CloudinaryUploader $uploader,
        private readonly QuotationService $quotationService,
    ) {}

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'phone' => ['nullable', 'string', 'max:60'],
            'document_type' => ['nullable', Rule::in(['1', '6'])],
            'document_number' => ['nullable', 'string', 'max:20'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
            'vehicle_brand' => ['nullable', 'string', 'max:80'],
            'vehicle_model' => ['nullable', 'string', 'max:80'],
            'reference_image' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif', 'max:10240'],
        ]);

        $imageUrl = $request->hasFile('reference_image')
            ? $this->uploader->upload($request->file('reference_image'), 'taller/requests')
            : null;

        $user = DB::transaction(function () use ($data, $imageUrl) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);
            $user->assignRole('Cliente');

            $client = Client::create([
                'user_id' => $user->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'document_type' => $data['document_type'] ?? null,
                'document_number' => $data['document_number'] ?? null,
            ]);

            ProjectRequest::create([
                'client_id' => $client->id,
                'title' => $data['title'],
                'description' => $data['description'],
                'vehicle_plate' => filled($data['vehicle_plate'] ?? null) ? ServiceOrderService::normalizePlate($data['vehicle_plate']) : null,
                'vehicle_brand' => $data['vehicle_brand'] ?? null,
                'vehicle_model' => $data['vehicle_model'] ?? null,
                'reference_image_url' => $imageUrl,
                'status' => 'Pendiente',
            ]);

            return $user;
        });

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->getRoleNames(),
            'worker' => null,
            'client' => $user->client,
        ], 201);
    }

    public function myRequests(Request $request): JsonResponse
    {
        $client = $request->user()->client;

        if (! $client) {
            return response()->json([]);
        }

        return response()->json(
            ProjectRequest::with(['quotation.items', 'project'])->where('client_id', $client->id)->latest()->get()
        );
    }

    public function index(): JsonResponse
    {
        return response()->json(
            ProjectRequest::with(['client', 'quotation', 'project'])->latest()->get()
        );
    }

    public function updateStatus(ProjectRequest $projectRequest, Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Pendiente', 'Contactado', 'Rechazado'])],
            'rejected_reason' => ['nullable', 'string'],
        ]);

        $projectRequest->update([
            'status' => $data['status'],
            'rejected_reason' => $data['status'] === 'Rechazado' ? ($data['rejected_reason'] ?? null) : null,
            'contacted_at' => $data['status'] === 'Contactado' ? now() : $projectRequest->contacted_at,
        ]);

        return response()->json($projectRequest->fresh(['client', 'quotation', 'project']));
    }

    public function createQuotation(ProjectRequest $projectRequest, Request $request): JsonResponse
    {
        $data = $request->validate([
            'delivery_time' => ['required', 'string', 'max:255'],
            'advance_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
            'extra_terms' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.title' => ['required', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.amount' => ['required', 'numeric', 'min:0'],
        ]);

        $quotation = DB::transaction(function () use ($data, $projectRequest) {
            $quotation = $this->quotationService->create([
                ...$data,
                'client_id' => $projectRequest->client_id,
                'project_id' => null,
            ]);

            $projectRequest->update([
                'quotation_id' => $quotation->id,
                'status' => 'Cotizado',
            ]);

            return $quotation;
        });

        ActivityLog::create([
            'title' => 'Cotizacion generada desde solicitud',
            'description' => $quotation->number,
        ]);

        return response()->json($projectRequest->fresh(['client', 'quotation.items', 'project']), 201);
    }

    public function approve(ProjectRequest $projectRequest, Request $request): JsonResponse
    {
        if (! $projectRequest->quotation_id) {
            abort(422, 'Primero genera una cotizacion para esta solicitud.');
        }

        $data = $request->validate([
            'priority' => ['nullable', Rule::in(['Baja', 'Media', 'Alta', 'Urgente'])],
            'service_type' => ['nullable', Rule::in(config('taller.service_types'))],
            'estimated_delivery_at' => ['nullable', 'date', 'after_or_equal:today'],
            'responsible_worker_id' => ['nullable', 'exists:workers,id'],
        ]);

        $project = DB::transaction(function () use ($data, $projectRequest) {
            $vehicle = null;

            if (filled($projectRequest->vehicle_plate)) {
                $vehicle = Vehicle::firstOrNew(['plate' => $projectRequest->vehicle_plate]);
                $vehicle->fill([
                    'client_id' => $projectRequest->client_id,
                    'brand' => $projectRequest->vehicle_brand ?: ($vehicle->brand ?: 'Sin especificar'),
                    'model' => $projectRequest->vehicle_model ?: ($vehicle->model ?: 'Sin especificar'),
                ])->save();
            }

            $project = Project::create([
                'code' => Project::nextCode(),
                'client_id' => $projectRequest->client_id,
                'vehicle_id' => $vehicle?->id,
                'responsible_worker_id' => $data['responsible_worker_id'] ?? null,
                'name' => $vehicle ? "{$vehicle->brand} {$vehicle->model} - {$vehicle->plate}" : $projectRequest->title,
                'type' => 'Vehículo',
                'complexity' => 'Media',
                'priority' => $data['priority'] ?? 'Media',
                'description' => $projectRequest->title,
                'problem_description' => $projectRequest->description,
                'service_type' => $data['service_type'] ?? null,
                'status' => 'Pendiente',
                'progress' => 0,
                'starts_at' => now()->toDateString(),
                'estimated_delivery_at' => $data['estimated_delivery_at'] ?? null,
                'client_access_token' => Str::random(40),
                'cover_image_url' => $projectRequest->reference_image_url,
            ]);

            TrackingLog::create([
                'project_id' => $project->id,
                'created_by' => auth()->id(),
                'annotation' => 'Solicitud aprobada. Orden de servicio creada.',
            ]);

            $projectRequest->quotation()->update(['project_id' => $project->id]);
            $projectRequest->update(['project_id' => $project->id, 'status' => 'Aprobado']);

            return $project;
        });
        ActivityLog::create([
            'project_id' => $project->id,
            'title' => 'Orden de servicio creada desde solicitud aprobada',
            'description' => $project->name,
        ]);

        return response()->json($projectRequest->fresh(['client', 'quotation', 'project']));
    }
}

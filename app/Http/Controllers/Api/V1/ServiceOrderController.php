<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\ChecksOrderAccess;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\InventoryItem;
use App\Models\PartsRequest;
use App\Models\Project;
use App\Models\SiteSetting;
use App\Models\TrackingLog;
use App\Services\InventoryService;
use App\Services\QrCodeService;
use App\Services\ServiceOrderService;
use App\Services\WatermarkService;
use App\Services\WhatsAppNotifier;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServiceOrderController extends Controller
{
    use ChecksOrderAccess;

    public function __construct(
        private readonly ServiceOrderService $orders,
        private readonly InventoryService $inventory,
        private readonly WatermarkService $watermark,
        private readonly WhatsAppNotifier $notifier,
    ) {}

    /** Lista de recepción del vehículo (checklist, niveles, zonas de daño, términos): una sola fuente para el formulario y el PDF. */
    public function receptionOptions(): JsonResponse
    {
        return response()->json(config('taller.reception'));
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Project::with(['client', 'vehicle', 'responsible'])
            ->whereNotNull('vehicle_id')
            ->latest();

        if (! $this->isAdmin($user)) {
            $query->where('responsible_worker_id', $user->worker?->id ?? 0);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('worker_id') && $this->isAdmin($user)) {
            $query->where('responsible_worker_id', $request->integer('worker_id'));
        }

        if ($request->filled('search')) {
            $term = '%'.trim($request->string('search')).'%';
            $query->where(fn ($q) => $q
                ->where('code', 'like', $term)
                ->orWhereHas('vehicle', fn ($v) => $v->where('plate', 'like', $term)->orWhere('brand', 'like', $term)->orWhere('model', 'like', $term))
                ->orWhereHas('client', fn ($c) => $c->where('name', 'like', $term)->orWhere('phone', 'like', $term)));
        }

        return response()->json($query->limit(500)->get());
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $this->authorizeOrder($request->user(), $project);

        return response()->json($this->detail($project));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:40'],
            'document_type' => ['required', Rule::in(['1', '6'])],
            'document_number' => ['required', 'string', 'max:20', 'regex:/^\d+$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'plate' => ['required', 'string', 'max:20'],
            'brand' => ['required', 'string', 'max:80'],
            'model' => ['required', 'string', 'max:80'],
            'year' => ['nullable', 'string', 'max:4'],
            'color' => ['nullable', 'string', 'max:60'],
            'vin' => ['nullable', 'string', 'max:40'],
            'engine_number' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:300'],
            'problem_description' => ['required', 'string', 'max:3000'],
            'mileage' => ['nullable', 'integer', 'min:0', 'max:9999999'],
            'fuel_level' => ['nullable', Rule::in(config('taller.reception.fuel_levels'))],
            'reception_checklist' => ['nullable', 'array'],
            'client_requests_prior_budget' => ['nullable', 'boolean'],
            'client_authorizes_repair_without_budget' => ['nullable', 'boolean'],
            'client_authorizes_test_drive' => ['nullable', 'boolean'],
            'client_accepts_terms' => ['accepted'],
            'service_type' => ['nullable', Rule::in(config('taller.service_types'))],
            'responsible_worker_id' => ['nullable', 'exists:workers,id'],
            'entry_date' => ['nullable', 'date'],
            'estimated_delivery_at' => ['nullable', 'date'],
            'estimated_time' => ['nullable', 'string', 'max:80'],
            'priority' => ['nullable', Rule::in(['Baja', 'Media', 'Alta', 'Urgente'])],
        ]);

        if ($data['document_type'] === '1' && strlen($data['document_number']) !== 8) {
            abort(422, 'El DNI debe tener 8 dígitos.');
        }
        if ($data['document_type'] === '6' && strlen($data['document_number']) !== 11) {
            abort(422, 'El RUC debe tener 11 dígitos.');
        }

        $project = $this->orders->receive($data, $request->user());

        return response()->json($this->detail($project), 201);
    }

    /** Ficha técnica: diagnóstico, solución, presupuesto, tiempos y clasificación. */
    public function update(Request $request, Project $project): JsonResponse
    {
        $user = $request->user();
        $this->authorizeOrder($user, $project);

        $rules = [
            'technical_diagnostic' => ['nullable', 'string', 'max:5000'],
            'solution' => ['nullable', 'string', 'max:5000'],
            'service_type' => ['nullable', Rule::in(config('taller.service_types'))],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'estimated_time' => ['nullable', 'string', 'max:80'],
            'estimated_delivery_at' => ['nullable', 'date'],
            'starts_at' => ['nullable', 'date'],
            'exit_date' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'mileage' => ['nullable', 'integer', 'min:0', 'max:9999999'],
            'fuel_level' => ['nullable', Rule::in(config('taller.reception.fuel_levels'))],
            'reception_checklist' => ['nullable', 'array'],
            'client_requests_prior_budget' => ['nullable', 'boolean'],
            'client_authorizes_repair_without_budget' => ['nullable', 'boolean'],
            'client_authorizes_test_drive' => ['nullable', 'boolean'],
        ];

        if ($this->isAdmin($user)) {
            $rules['problem_description'] = ['nullable', 'string', 'max:3000'];
            $rules['responsible_worker_id'] = ['nullable', 'exists:workers,id'];
            $rules['priority'] = ['nullable', Rule::in(['Baja', 'Media', 'Alta', 'Urgente'])];
        }

        $data = $request->validate($rules);
        $project->update($data);

        ActivityLog::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'title' => 'Ficha técnica actualizada',
            'description' => $project->code,
        ]);

        return response()->json($this->detail($project));
    }

    public function updateStatus(Request $request, Project $project): JsonResponse
    {
        $this->authorizeOrder($request->user(), $project);

        $data = $request->validate([
            'status' => ['required', Rule::in(config('taller.order_statuses'))],
        ]);

        $project = $this->orders->changeStatus($project, $data['status'], $request->user());

        return response()->json($this->detail($project));
    }

    public function destroy(Project $project): JsonResponse
    {
        ActivityLog::create([
            'project_id' => $project->id,
            'title' => 'Orden eliminada',
            'description' => $project->code,
        ]);

        $project->delete();

        return response()->json(status: 204);
    }

    /** Anotación (y foto opcional con marca de agua) que el cliente verá en su seguimiento. */
    public function storeLog(Request $request, Project $project): JsonResponse
    {
        $this->authorizeOrder($request->user(), $project);

        $data = $request->validate([
            'annotation' => ['nullable', 'string', 'max:2000', 'required_without:image'],
            'image' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif', 'max:10240', 'required_without:annotation'],
        ]);

        $path = $request->hasFile('image') ? $this->watermark->upload($request->file('image')) : null;

        $log = TrackingLog::create([
            'project_id' => $project->id,
            'created_by' => $request->user()->id,
            'annotation' => $data['annotation'] ?? null,
            'watermarked_image_path' => $path,
        ]);

        return response()->json($log->load('creator:id,name'), 201);
    }

    public function destroyLog(Request $request, Project $project, TrackingLog $log): JsonResponse
    {
        $this->authorizeOrder($request->user(), $project);

        abort_unless($log->project_id === $project->id, 404);

        $log->delete();

        return response()->json(status: 204);
    }

    public function storePart(Request $request, Project $project): JsonResponse
    {
        $this->authorizeOrder($request->user(), $project);

        $data = $request->validate([
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:9999'],
        ]);

        $item = InventoryItem::findOrFail($data['inventory_item_id']);
        $this->inventory->assignToProject($project, $item, $data['quantity'], $request->user());

        return response()->json($this->detail($project), 201);
    }

    public function destroyPart(Request $request, Project $project, PartsRequest $part): JsonResponse
    {
        $this->authorizeOrder($request->user(), $project);

        abort_unless($part->project_id === $project->id, 404);

        $this->inventory->releaseFromProject($part, $request->user());

        return response()->json($this->detail($project));
    }

    public function trackingLink(Request $request, Project $project): JsonResponse
    {
        $this->authorizeOrder($request->user(), $project);

        $project->loadMissing('client');
        $phone = $this->notifier->normalizePhone($project->client?->phone);
        $url = $this->notifier->trackingUrl($project);

        return response()->json([
            'url' => $url,
            'whatsapp_url' => $phone ? 'https://wa.me/'.$phone.'?text='.rawurlencode("Sigue el avance de tu vehículo aquí: {$url}") : null,
        ]);
    }

    /** Orden de servicio en PDF (recepción del vehículo, ficha técnica y condiciones), lista para imprimir o guardar. */
    public function receptionPdf(Request $request, Project $project)
    {
        $this->authorizeOrder($request->user(), $project);

        $project->load(['client', 'vehicle', 'responsible']);

        // DomPDF no siempre respeta el tamaño por CSS de un <svg> sin width/height propios:
        // se fija explícitamente para que no "infle" la fila y empuje la firma a otra página.
        $qr = str_replace('<svg ', '<svg width="90" height="90" ', app(QrCodeService::class)->svg($this->notifier->trackingUrl($project)));

        return Pdf::loadView('pdf.reception-order', [
            'project' => $project,
            'company' => SiteSetting::current(),
            'qr' => $qr,
        ])->download($project->code.'-orden-de-servicio.pdf');
    }

    private function detail(Project $project): array
    {
        $project->load([
            'client',
            'vehicle',
            'responsible',
            'trackingLogs' => fn ($q) => $q->latest('id')->with('creator:id,name'),
            'partsRequests.inventoryItem',
        ]);

        return [...$project->toArray(), 'totals' => $this->orders->totals($project)];
    }
}

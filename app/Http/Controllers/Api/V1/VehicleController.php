<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Services\PlateLookupService;
use App\Services\ServiceOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VehicleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Vehicle::with('client')->withCount('projects')->latest();

        if ($request->filled('search')) {
            $term = '%'.trim($request->string('search')).'%';
            $query->where(fn ($q) => $q
                ->where('plate', 'like', $term)
                ->orWhere('brand', 'like', $term)
                ->orWhere('model', 'like', $term)
                ->orWhereHas('client', fn ($c) => $c->where('name', 'like', $term)->orWhere('document_number', 'like', $term)));
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }

        return response()->json($query->limit(500)->get());
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        return response()->json($vehicle->load([
            'client',
            'projects' => fn ($q) => $q->latest()->select('id', 'code', 'vehicle_id', 'status', 'service_type', 'starts_at', 'exit_date', 'budget'),
        ]));
    }

    /**
     * Datos de un vehículo por placa, para autocompletar el registro: primero en nuestra base
     * (con su dueño) y, si no existe, en el registro vehicular vía json.pe.
     */
    public function lookup(Request $request, PlateLookupService $plates): JsonResponse
    {
        $plate = ServiceOrderService::normalizePlate((string) $request->query('plate', ''));

        if (strlen($plate) < 5) {
            return response()->json(['plate' => $plate, 'source' => null, 'vehicle' => null, 'error' => null]);
        }

        $local = Vehicle::with('client:id,name,phone,email,document_type,document_number')->where('plate', $plate)->first();

        if ($local) {
            return response()->json(['plate' => $plate, 'source' => 'local', 'vehicle' => $local, 'error' => null]);
        }

        $result = $plates->find($plate);

        return response()->json([
            'plate' => $plate,
            'source' => $result['data'] ? 'json.pe' : null,
            'vehicle' => $result['data'],
            'error' => $result['error'],
        ]);
    }

    public function plateUsage(PlateLookupService $plates): JsonResponse
    {
        return response()->json($plates->usage());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['plate'] = ServiceOrderService::normalizePlate($data['plate']);

        $request->merge(['plate' => $data['plate']]);
        $request->validate(['plate' => [Rule::unique('vehicles', 'plate')]]);

        return response()->json(Vehicle::create($data)->load('client'), 201);
    }

    public function update(Vehicle $vehicle, Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['plate'] = ServiceOrderService::normalizePlate($data['plate']);

        $request->merge(['plate' => $data['plate']]);
        $request->validate(['plate' => [Rule::unique('vehicles', 'plate')->ignore($vehicle->id)]]);

        $vehicle->update($data);

        return response()->json($vehicle->load('client'));
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        if ($vehicle->projects()->exists()) {
            abort(422, 'Este vehículo tiene órdenes de servicio registradas y no se puede eliminar.');
        }

        $vehicle->delete();

        return response()->json(status: 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'plate' => ['required', 'string', 'max:20'],
            'brand' => ['required', 'string', 'max:80'],
            'model' => ['required', 'string', 'max:80'],
            'year' => ['nullable', 'string', 'max:4'],
            'color' => ['nullable', 'string', 'max:60'],
            'vin' => ['nullable', 'string', 'max:40'],
            'engine_number' => ['nullable', 'string', 'max:40'],
            'next_maintenance_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }
}

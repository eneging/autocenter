<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Services\InventoryService;
use App\Services\QrCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly QrCodeService $qr,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = InventoryItem::query()->orderBy('name');

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        if ($request->filled('search')) {
            $term = '%'.trim($request->string('search')).'%';
            $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('code', 'like', $term));
        }

        if ($request->boolean('low_stock')) {
            $query->where('type', 'Repuesto')->whereColumn('stock', '<=', 'min_stock');
        }

        return response()->json($query->limit(1000)->get());
    }

    public function show(InventoryItem $item): JsonResponse
    {
        return response()->json($item->load(['movements' => fn ($q) => $q->latest()->limit(30)->with('user:id,name')]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $stock = (int) ($data['stock'] ?? 0);
        $data['stock'] = 0;

        $item = InventoryItem::create($data);
        $item->update(['qr_data' => $item->qr_data ?: ($item->code ?: 'INV-'.$item->id)]);

        if ($stock > 0) {
            $this->inventory->move($item, 'Entrada', $stock, $request->user(), null, 'Stock inicial');
        }

        return response()->json($item->fresh(), 201);
    }

    /** Los costos son completamente editables; el stock solo cambia mediante movimientos. */
    public function update(Request $request, InventoryItem $item): JsonResponse
    {
        $data = $this->validated($request, $item);
        unset($data['stock']);

        $item->update($data);

        return response()->json($item->fresh());
    }

    public function destroy(InventoryItem $item): JsonResponse
    {
        if ($item->partsRequests()->exists()) {
            abort(422, 'Este ítem ya fue asignado a órdenes de servicio y no se puede eliminar.');
        }

        $item->delete();

        return response()->json(status: 204);
    }

    public function movement(Request $request, InventoryItem $item): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['Entrada', 'Salida'])],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        if ($data['type'] === 'Entrada' && isset($data['unit_cost'])) {
            $item->update(['unit_cost' => $data['unit_cost']]);
        }

        $this->inventory->move($item, $data['type'], $data['quantity'], $request->user(), null, $data['note'] ?? null, $data['unit_cost'] ?? null);

        return response()->json($item->fresh());
    }

    /**
     * Escaneo de QR o ingreso manual de código/nombre.
     * Sin `commit`, solo identifica el ítem; con `commit`, registra la entrada/salida.
     * Si el QR trae todos los datos y el ítem no existe, una entrada lo crea.
     */
    public function scan(Request $request): JsonResponse
    {
        $data = $request->validate([
            'payload' => ['required', 'string', 'max:2000'],
            'action' => ['nullable', Rule::in(['Entrada', 'Salida'])],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'commit' => ['nullable', 'boolean'],
        ]);

        $resolved = $this->inventory->resolve($data['payload']);
        $item = $resolved['item'];
        $qrData = $resolved['data'];
        $commit = (bool) ($data['commit'] ?? false);

        if (! $item) {
            if ($commit && ($data['action'] ?? null) === 'Entrada' && ! empty($qrData['name'])) {
                $item = InventoryItem::create([
                    'type' => in_array($qrData['type'] ?? null, ['Repuesto', 'Herramienta'], true) ? $qrData['type'] : 'Repuesto',
                    'code' => $qrData['code'] ?? null,
                    'name' => $qrData['name'],
                    'unit_cost' => $qrData['unit_cost'] ?? 0,
                    'sale_price' => $qrData['sale_price'] ?? null,
                    'includes_igv' => (bool) ($qrData['includes_igv'] ?? false),
                    'qr_data' => $qrData['code'] ?? $data['payload'],
                    'stock' => 0,
                ]);
            } else {
                return response()->json(['found' => false, 'qr_data' => $qrData ?: null], 404);
            }
        }

        if ($commit) {
            abort_unless(isset($data['action']), 422, 'Indica si es una entrada o una salida.');

            $this->inventory->move($item, $data['action'], $data['quantity'] ?? 1, $request->user(), null, 'Escaneo QR/código');
        }

        return response()->json(['found' => true, 'item' => $item->fresh()]);
    }

    public function qr(InventoryItem $item): JsonResponse
    {
        return response()->json([
            'item' => $item->only(['id', 'code', 'name']),
            'payload' => $this->inventory->qrPayload($item),
            'svg' => $this->qr->svg($this->inventory->qrPayload($item)),
        ]);
    }

    private function validated(Request $request, ?InventoryItem $item = null): array
    {
        return $request->validate([
            'type' => ['required', Rule::in(['Repuesto', 'Herramienta'])],
            'code' => ['nullable', 'string', 'max:60', Rule::unique('inventory_items', 'code')->ignore($item?->id)],
            'name' => ['required', 'string', 'max:255'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'includes_igv' => ['nullable', 'boolean'],
            'qr_data' => ['nullable', 'string', 'max:255', Rule::unique('inventory_items', 'qr_data')->ignore($item?->id)],
        ]);
    }
}

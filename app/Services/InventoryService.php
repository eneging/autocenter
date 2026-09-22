<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\PartsRequest;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    /**
     * Registra una entrada o salida de stock de forma atómica (con bloqueo de fila).
     */
    public function move(
        InventoryItem $item,
        string $type,
        int $quantity,
        ?User $user = null,
        ?Project $project = null,
        ?string $note = null,
        ?float $unitCost = null,
    ): InventoryMovement {
        return DB::transaction(function () use ($item, $type, $quantity, $user, $project, $note, $unitCost) {
            $locked = InventoryItem::whereKey($item->getKey())->lockForUpdate()->firstOrFail();

            $delta = $type === 'Entrada' ? $quantity : -$quantity;
            $newStock = $locked->stock + $delta;

            if ($newStock < 0) {
                throw ValidationException::withMessages([
                    'quantity' => "Stock insuficiente de {$locked->name}: hay {$locked->stock} y se piden {$quantity}.",
                ]);
            }

            $locked->update(['stock' => $newStock]);
            $item->refresh();

            return InventoryMovement::create([
                'inventory_item_id' => $locked->id,
                'project_id' => $project?->id,
                'user_id' => $user?->id,
                'type' => $type,
                'quantity' => $quantity,
                'stock_after' => $newStock,
                'unit_cost' => $unitCost ?? $locked->unit_cost,
                'note' => $note,
            ]);
        });
    }

    /** Asigna un repuesto a una orden: congela el precio vigente y descuenta stock. */
    public function assignToProject(Project $project, InventoryItem $item, int $quantity, ?User $user = null): PartsRequest
    {
        if ($item->type !== 'Repuesto') {
            throw ValidationException::withMessages(['inventory_item_id' => 'Solo se pueden asignar repuestos a una orden.']);
        }

        return DB::transaction(function () use ($project, $item, $quantity, $user) {
            $this->move($item, 'Salida', $quantity, $user, $project, "Orden {$project->code}");

            return PartsRequest::create([
                'project_id' => $project->id,
                'inventory_item_id' => $item->id,
                'quantity' => $quantity,
                'unit_price' => $item->chargePrice(),
            ]);
        });
    }

    /** Quita un repuesto de la orden y devuelve el stock. */
    public function releaseFromProject(PartsRequest $request, ?User $user = null): void
    {
        DB::transaction(function () use ($request, $user) {
            if ($request->inventory_item_id) {
                $item = InventoryItem::find($request->inventory_item_id);
                if ($item) {
                    $this->move($item, 'Entrada', $request->quantity, $user, $request->project, 'Repuesto devuelto de la orden');
                }
            }

            $request->delete();
        });
    }

    /**
     * Interpreta el contenido de un QR (JSON con todos los datos, o solo el código)
     * o un código/nombre tipeado a mano, y devuelve el ítem si existe.
     *
     * @return array{item: ?InventoryItem, data: array}
     */
    public function resolve(string $payload): array
    {
        $payload = trim($payload);
        $data = [];

        $decoded = json_decode($payload, true);
        if (is_array($decoded)) {
            $data = $decoded;
            $lookup = $decoded['code'] ?? $decoded['qr_data'] ?? null;
        } else {
            $lookup = $payload;
        }

        $item = null;
        if ($lookup) {
            $item = InventoryItem::where('code', $lookup)
                ->orWhere('qr_data', $lookup)
                ->orWhere('qr_data', $payload)
                ->first();
        }

        if (! $item && ! is_array($decoded)) {
            $matches = InventoryItem::where('name', 'like', '%'.$payload.'%')->limit(2)->get();
            $item = $matches->count() === 1 ? $matches->first() : null;
        }

        return ['item' => $item, 'data' => $data];
    }

    /** Contenido que se codifica en el QR de un ítem: todos sus datos. */
    public function qrPayload(InventoryItem $item): string
    {
        return json_encode([
            'code' => $item->code,
            'name' => $item->name,
            'type' => $item->type,
            'unit_cost' => (float) $item->unit_cost,
            'sale_price' => $item->sale_price !== null ? (float) $item->sale_price : null,
            'includes_igv' => $item->includes_igv,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}

<?php

namespace App\Services;

use App\Models\Quotation;
use App\Models\QuotationItem;
use Illuminate\Support\Facades\DB;

class QuotationService
{
    /**
     * @param  array{client_id:int,project_id:?int,delivery_time:string,advance_percentage?:int,extra_terms?:?string,includes_igv?:bool,items:array<int, array{title:string,description:?string,amount:float}>}  $data
     */
    public function create(array $data): Quotation
    {
        return DB::transaction(function () use ($data) {
            $subtotal = collect($data['items'])->sum(fn (array $item) => (float) $item['amount']);
            $includesIgv = $data['includes_igv'] ?? true;
            $igv = $includesIgv ? $subtotal * 0.18 : 0;

            $quotation = Quotation::create([
                'number' => 'SEG-COT-2026-'.str_pad((string) (Quotation::count() + 1), 4, '0', STR_PAD_LEFT),
                'client_id' => $data['client_id'],
                'project_id' => $data['project_id'] ?? null,
                'status' => 'Pendiente',
                'issue_date' => now(),
                'delivery_time' => $data['delivery_time'],
                'subtotal' => $subtotal,
                'igv' => $igv,
                'includes_igv' => $includesIgv,
                'total' => $subtotal + $igv,
                'advance_percentage' => $data['advance_percentage'] ?? 50,
                'extra_terms' => $data['extra_terms'] ?? null,
                'conditions' => 'Adelanto según lo acordado, saldo contra entrega del vehículo. Validez: 10 días.',
            ]);

            foreach ($data['items'] as $item) {
                QuotationItem::create([
                    'quotation_id' => $quotation->id,
                    'title' => $item['title'],
                    'description' => $item['description'] ?? null,
                    'quantity' => 1,
                    'unit_price' => $item['amount'],
                    'subtotal' => $item['amount'],
                ]);
            }

            return $quotation;
        });
    }

    /**
     * @param  array{client_id:int,project_id:?int,delivery_time:string,advance_percentage?:int,extra_terms?:?string,includes_igv?:bool,items:array<int, array{title:string,description:?string,amount:float}>}  $data
     */
    public function update(Quotation $quotation, array $data): Quotation
    {
        if ($quotation->sunatDocuments()->where('estado', 'aceptado')->exists()) {
            abort(422, 'Esta cotizacion ya tiene un comprobante SUNAT aceptado y no se puede editar.');
        }

        return DB::transaction(function () use ($quotation, $data) {
            $subtotal = collect($data['items'])->sum(fn (array $item) => (float) $item['amount']);
            $includesIgv = $data['includes_igv'] ?? true;
            $igv = $includesIgv ? $subtotal * 0.18 : 0;

            $quotation->update([
                'client_id' => $data['client_id'],
                'project_id' => $data['project_id'] ?? null,
                'delivery_time' => $data['delivery_time'],
                'subtotal' => $subtotal,
                'igv' => $igv,
                'includes_igv' => $includesIgv,
                'total' => $subtotal + $igv,
                'advance_percentage' => $data['advance_percentage'] ?? 50,
                'extra_terms' => $data['extra_terms'] ?? null,
            ]);

            $quotation->items()->delete();

            foreach ($data['items'] as $item) {
                QuotationItem::create([
                    'quotation_id' => $quotation->id,
                    'title' => $item['title'],
                    'description' => $item['description'] ?? null,
                    'quantity' => 1,
                    'unit_price' => $item['amount'],
                    'subtotal' => $item['amount'],
                ]);
            }

            return $quotation->fresh(['client', 'project', 'items']);
        });
    }

    public function delete(Quotation $quotation): void
    {
        if ($quotation->sunatDocuments()->where('estado', 'aceptado')->exists()) {
            abort(422, 'Esta cotizacion ya tiene un comprobante SUNAT aceptado y no se puede eliminar.');
        }

        $quotation->delete();
    }
}

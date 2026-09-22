<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Worker;
use App\Services\CashRegisterService;
use App\Services\CommissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CommissionController extends Controller
{
    public function __construct(
        private readonly CommissionService $commissions,
        private readonly CashRegisterService $cashRegisters,
    ) {}

    public function index(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        return response()->json([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'tiers' => config('taller.commission_tiers'),
            'rows' => $this->commissions->forRange($from, $to),
        ]);
    }

    /** Registra el pago de la comisión de un técnico como gasto fijo (categoría Comisiones) en la caja abierta. */
    public function pay(Request $request): JsonResponse
    {
        $data = $request->validate([
            'worker_id' => ['required', 'exists:workers,id'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'payment_method' => ['required', 'in:'.implode(',', config('taller.payment_methods'))],
        ]);

        $from = Carbon::parse($data['from']);
        $to = Carbon::parse($data['to']);
        $row = collect($this->commissions->forRange($from, $to))->firstWhere('worker_id', (int) $data['worker_id']);

        if (! $row || $row['commission'] <= 0) {
            abort(422, 'El técnico no alcanzó ninguna comisión en ese período.');
        }

        $register = $this->cashRegisters->current();
        if (! $register) {
            abort(422, 'Abre la caja para registrar el pago de la comisión.');
        }

        $worker = Worker::findOrFail($data['worker_id']);

        $transaction = $this->cashRegisters->addTransaction($register, [
            'type' => 'Gasto Fijo',
            'category' => 'Comisiones',
            'payment_method' => $data['payment_method'],
            'amount' => $row['commission'],
            'worker_id' => $worker->id,
            'description' => "Comisión {$worker->name} ({$from->format('d/m')} - {$to->format('d/m')}) sobre S/ {$row['generated']}",
        ], $request->user());

        return response()->json($transaction, 201);
    }

    private function range(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return [
            Carbon::parse($data['from'] ?? now()->startOfMonth()),
            Carbon::parse($data['to'] ?? now()->endOfMonth()),
        ];
    }
}

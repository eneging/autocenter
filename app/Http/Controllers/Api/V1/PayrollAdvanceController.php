<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PayrollAdvance;
use App\Services\CashRegisterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PayrollAdvanceController extends Controller
{
    public function __construct(private readonly CashRegisterService $cashRegisters) {}

    /** Adelantos del trabajador autenticado. */
    public function mine(Request $request): JsonResponse
    {
        $worker = $request->user()->worker;

        if (! $worker) {
            return response()->json([]);
        }

        return response()->json($worker->payrollAdvances()->latest('requested_at')->limit(50)->get());
    }

    public function request(Request $request): JsonResponse
    {
        $worker = $request->user()->worker;

        if (! $worker) {
            abort(403, 'Tu usuario no tiene un perfil de trabajador asociado.');
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        if ($worker->payrollAdvances()->where('status', 'Pendiente')->exists()) {
            abort(422, 'Ya tienes una solicitud pendiente de respuesta.');
        }

        $advance = $worker->payrollAdvances()->create([
            ...$data,
            'status' => 'Pendiente',
            'requested_at' => now(),
        ]);

        return response()->json($advance, 201);
    }

    public function index(Request $request): JsonResponse
    {
        $query = PayrollAdvance::with(['worker:id,name,role', 'resolvedBy:id,name'])->latest('requested_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('worker_id')) {
            $query->where('worker_id', $request->integer('worker_id'));
        }

        return response()->json($query->limit(300)->get());
    }

    public function approve(Request $request, PayrollAdvance $advance): JsonResponse
    {
        return $this->resolve($request, $advance, 'Aprobado');
    }

    public function reject(Request $request, PayrollAdvance $advance): JsonResponse
    {
        return $this->resolve($request, $advance, 'Rechazado');
    }

    /** Entrega del adelanto; opcionalmente lo descuenta de la caja abierta como gasto fijo (Sueldos). */
    public function pay(Request $request, PayrollAdvance $advance): JsonResponse
    {
        abort_unless($advance->status === 'Aprobado', 422, 'Solo se puede pagar un adelanto aprobado.');

        $data = $request->validate([
            'register_in_cash' => ['nullable', 'boolean'],
            'payment_method' => ['required_if:register_in_cash,true', 'nullable', 'in:'.implode(',', config('taller.payment_methods'))],
        ]);

        DB::transaction(function () use ($advance, $data, $request) {
            if (! empty($data['register_in_cash'])) {
                $register = $this->cashRegisters->current();
                abort_unless($register, 422, 'Abre la caja para registrar la salida del adelanto.');

                $this->cashRegisters->addTransaction($register, [
                    'type' => 'Gasto Fijo',
                    'category' => 'Sueldos',
                    'payment_method' => $data['payment_method'],
                    'amount' => $advance->amount,
                    'worker_id' => $advance->worker_id,
                    'description' => "Adelanto de sueldo - {$advance->worker->name}",
                ], $request->user());
            }

            $advance->update(['status' => 'Pagado']);
        });

        return response()->json($advance->fresh()->load('worker:id,name,role'));
    }

    private function resolve(Request $request, PayrollAdvance $advance, string $status): JsonResponse
    {
        abort_unless($advance->status === 'Pendiente', 422, 'Esta solicitud ya fue respondida.');

        $advance->update([
            'status' => $status,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        return response()->json($advance->fresh()->load(['worker:id,name,role', 'resolvedBy:id,name']));
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CashRegister;
use App\Models\Transaction;
use App\Services\CashRegisterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CashRegisterController extends Controller
{
    public function __construct(private readonly CashRegisterService $service) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'payment_methods' => config('taller.payment_methods'),
            'income_categories' => config('taller.income_categories'),
            'fixed_expense_categories' => config('taller.fixed_expense_categories'),
            'variable_expense_categories' => config('taller.variable_expense_categories'),
            'igv_rate' => config('taller.igv_rate'),
        ]);
    }

    public function current(): JsonResponse
    {
        $register = $this->service->current();

        return response()->json($register ? $this->detail($register) : null);
    }

    public function index(): JsonResponse
    {
        return response()->json(
            CashRegister::with(['openedBy:id,name', 'closedBy:id,name'])->latest('opened_at')->limit(120)->get()
        );
    }

    public function show(CashRegister $cashRegister): JsonResponse
    {
        return response()->json($this->detail($cashRegister));
    }

    public function open(Request $request): JsonResponse
    {
        $data = $request->validate(['opening_amount' => ['nullable', 'numeric', 'min:0']]);

        $register = $this->service->open($request->user(), (float) ($data['opening_amount'] ?? 0));

        return response()->json($this->detail($register), 201);
    }

    public function close(Request $request, CashRegister $cashRegister): JsonResponse
    {
        $register = $this->service->close($cashRegister, $request->user());

        return response()->json($this->detail($register));
    }

    public function storeTransaction(Request $request, CashRegister $cashRegister): JsonResponse
    {
        $transaction = $this->service->addTransaction($cashRegister, $this->validatedTransaction($request), $request->user());

        return response()->json($transaction->load(['project:id,code,name', 'worker:id,name']), 201);
    }

    public function updateTransaction(Request $request, Transaction $transaction): JsonResponse
    {
        $updated = $this->service->updateTransaction($transaction, $this->validatedTransaction($request));

        return response()->json($updated->load(['project:id,code,name', 'worker:id,name']));
    }

    public function destroyTransaction(Transaction $transaction): JsonResponse
    {
        abort_if($transaction->cashRegister->status !== 'Abierta', 422, 'La caja está cerrada; el movimiento ya no se puede eliminar.');

        $transaction->delete();

        return response()->json(status: 204);
    }

    private function detail(CashRegister $register): array
    {
        $register->load(['openedBy:id,name', 'closedBy:id,name']);

        return [
            ...$register->toArray(),
            'summary' => $this->service->summary($register),
            'transactions' => $register->transactions()
                ->with(['project:id,code,name', 'worker:id,name', 'invoice:id,transaction_id,type,number,status'])
                ->latest('id')
                ->get(),
        ];
    }

    private function validatedTransaction(Request $request): array
    {
        $type = $request->input('type');

        $categories = match ($type) {
            'Ingreso' => config('taller.income_categories'),
            'Gasto Fijo' => config('taller.fixed_expense_categories'),
            'Gasto Variable' => config('taller.variable_expense_categories'),
            default => [],
        };

        return $request->validate([
            'type' => ['required', Rule::in(['Ingreso', 'Gasto Fijo', 'Gasto Variable'])],
            'payment_method' => ['nullable', Rule::in(config('taller.payment_methods')), Rule::requiredIf($type === 'Ingreso')],
            'category' => ['required', 'string', Rule::in($categories)],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999'],
            'is_taxable' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:500'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'worker_id' => ['nullable', 'exists:workers,id'],
            'transaction_date' => ['nullable', 'date'],
        ]);
    }
}

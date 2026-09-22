<?php

namespace App\Services;

use App\Models\CashRegister;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Igv;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashRegisterService
{
    public function current(): ?CashRegister
    {
        return CashRegister::where('status', 'Abierta')->latest('opened_at')->first();
    }

    public function open(User $user, float $openingAmount = 0): CashRegister
    {
        return DB::transaction(function () use ($user, $openingAmount) {
            if (CashRegister::where('status', 'Abierta')->lockForUpdate()->exists()) {
                throw ValidationException::withMessages(['cash_register' => 'Ya hay una caja abierta. Ciérrala antes de abrir otra.']);
            }

            return CashRegister::create([
                'opened_by' => $user->id,
                'opened_at' => now(),
                'opening_amount' => $openingAmount,
                'status' => 'Abierta',
            ]);
        });
    }

    public function close(CashRegister $register, User $user): CashRegister
    {
        if ($register->status !== 'Abierta') {
            throw ValidationException::withMessages(['cash_register' => 'Esta caja ya está cerrada.']);
        }

        $summary = $this->summary($register);

        $register->update([
            'status' => 'Cerrada',
            'closed_by' => $user->id,
            'closed_at' => now(),
            'total_income' => $summary['income_total'],
        ]);

        return $register->fresh();
    }

    /**
     * Registra un movimiento. El monto es siempre el total pagado (IGV incluido);
     * si es gravado se calcula el 18% contenido en ese total.
     */
    public function addTransaction(CashRegister $register, array $data, User $user): Transaction
    {
        if ($register->status !== 'Abierta') {
            throw ValidationException::withMessages(['cash_register' => 'La caja está cerrada; no se pueden registrar movimientos.']);
        }

        $taxable = (bool) ($data['is_taxable'] ?? false);

        return Transaction::create([
            'cash_register_id' => $register->id,
            'project_id' => $data['project_id'] ?? null,
            'worker_id' => $data['worker_id'] ?? null,
            'type' => $data['type'],
            'payment_method' => $data['payment_method'] ?? null,
            'category' => $data['category'],
            'amount' => $data['amount'],
            'is_taxable' => $taxable,
            'igv_amount' => $taxable ? Igv::extract((float) $data['amount']) : 0,
            'description' => $data['description'] ?? null,
            'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
            'registered_by' => $user->id,
        ]);
    }

    public function updateTransaction(Transaction $transaction, array $data): Transaction
    {
        if ($transaction->cashRegister->status !== 'Abierta') {
            throw ValidationException::withMessages(['cash_register' => 'La caja está cerrada; el movimiento ya no se puede editar.']);
        }

        $taxable = (bool) ($data['is_taxable'] ?? false);

        $transaction->update([
            ...$data,
            'is_taxable' => $taxable,
            'igv_amount' => $taxable ? Igv::extract((float) $data['amount']) : 0,
        ]);

        return $transaction->fresh();
    }

    /**
     * Totales de una caja: ingresos por método de pago, egresos fijos/variables e IGV.
     */
    public function summary(CashRegister $register): array
    {
        return $this->summarize($register->transactions()->get(), (float) $register->opening_amount);
    }

    /**
     * @param  iterable<Transaction>  $transactions
     */
    public function summarize(iterable $transactions, float $openingAmount = 0): array
    {
        $transactions = collect($transactions);
        $incomes = $transactions->where('type', 'Ingreso');
        $fixed = $transactions->where('type', 'Gasto Fijo');
        $variable = $transactions->where('type', 'Gasto Variable');

        $byMethod = [];
        foreach (config('taller.payment_methods') as $method) {
            $byMethod[$method] = round((float) $incomes->where('payment_method', $method)->sum('amount'), 2);
        }
        $unassigned = round((float) $incomes->whereNull('payment_method')->sum('amount'), 2);
        if ($unassigned > 0) {
            $byMethod['Sin método'] = $unassigned;
        }

        $incomeTotal = round((float) $incomes->sum('amount'), 2);
        $fixedTotal = round((float) $fixed->sum('amount'), 2);
        $variableTotal = round((float) $variable->sum('amount'), 2);
        $expenseByMethodCash = round((float) $transactions->where('type', '!=', 'Ingreso')->where('payment_method', 'Efectivo')->sum('amount'), 2);

        return [
            'income_total' => $incomeTotal,
            'income_by_method' => $byMethod,
            'fixed_expenses_total' => $fixedTotal,
            'variable_expenses_total' => $variableTotal,
            'expenses_total' => round($fixedTotal + $variableTotal, 2),
            'expenses_by_category' => $transactions->where('type', '!=', 'Ingreso')
                ->groupBy('category')
                ->map(fn ($rows) => round((float) $rows->sum('amount'), 2))
                ->sortDesc()
                ->all(),
            'igv_income' => round((float) $incomes->where('is_taxable', true)->sum('igv_amount'), 2),
            'igv_expenses' => round((float) $transactions->where('type', '!=', 'Ingreso')->where('is_taxable', true)->sum('igv_amount'), 2),
            'net_result' => round($incomeTotal - $fixedTotal - $variableTotal, 2),
            'opening_amount' => round($openingAmount, 2),
            'expected_cash' => round($openingAmount + ($byMethod['Efectivo'] ?? 0) - $expenseByMethodCash, 2),
            'transactions_count' => $transactions->count(),
        ];
    }
}

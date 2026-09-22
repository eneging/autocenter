<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\QuotationPayment;
use App\Models\SavingsMovement;
use App\Models\WorkerPayment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class FinanceService
{
    public function rangeTotals(Carbon $from, Carbon $to): array
    {
        $income = (float) QuotationPayment::whereBetween('paid_at', [$from, $to])->sum('amount');
        $labor = (float) WorkerPayment::whereBetween('paid_at', [$from, $to])->sum('total_amount');
        $expenses = (float) Expense::whereBetween('expense_date', [$from, $to])->sum('amount');

        return [
            'income_total' => round($income, 2),
            'labor_total' => round($labor, 2),
            'expenses_total' => round($expenses, 2),
            'outflow_total' => round($labor + $expenses, 2),
            'balance' => round($income - $labor - $expenses, 2),
        ];
    }

    public function incomeStatement(Carbon $from, Carbon $to): array
    {
        $totals = $this->rangeTotals($from, $to);

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'income_total' => $totals['income_total'],
            'labor_total' => $totals['labor_total'],
            'expenses_by_category' => $this->expensesByCategory($from, $to),
            'expenses_total' => $totals['expenses_total'],
            'total_outflow' => $totals['outflow_total'],
            'net_result' => $totals['balance'],
        ];
    }

    private const SPANISH_MONTH_ABBR = [
        1 => 'Ene', 2 => 'Feb', 3 => 'Mar', 4 => 'Abr', 5 => 'May', 6 => 'Jun',
        7 => 'Jul', 8 => 'Ago', 9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Dic',
    ];

    public function monthlySeries(int $months = 6): array
    {
        $series = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $month = Carbon::now()->startOfMonth()->subMonths($i);
            $totals = $this->rangeTotals($month->copy()->startOfMonth(), $month->copy()->endOfMonth());

            $series[] = [
                'month' => self::SPANISH_MONTH_ABBR[$month->month],
                'income' => $totals['income_total'],
                'expenses' => $totals['outflow_total'],
            ];
        }

        return $series;
    }

    public function expensesByCategory(Carbon $from, Carbon $to): array
    {
        return Expense::whereBetween('expense_date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => ['category' => $row->category, 'total' => round((float) $row->total, 2)])
            ->all();
    }

    public function receivables(): Collection
    {
        return Quotation::with(['client', 'project', 'payments'])
            ->get()
            ->filter(fn (Quotation $quotation) => $quotation->balance_due > 0.01)
            ->sortByDesc('balance_due')
            ->values();
    }

    public function ledger(?Carbon $from, ?Carbon $to, ?int $projectId, ?string $type): array
    {
        $entries = collect();

        if ($type !== 'egreso') {
            $paymentsQuery = QuotationPayment::with(['quotation.client', 'quotation.project']);
            if ($from && $to) {
                $paymentsQuery->whereBetween('paid_at', [$from, $to]);
            }
            if ($projectId) {
                $paymentsQuery->whereHas('quotation', fn ($query) => $query->where('project_id', $projectId));
            }

            foreach ($paymentsQuery->get() as $payment) {
                $entries->push([
                    'id' => 'income-'.$payment->id,
                    'type' => 'ingreso',
                    'date' => $payment->paid_at->toDateString(),
                    'category' => 'Cobro de cotizacion',
                    'description' => $payment->quotation->number.' · '.$payment->quotation->client->name,
                    'amount' => (float) $payment->amount,
                    'method' => $payment->method,
                    'project' => $payment->quotation->project?->only(['id', 'code', 'name']),
                ]);
            }
        }

        if ($type !== 'ingreso') {
            $laborQuery = WorkerPayment::with(['worker', 'project']);
            if ($from && $to) {
                $laborQuery->whereBetween('paid_at', [$from, $to]);
            }
            if ($projectId) {
                $laborQuery->where('project_id', $projectId);
            }

            foreach ($laborQuery->get() as $payment) {
                $entries->push([
                    'id' => 'labor-'.$payment->id,
                    'type' => 'egreso',
                    'date' => Carbon::parse($payment->paid_at)->toDateString(),
                    'category' => 'Mano de obra',
                    'description' => $payment->worker->name.' ('.$payment->period_start->format('d/m').' - '.$payment->period_end->format('d/m').')',
                    'amount' => (float) $payment->total_amount,
                    'method' => null,
                    'project' => $payment->project?->only(['id', 'code', 'name']),
                ]);
            }

            $expensesQuery = Expense::with('project');
            if ($from && $to) {
                $expensesQuery->whereBetween('expense_date', [$from, $to]);
            }
            if ($projectId) {
                $expensesQuery->where('project_id', $projectId);
            }

            foreach ($expensesQuery->get() as $expense) {
                $entries->push([
                    'id' => 'expense-'.$expense->id,
                    'type' => 'egreso',
                    'date' => $expense->expense_date->toDateString(),
                    'category' => $expense->category,
                    'description' => $expense->title,
                    'amount' => (float) $expense->amount,
                    'method' => $expense->method,
                    'project' => $expense->project?->only(['id', 'code', 'name']),
                ]);
            }
        }

        return $entries->sortByDesc('date')->values()->all();
    }

    public function savingsBalances(): array
    {
        $balance = function (string $type): float {
            $aportes = (float) SavingsMovement::where('type', $type)->where('direction', 'aporte')->sum('amount');
            $retiros = (float) SavingsMovement::where('type', $type)->where('direction', 'retiro')->sum('amount');

            return round($aportes - $retiros, 2);
        };

        $ahorro = $balance('ahorro');
        $inversion = $balance('inversion');

        return [
            'ahorro' => $ahorro,
            'inversion' => $inversion,
            'total' => round($ahorro + $inversion, 2),
        ];
    }

    public function projectsProfitability(): Collection
    {
        return Project::withSum('quotations as quoted_total', 'total')
            ->get()
            ->map(function (Project $project) {
                $income = (float) QuotationPayment::whereHas('quotation', fn ($query) => $query->where('project_id', $project->id))->sum('amount');
                $labor = (float) WorkerPayment::where('project_id', $project->id)->sum('total_amount');
                $expenses = (float) Expense::where('project_id', $project->id)->sum('amount');

                return [
                    'project' => $project->only(['id', 'code', 'name', 'status']),
                    'quoted_total' => round((float) $project->quoted_total, 2),
                    'income' => round($income, 2),
                    'labor' => round($labor, 2),
                    'expenses' => round($expenses, 2),
                    'profit' => round($income - $labor - $expenses, 2),
                ];
            })
            ->filter(fn (array $row) => $row['quoted_total'] > 0 || $row['income'] > 0 || $row['labor'] > 0 || $row['expenses'] > 0)
            ->sortByDesc('profit')
            ->values();
    }
}

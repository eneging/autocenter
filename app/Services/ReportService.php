<?php

namespace App\Services;

use App\Models\CashRegister;
use App\Models\Project;
use App\Models\Transaction;
use Illuminate\Support\Carbon;

class ReportService
{
    public const PERIODS = ['daily', 'weekly', 'monthly'];

    public function __construct(
        private readonly CashRegisterService $cashRegisters,
        private readonly CommissionService $commissions,
    ) {}

    /** Devuelve [desde, hasta, etiqueta] para el período pedido. $reference: fecha (Y-m-d) o mes (Y-m). */
    public function range(string $period, string $reference): array
    {
        return match ($period) {
            'daily' => (function () use ($reference) {
                $day = Carbon::parse($reference);

                return [$day->copy()->startOfDay(), $day->copy()->endOfDay(), 'Reporte diario '.$day->format('d/m/Y')];
            })(),
            'weekly' => (function () use ($reference) {
                $start = Carbon::parse($reference)->startOfWeek(Carbon::MONDAY);
                $end = $start->copy()->endOfWeek(Carbon::SUNDAY);

                return [$start, $end, 'Reporte semanal '.$start->format('d/m/Y').' al '.$end->format('d/m/Y')];
            })(),
            'monthly' => (function () use ($reference) {
                $month = Carbon::createFromFormat('Y-m', substr($reference, 0, 7))->startOfMonth();

                return [$month->copy()->startOfMonth(), $month->copy()->endOfMonth(), 'Resumen mensual '.$month->translatedFormat('F Y')];
            })(),
        };
    }

    public function build(string $period, string $reference): array
    {
        [$from, $to, $title] = $this->range($period, $reference);

        $transactions = Transaction::with(['project:id,code,name', 'worker:id,name', 'cashRegister:id'])
            ->whereBetween('transaction_date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get();

        $registers = CashRegister::whereBetween('opened_at', [$from, $to])->get();
        $opening = (float) $registers->sum('opening_amount');

        $daily = $transactions->groupBy(fn (Transaction $t) => $t->transaction_date->toDateString())
            ->map(function ($rows, $date) {
                $income = round((float) $rows->where('type', 'Ingreso')->sum('amount'), 2);
                $expenses = round((float) $rows->where('type', '!=', 'Ingreso')->sum('amount'), 2);

                return ['date' => $date, 'income' => $income, 'expenses' => $expenses, 'net' => round($income - $expenses, 2)];
            })
            ->values()
            ->all();

        return [
            'period' => $period,
            'title' => $title,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'summary' => $this->cashRegisters->summarize($transactions, $opening),
            'daily' => $daily,
            'transactions' => $transactions->map(fn (Transaction $t) => [
                'date' => $t->transaction_date->toDateString(),
                'type' => $t->type,
                'category' => $t->category,
                'payment_method' => $t->payment_method,
                'amount' => (float) $t->amount,
                'igv_amount' => (float) $t->igv_amount,
                'description' => $t->description,
                'order' => $t->project?->code,
                'worker' => $t->worker?->name,
            ])->all(),
            'commissions' => $this->commissions->forRange($from, $to),
            'orders_finished' => Project::whereBetween('exit_date', [$from->toDateString(), $to->toDateString()])->count(),
            'orders_received' => Project::whereBetween('starts_at', [$from->toDateString(), $to->toDateString()])->count(),
            'cash_registers' => $registers->count(),
        ];
    }
}

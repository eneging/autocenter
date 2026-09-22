<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\Worker;
use Illuminate\Support\Carbon;

class CommissionService
{
    /** Comisión (en soles) que corresponde a un monto generado, según los escalones configurados. */
    public function forAmount(float $generated): float
    {
        $tiers = collect(config('taller.commission_tiers'))->sortByDesc('min');

        foreach ($tiers as $tier) {
            if ($generated >= $tier['min']) {
                return (float) $tier['amount'];
            }
        }

        return 0.0;
    }

    /**
     * Ingresos generados y comisión de cada técnico en un rango de fechas
     * (ingresos de caja ligados a las órdenes que tuvo asignadas).
     *
     * @return array<int, array{worker_id:int, worker_name:string, generated:float, commission:float, orders:int}>
     */
    public function forRange(Carbon $from, Carbon $to): array
    {
        $income = Transaction::query()
            ->where('type', 'Ingreso')
            ->whereBetween('transaction_date', [$from->toDateString(), $to->toDateString()])
            ->whereHas('project', fn ($q) => $q->whereNotNull('responsible_worker_id'))
            ->with('project:id,responsible_worker_id')
            ->get()
            ->groupBy(fn (Transaction $t) => $t->project->responsible_worker_id);

        return Worker::whereIn('id', $income->keys())
            ->get()
            ->map(function (Worker $worker) use ($income) {
                $rows = $income[$worker->id];
                $generated = round((float) $rows->sum('amount'), 2);

                return [
                    'worker_id' => $worker->id,
                    'worker_name' => $worker->name,
                    'generated' => $generated,
                    'commission' => $this->forAmount($generated),
                    'orders' => $rows->pluck('project_id')->unique()->count(),
                ];
            })
            ->sortByDesc('generated')
            ->values()
            ->all();
    }
}

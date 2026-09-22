<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\PayrollAdvance;
use App\Models\Worker;
use App\Models\WorkerPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkerPaymentController extends Controller
{
    public function summary(Worker $worker, Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $attendances = $this->unpaidAttendances($worker, $data['from'], $data['to'])->get();
        $totalHours = $attendances->sum(fn (Attendance $attendance) => $attendance->worked_hours ?? 0);
        $totalAmount = round($totalHours * (float) $worker->hourly_rate, 2);

        $advances = $this->deductibleAdvances($worker)->get();
        $selected = $this->selectAdvances($advances, $totalAmount);
        $deductible = round((float) $selected->sum('amount'), 2);

        return response()->json([
            'worker' => $worker,
            'attendances' => $attendances,
            'total_hours' => round($totalHours, 2),
            'hourly_rate' => $worker->hourly_rate,
            'total_amount' => $totalAmount,
            'advances' => $advances,
            'advances_deductible' => $deductible,
            'net_amount' => round($totalAmount - $deductible, 2),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = WorkerPayment::with(['worker', 'project' => fn ($q) => $q->withTrashed()])->latest('paid_at');

        if ($request->filled('worker_id')) {
            $query->where('worker_id', $request->integer('worker_id'));
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'worker_id' => ['required', 'exists:workers,id'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'paid_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'deduct_advances' => ['nullable', 'boolean'],
        ]);

        $worker = Worker::findOrFail($data['worker_id']);
        $deductAdvances = (bool) ($data['deduct_advances'] ?? true);

        $payment = DB::transaction(function () use ($data, $worker, $request, $deductAdvances) {
            $attendances = $this->unpaidAttendances($worker, $data['period_start'], $data['period_end'])->lockForUpdate()->get();
            $totalHours = round($attendances->sum(fn (Attendance $attendance) => $attendance->worked_hours ?? 0), 2);

            if ($totalHours <= 0) {
                abort(422, 'No hay horas sin pagar en ese rango de fechas para este trabajador.');
            }

            $totalAmount = round($totalHours * (float) $worker->hourly_rate, 2);

            $payment = WorkerPayment::create([
                'worker_id' => $worker->id,
                'project_id' => $data['project_id'] ?? null,
                'registered_by' => $request->user()->id,
                'period_start' => $data['period_start'],
                'period_end' => $data['period_end'],
                'total_hours' => $totalHours,
                'hourly_rate' => $worker->hourly_rate,
                'total_amount' => $totalAmount,
                'paid_at' => $data['paid_at'],
                'notes' => $data['notes'] ?? null,
            ]);

            Attendance::whereIn('id', $attendances->pluck('id'))->update(['worker_payment_id' => $payment->id]);

            if ($deductAdvances) {
                $this->applyAdvances($worker, $payment, $totalAmount);
            }

            return $payment;
        });

        return response()->json($payment->load(['worker', 'project', 'attendances']), 201);
    }

    public function destroy(WorkerPayment $workerPayment): JsonResponse
    {
        DB::transaction(function () use ($workerPayment) {
            $workerPayment->attendances()->update(['worker_payment_id' => null]);
            PayrollAdvance::where('worker_payment_id', $workerPayment->id)->update(['worker_payment_id' => null]);
            $workerPayment->delete();
        });

        return response()->json(status: 204);
    }

    /** Adelantos ya entregados (Pagado) que todavía no se descontaron de ningún pago. */
    private function deductibleAdvances(Worker $worker)
    {
        return PayrollAdvance::where('worker_id', $worker->id)
            ->where('status', 'Pagado')
            ->whereNull('worker_payment_id')
            ->orderBy('requested_at');
    }

    /** Descuenta adelantos completos, del más antiguo al más nuevo, sin superar el monto del pago. */
    private function applyAdvances(Worker $worker, WorkerPayment $payment, float $totalAmount): void
    {
        $selected = $this->selectAdvances($this->deductibleAdvances($worker)->lockForUpdate()->get(), $totalAmount);

        PayrollAdvance::whereIn('id', $selected->pluck('id'))->update(['worker_payment_id' => $payment->id]);

        $payment->update(['advances_deducted' => round((float) $selected->sum('amount'), 2)]);
    }

    /** Toma adelantos completos, del más antiguo al más nuevo, mientras quepan en el monto del pago. */
    private function selectAdvances($advances, float $totalAmount)
    {
        $remaining = $totalAmount;

        return $advances->takeWhile(function (PayrollAdvance $advance) use (&$remaining) {
            if ((float) $advance->amount > $remaining) {
                return false;
            }

            $remaining -= (float) $advance->amount;

            return true;
        });
    }

    private function unpaidAttendances(Worker $worker, string $from, string $to)
    {
        return Attendance::where('worker_id', $worker->id)
            ->whereNull('worker_payment_id')
            ->whereNotNull('clock_out')
            ->whereBetween('date', [$from, $to]);
    }
}

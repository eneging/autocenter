<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Worker;
use Illuminate\Support\Carbon;

class AttendanceService
{
    public function clockIn(Worker $worker): Attendance
    {
        $openPrevious = Attendance::where('worker_id', $worker->id)
            ->where('date', '<', Carbon::today()->toDateString())
            ->whereNull('clock_out')
            ->exists();

        if ($openPrevious) {
            abort(422, 'Tienes una jornada anterior sin cerrar. Contacta a un administrador para corregirla.');
        }

        $today = Carbon::today();

        if (Attendance::where('worker_id', $worker->id)->where('date', $today->toDateString())->exists()) {
            abort(422, 'Ya marcaste tu entrada hoy.');
        }

        return Attendance::create([
            'worker_id' => $worker->id,
            'date' => $today->toDateString(),
            'clock_in' => Carbon::now(),
        ]);
    }

    public function clockOut(Worker $worker): Attendance
    {
        $attendance = $this->openAttendance($worker);

        if (! $attendance) {
            abort(422, 'Todavia no marcas tu entrada de hoy.');
        }

        $now = Carbon::now();
        $data = ['clock_out' => $now];

        // Si se quedo "en almuerzo" y no volvio a marcar, cerramos la pausa
        // en este mismo instante para que ese tiempo no cuente como trabajado.
        if ($attendance->break_start && ! $attendance->break_end) {
            $data['break_end'] = $now;
        }

        $attendance->update($data);

        return $attendance;
    }

    public function breakStart(Worker $worker): Attendance
    {
        $attendance = $this->openAttendance($worker);

        if (! $attendance) {
            abort(422, 'Todavia no marcas tu entrada de hoy.');
        }

        if ($attendance->break_start) {
            abort(422, 'Ya marcaste tu salida a almorzar hoy.');
        }

        $attendance->update(['break_start' => Carbon::now()]);

        return $attendance;
    }

    public function breakEnd(Worker $worker): Attendance
    {
        $attendance = $this->openAttendance($worker);

        if (! $attendance || ! $attendance->break_start) {
            abort(422, 'Todavia no marcas tu salida a almorzar.');
        }

        if ($attendance->break_end) {
            abort(422, 'Ya marcaste tu regreso del almuerzo.');
        }

        $attendance->update(['break_end' => Carbon::now()]);

        return $attendance;
    }

    /**
     * Marca por QR: si tiene una jornada abierta registra la salida, si no, la entrada.
     *
     * @return array{type: string, attendance: Attendance}
     */
    public function scan(Worker $worker): array
    {
        if (! $worker->is_active) {
            abort(422, 'El trabajador está inactivo.');
        }

        if ($this->openAttendance($worker)) {
            return ['type' => 'Salida', 'attendance' => $this->clockOut($worker)];
        }

        return ['type' => 'Entrada', 'attendance' => $this->clockIn($worker)];
    }

    private function openAttendance(Worker $worker): ?Attendance
    {
        return Attendance::where('worker_id', $worker->id)
            ->whereNull('clock_out')
            ->orderByDesc('date')
            ->first();
    }
}

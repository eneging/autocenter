<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceQrCode;
use App\Models\Worker;
use App\Services\AttendanceQrService;
use App\Services\AttendanceService;
use App\Services\QrCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly AttendanceService $attendance,
        private readonly AttendanceQrService $qrCodes,
        private readonly QrCodeService $qr,
    ) {}

    public function myStatus(Request $request): JsonResponse
    {
        $worker = $request->user()->worker;

        if (! $worker) {
            return response()->json(['today' => null, 'history' => []]);
        }

        $today = Attendance::where('worker_id', $worker->id)
            ->whereNull('clock_out')
            ->orderByDesc('date')
            ->first()
            ?? Attendance::where('worker_id', $worker->id)->where('date', Carbon::today()->toDateString())->first();

        $history = Attendance::where('worker_id', $worker->id)
            ->where('date', '>=', Carbon::today()->subDays(30)->toDateString())
            ->orderByDesc('date')
            ->get();

        return response()->json(['today' => $today, 'history' => $history]);
    }

    public function breakStart(Request $request): JsonResponse
    {
        return response()->json($this->attendance->breakStart($this->workerOf($request)));
    }

    public function breakEnd(Request $request): JsonResponse
    {
        return response()->json($this->attendance->breakEnd($this->workerOf($request)));
    }

    /**
     * El trabajador escanea (desde su propia cuenta) el QR único que imprimió el administrador
     * y que está pegado en el taller. La primera vez del día marca su entrada; la siguiente, su salida.
     */
    public function myScan(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:100']]);

        $this->qrCodes->resolveValid($data['code']);

        $result = $this->attendance->scan($this->workerOf($request));

        return response()->json([
            'type' => $result['type'],
            'attendance' => $result['attendance'],
            'scanned_at' => now()->toIso8601String(),
        ], $result['type'] === 'Entrada' ? 201 : 200);
    }

    /** QR de asistencia vigente (para imprimir y pegar en el taller), si hay uno activo. */
    public function qrCurrent(): JsonResponse
    {
        $code = $this->qrCodes->current();

        return response()->json($code ? $this->qrPayload($code) : null);
    }

    /** Genera un QR nuevo (con vencimiento o sin él) y desactiva el anterior. */
    public function qrGenerate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'never_expires' => ['required', 'boolean'],
            'expires_at' => ['required_if:never_expires,false', 'nullable', 'date', 'after:now'],
        ]);

        $expiresAt = $data['never_expires'] ? null : Carbon::parse($data['expires_at']);
        $code = $this->qrCodes->generate($expiresAt, $request->user());

        return response()->json($this->qrPayload($code), 201);
    }

    public function qrRevoke(AttendanceQrCode $attendanceQrCode): JsonResponse
    {
        return response()->json($this->qrPayload($this->qrCodes->revoke($attendanceQrCode)));
    }

    public function index(Request $request): JsonResponse
    {
        $query = Attendance::with('worker')->orderByDesc('date');

        if ($request->filled('worker_id')) {
            $query->where('worker_id', $request->integer('worker_id'));
        }
        if ($request->filled('from')) {
            $query->where('date', '>=', $request->date('from')->toDateString());
        }
        if ($request->filled('to')) {
            $query->where('date', '<=', $request->date('to')->toDateString());
        }

        return response()->json($query->get());
    }

    public function update(Attendance $attendance, Request $request): JsonResponse
    {
        if ($attendance->worker_payment_id) {
            abort(422, 'Este registro ya forma parte de un pago. Anula el pago antes de corregirlo.');
        }

        $data = $request->validate([
            'clock_in' => ['required', 'date'],
            'clock_out' => ['nullable', 'date', 'after:clock_in'],
        ]);

        $attendance->update([
            'clock_in' => $data['clock_in'],
            'clock_out' => $data['clock_out'] ?? null,
            'date' => Carbon::parse($data['clock_in'])->toDateString(),
        ]);

        return response()->json($attendance->load('worker'));
    }

    public function destroy(Attendance $attendance): JsonResponse
    {
        if ($attendance->worker_payment_id) {
            abort(422, 'Este registro ya forma parte de un pago. Anula el pago antes de eliminarlo.');
        }

        $attendance->delete();

        return response()->json(status: 204);
    }

    private function workerOf(Request $request): Worker
    {
        $worker = $request->user()->worker;

        if (! $worker) {
            abort(403, 'Tu usuario no tiene un perfil de trabajador asociado.');
        }

        return $worker;
    }

    private function qrPayload(AttendanceQrCode $code): array
    {
        return [
            'id' => $code->id,
            'is_active' => $code->is_active,
            'expires_at' => $code->expires_at?->toIso8601String(),
            'created_at' => $code->created_at->toIso8601String(),
            'creator' => $code->creator?->only(['id', 'name']),
            'svg' => $this->qr->svg($code->token),
        ];
    }
}

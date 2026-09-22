<?php

namespace App\Services;

use App\Models\AttendanceQrCode;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * QR único de asistencia, generado y controlado por el administrador (no por trabajador):
 * se imprime y se pega en el taller. Cualquier técnico lo escanea desde su cuenta para
 * marcar su propia entrada o salida. El administrador decide cuánto dura o si no vence nunca.
 */
class AttendanceQrService
{
    public function current(): ?AttendanceQrCode
    {
        return AttendanceQrCode::active()->latest('id')->first();
    }

    public function generate(?Carbon $expiresAt, ?User $admin): AttendanceQrCode
    {
        return DB::transaction(function () use ($expiresAt, $admin) {
            AttendanceQrCode::where('is_active', true)->update(['is_active' => false, 'revoked_at' => now()]);

            return AttendanceQrCode::create([
                'token' => $this->newToken(),
                'created_by' => $admin?->id,
                'expires_at' => $expiresAt,
                'is_active' => true,
            ]);
        });
    }

    public function revoke(AttendanceQrCode $code): AttendanceQrCode
    {
        $code->update(['is_active' => false, 'revoked_at' => now()]);

        return $code->fresh();
    }

    /** Valida el código escaneado por el trabajador; aborta con un mensaje claro si no sirve. */
    public function resolveValid(string $token): AttendanceQrCode
    {
        $code = AttendanceQrCode::where('token', trim($token))->first();

        if (! $code) {
            abort(404, 'Código QR no reconocido.');
        }

        if (! $code->isUsable()) {
            abort(422, $code->isExpired() ? 'Este código QR ya venció. Pide al administrador uno nuevo.' : 'Este código QR ya no está activo. Pide al administrador uno nuevo.');
        }

        return $code;
    }

    private function newToken(): string
    {
        do {
            $token = 'ASIST-'.Str::upper(Str::random(16));
        } while (AttendanceQrCode::where('token', $token)->exists());

        return $token;
    }
}

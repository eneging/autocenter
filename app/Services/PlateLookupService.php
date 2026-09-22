<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Consulta de placas en json.pe. El resultado (incluidas las placas no encontradas) se guarda en caché
 * porque los datos de un vehículo casi no cambian y cada consulta consume cuota del plan.
 *
 * El límite mensual (JSONPE_MONTHLY_LIMIT, hoy 100 por el plan gratuito) es solo una variable de
 * entorno: si más adelante se compra un plan con más consultas, basta con subir ese número en el
 * .env del servidor — no requiere tocar código.
 */
class PlateLookupService
{
    public const NOT_CONFIGURED = 'not_configured';

    public const UNAVAILABLE = 'unavailable';

    public const LIMIT_REACHED = 'limit_reached';

    public function isConfigured(): bool
    {
        return filled(config('services.jsonpe.token'));
    }

    /**
     * @return array{month: string, limit: int, used: int, remaining: int}
     */
    public function usage(): array
    {
        $limit = (int) config('services.jsonpe.monthly_limit', 100);
        $month = now()->format('Y-m');
        $used = (int) DB::table('plate_lookup_usages')->where('month', $month)->value('count');

        return ['month' => $month, 'limit' => $limit, 'used' => $used, 'remaining' => max(0, $limit - $used)];
    }

    /**
     * @return array{data: ?array, error: ?string}
     */
    public function find(string $plate): array
    {
        $plate = ServiceOrderService::normalizePlate($plate);

        if (! $this->isConfigured()) {
            return ['data' => null, 'error' => self::NOT_CONFIGURED];
        }

        $key = 'plate-lookup:'.$plate;

        if (Cache::has($key)) {
            return ['data' => Cache::get($key) ?: null, 'error' => null];
        }

        if ($this->usage()['remaining'] <= 0) {
            return ['data' => null, 'error' => self::LIMIT_REACHED];
        }

        try {
            $response = Http::withToken(config('services.jsonpe.token'))
                ->acceptJson()
                ->timeout(10)
                ->post(rtrim(config('services.jsonpe.url'), '/').'/api/placa', ['placa' => $plate]);
        } catch (\Throwable $exception) {
            Log::warning('json.pe: no se pudo consultar la placa', ['plate' => $plate, 'message' => $exception->getMessage()]);

            return ['data' => null, 'error' => self::UNAVAILABLE];
        }

        // La petición llegó a json.pe y consumió cuota, sin importar el resultado.
        $this->recordUsage();

        // 400 = placa no encontrada / inválida: es una respuesta definitiva y se cachea.
        if ($response->status() === 400) {
            Cache::put($key, [], now()->addDays(1));

            return ['data' => null, 'error' => null];
        }

        if (! $response->successful() || ! $response->json('success')) {
            Log::warning('json.pe: respuesta inesperada', ['plate' => $plate, 'status' => $response->status(), 'body' => $response->json()]);

            return ['data' => null, 'error' => self::UNAVAILABLE];
        }

        $raw = (array) $response->json('data', []);
        $data = [
            'plate' => $plate,
            'brand' => $this->clean($raw['marca'] ?? null),
            'model' => $this->clean($raw['modelo'] ?? null),
            'color' => $this->clean($raw['color'] ?? null),
            'year' => $this->year($raw['anio'] ?? $raw['año'] ?? null),
            'vin' => $this->clean($raw['vin'] ?? $raw['serie'] ?? null),
            'engine_number' => $this->clean($raw['motor'] ?? null),
        ];

        if (! $data['brand'] && ! $data['model']) {
            Cache::put($key, [], now()->addDays(1));

            return ['data' => null, 'error' => null];
        }

        Cache::put($key, $data, now()->addDays(max(1, (int) config('services.jsonpe.cache_days', 30))));

        return ['data' => $data, 'error' => null];
    }

    private function recordUsage(): void
    {
        $month = now()->format('Y-m');

        DB::statement(
            'INSERT INTO plate_lookup_usages (month, count, created_at, updated_at) VALUES (?, 1, ?, ?) ON DUPLICATE KEY UPDATE count = count + 1, updated_at = ?',
            [$month, now(), now(), now()],
        );
    }

    private function year(mixed $value): ?string
    {
        $year = $this->clean($value);

        return $year !== null && preg_match('/^(19|20)\d{2}$/', $year) ? $year : null;
    }

    private function clean(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' || $value === '-' ? null : $value;
    }
}

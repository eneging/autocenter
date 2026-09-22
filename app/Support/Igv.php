<?php

namespace App\Support;

class Igv
{
    public static function rate(): float
    {
        return (float) config('taller.igv_rate', 0.18);
    }

    /**
     * Desglosa un monto en base imponible, IGV y total.
     *
     * @param  bool  $includesIgv  true si $amount ya incluye el IGV (se extrae); false si hay que sumarlo.
     * @return array{base: float, igv: float, total: float}
     */
    public static function breakdown(float $amount, bool $includesIgv): array
    {
        $rate = self::rate();

        if ($includesIgv) {
            $base = round($amount / (1 + $rate), 2);

            return ['base' => $base, 'igv' => round($amount - $base, 2), 'total' => round($amount, 2)];
        }

        $igv = round($amount * $rate, 2);

        return ['base' => round($amount, 2), 'igv' => $igv, 'total' => round($amount + $igv, 2)];
    }

    /** IGV contenido en un monto bruto (que ya incluye el impuesto). */
    public static function extract(float $gross): float
    {
        return self::breakdown($gross, true)['igv'];
    }
}

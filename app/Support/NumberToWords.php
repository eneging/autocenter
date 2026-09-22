<?php

namespace App\Support;

class NumberToWords
{
    private const UNIDADES = [
        '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ',
        'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE',
    ];

    private const DECENAS = [
        2 => 'VEINTE', 3 => 'TREINTA', 4 => 'CUARENTA', 5 => 'CINCUENTA',
        6 => 'SESENTA', 7 => 'SETENTA', 8 => 'OCHENTA', 9 => 'NOVENTA',
    ];

    private const CENTENAS = [
        1 => 'CIENTO', 2 => 'DOSCIENTOS', 3 => 'TRESCIENTOS', 4 => 'CUATROCIENTOS', 5 => 'QUINIENTOS',
        6 => 'SEISCIENTOS', 7 => 'SETECIENTOS', 8 => 'OCHOCIENTOS', 9 => 'NOVECIENTOS',
    ];

    public static function soles(float|string $amount): string
    {
        $amount = round((float) $amount, 2);
        $entero = (int) floor($amount);
        $centimos = (int) round(($amount - $entero) * 100);

        $letras = $entero === 0 ? 'CERO' : self::convert($entero);

        return sprintf('%s CON %02d/100 SOLES', $letras, $centimos);
    }

    private static function convert(int $number): string
    {
        if ($number < 0) {
            return 'MENOS '.self::convert(-$number);
        }

        if ($number <= 20) {
            return self::UNIDADES[$number];
        }

        if ($number < 100) {
            $decena = intdiv($number, 10);
            $resto = $number % 10;

            if ($decena === 2) {
                return $resto === 0 ? 'VEINTE' : 'VEINTI'.self::UNIDADES[$resto];
            }

            return $resto === 0 ? self::DECENAS[$decena] : self::DECENAS[$decena].' Y '.self::UNIDADES[$resto];
        }

        if ($number < 1000) {
            $centena = intdiv($number, 100);
            $resto = $number % 100;

            if ($number === 100) {
                return 'CIEN';
            }

            return $resto === 0 ? self::CENTENAS[$centena] : self::CENTENAS[$centena].' '.self::convert($resto);
        }

        if ($number < 1_000_000) {
            $miles = intdiv($number, 1000);
            $resto = $number % 1000;
            $prefijo = $miles === 1 ? 'MIL' : self::convert($miles).' MIL';

            return $resto === 0 ? $prefijo : $prefijo.' '.self::convert($resto);
        }

        $millones = intdiv($number, 1_000_000);
        $resto = $number % 1_000_000;
        $prefijo = $millones === 1 ? 'UN MILLÓN' : self::convert($millones).' MILLONES';

        return $resto === 0 ? $prefijo : $prefijo.' '.self::convert($resto);
    }
}

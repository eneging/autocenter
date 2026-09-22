<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

class ReportMovementsSheet implements FromArray, ShouldAutoSize, WithHeadings, WithTitle
{
    public function __construct(private readonly array $report) {}

    public function title(): string
    {
        return 'Movimientos';
    }

    public function headings(): array
    {
        return ['Fecha', 'Tipo', 'Categoría', 'Método de pago', 'Orden', 'Técnico', 'Monto (S/)', 'IGV (S/)', 'Descripción'];
    }

    public function array(): array
    {
        return array_map(fn (array $t) => [
            $t['date'],
            $t['type'],
            $t['category'],
            $t['payment_method'],
            $t['order'],
            $t['worker'],
            $t['amount'],
            $t['igv_amount'],
            $t['description'],
        ], $this->report['transactions']);
    }
}

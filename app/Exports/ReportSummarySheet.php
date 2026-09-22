<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithTitle;

class ReportSummarySheet implements FromArray, ShouldAutoSize, WithTitle
{
    public function __construct(private readonly array $report) {}

    public function title(): string
    {
        return 'Resumen';
    }

    public function array(): array
    {
        $s = $this->report['summary'];

        $rows = [
            [$this->report['title']],
            ['Desde', $this->report['from'], 'Hasta', $this->report['to']],
            [],
            ['INGRESOS POR MÉTODO DE PAGO', 'Monto (S/)'],
        ];

        foreach ($s['income_by_method'] as $method => $amount) {
            $rows[] = [$method, $amount];
        }

        $rows[] = ['Total ingresos', $s['income_total']];
        $rows[] = [];
        $rows[] = ['EGRESOS POR CATEGORÍA', 'Monto (S/)'];

        foreach ($s['expenses_by_category'] as $category => $amount) {
            $rows[] = [$category, $amount];
        }

        $rows[] = ['Gastos fijos', $s['fixed_expenses_total']];
        $rows[] = ['Gastos variables', $s['variable_expenses_total']];
        $rows[] = ['Total egresos', $s['expenses_total']];
        $rows[] = [];
        $rows[] = ['Resultado neto', $s['net_result']];
        $rows[] = ['IGV contenido en ingresos gravados', $s['igv_income']];
        $rows[] = ['IGV contenido en egresos gravados', $s['igv_expenses']];
        $rows[] = [];
        $rows[] = ['Órdenes recibidas', $this->report['orders_received']];
        $rows[] = ['Órdenes finalizadas', $this->report['orders_finished']];

        if ($this->report['commissions']) {
            $rows[] = [];
            $rows[] = ['COMISIONES', 'Órdenes', 'Generado (S/)', 'Comisión (S/)'];
            foreach ($this->report['commissions'] as $row) {
                $rows[] = [$row['worker_name'], $row['orders'], $row['generated'], $row['commission']];
            }
        }

        return $rows;
    }
}

<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

class ReportDailySheet implements FromArray, ShouldAutoSize, WithHeadings, WithTitle
{
    public function __construct(private readonly array $report) {}

    public function title(): string
    {
        return 'Por día';
    }

    public function headings(): array
    {
        return ['Fecha', 'Ingresos (S/)', 'Egresos (S/)', 'Neto (S/)'];
    }

    public function array(): array
    {
        return array_map(
            fn (array $day) => [$day['date'], $day['income'], $day['expenses'], $day['net']],
            $this->report['daily'],
        );
    }
}

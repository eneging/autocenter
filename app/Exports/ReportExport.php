<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ReportExport implements WithMultipleSheets
{
    public function __construct(private readonly array $report) {}

    public function sheets(): array
    {
        return [
            new ReportSummarySheet($this->report),
            new ReportDailySheet($this->report),
            new ReportMovementsSheet($this->report),
        ];
    }
}

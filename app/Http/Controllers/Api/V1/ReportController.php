<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\ReportExport;
use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Services\ReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reports) {}

    public function show(Request $request, string $period): JsonResponse
    {
        return response()->json($this->build($request, $period));
    }

    public function export(Request $request, string $period)
    {
        $report = $this->build($request, $period);
        $format = $request->validate(['format' => ['required', 'in:pdf,xlsx']])['format'];
        $filename = 'reporte-'.$period.'-'.$report['from'].($report['from'] === $report['to'] ? '' : '_'.$report['to']);

        if ($format === 'pdf') {
            return Pdf::loadView('pdf.report', ['report' => $report, 'company' => SiteSetting::current()])
                ->download($filename.'.pdf');
        }

        return Excel::download(new ReportExport($report), $filename.'.xlsx');
    }

    private function build(Request $request, string $period): array
    {
        abort_unless(in_array($period, ReportService::PERIODS, true), 404);

        $rule = $period === 'monthly' ? ['required', 'date_format:Y-m'] : ['required', 'date'];
        $data = $request->validate(['date' => $rule]);

        return $this->reports->build($period, $data['date']);
    }
}

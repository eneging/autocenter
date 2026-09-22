<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Quotation;
use App\Models\QuotationPayment;
use App\Models\SavingsMovement;
use App\Models\SiteSetting;
use App\Services\CloudinaryUploader;
use App\Services\FinanceService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class FinanceController extends Controller
{
    public function __construct(
        private readonly FinanceService $financeService,
        private readonly CloudinaryUploader $uploader,
    ) {
    }

    public function summary(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveRange($request);

        return response()->json([
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'totals' => $this->financeService->rangeTotals($from, $to),
            'expenses_by_category' => $this->financeService->expensesByCategory($from, $to),
            'monthly' => $this->financeService->monthlySeries(6),
            'receivables' => $this->financeService->receivables(),
        ]);
    }

    public function incomeStatementPdf(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);
        $statement = $this->financeService->incomeStatement($from, $to);

        return Pdf::loadView('pdf.income-statement', [
            'statement' => $statement,
            'company' => SiteSetting::current(),
        ])->download("estado-de-resultados-{$from->format('Y-m-d')}-a-{$to->format('Y-m-d')}.pdf");
    }

    public function incomeStatementCsv(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);
        $statement = $this->financeService->incomeStatement($from, $to);
        $filename = "estado-de-resultados-{$from->format('Y-m-d')}-a-{$to->format('Y-m-d')}.csv";

        return response()->streamDownload(function () use ($statement) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Estado de Resultados']);
            fputcsv($handle, ['Periodo', $statement['from'].' a '.$statement['to']]);
            fputcsv($handle, []);
            fputcsv($handle, ['INGRESOS']);
            fputcsv($handle, ['Ingresos cobrados', number_format($statement['income_total'], 2, '.', '')]);
            fputcsv($handle, []);
            fputcsv($handle, ['GASTOS']);
            fputcsv($handle, ['Mano de obra', number_format($statement['labor_total'], 2, '.', '')]);
            foreach ($statement['expenses_by_category'] as $row) {
                fputcsv($handle, [$row['category'], number_format($row['total'], 2, '.', '')]);
            }
            fputcsv($handle, ['Total gastos', number_format($statement['total_outflow'], 2, '.', '')]);
            fputcsv($handle, []);
            fputcsv($handle, ['UTILIDAD NETA DEL PERIODO', number_format($statement['net_result'], 2, '.', '')]);
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function ledger(Request $request): JsonResponse
    {
        $from = $request->filled('from') ? Carbon::parse($request->query('from'))->startOfDay() : null;
        $to = $request->filled('to') ? Carbon::parse($request->query('to'))->endOfDay() : null;
        $projectId = $request->filled('project_id') ? $request->integer('project_id') : null;
        $type = $request->filled('type') ? $request->string('type')->toString() : null;

        return response()->json($this->financeService->ledger($from, $to, $projectId, $type));
    }

    public function projectsProfitability(): JsonResponse
    {
        return response()->json($this->financeService->projectsProfitability());
    }

    public function expensesIndex(Request $request): JsonResponse
    {
        return response()->json(
            Expense::with(['project' => fn ($query) => $query->withTrashed()])
                ->when($request->filled('project_id'), fn ($query) => $query->where('project_id', $request->integer('project_id')))
                ->latest('expense_date')
                ->get()
        );
    }

    public function expensesStore(Request $request): JsonResponse
    {
        $expense = Expense::create([
            ...$this->validateExpense($request),
            'registered_by' => $request->user()->id,
        ]);

        return response()->json($expense->load('project'), 201);
    }

    public function expensesUpdate(Expense $expense, Request $request): JsonResponse
    {
        $expense->update($this->validateExpense($request));

        return response()->json($expense->fresh('project'));
    }

    public function expensesDestroy(Expense $expense): JsonResponse
    {
        $expense->delete();

        return response()->json(status: 204);
    }

    public function savingsIndex(): JsonResponse
    {
        return response()->json([
            'movements' => SavingsMovement::latest('movement_date')->latest('id')->get(),
            'balances' => $this->financeService->savingsBalances(),
        ]);
    }

    public function savingsStore(Request $request): JsonResponse
    {
        $data = $this->validateSavingsMovement($request);

        if ($data['direction'] === 'retiro') {
            $balances = $this->financeService->savingsBalances();
            $available = $data['type'] === 'ahorro' ? $balances['ahorro'] : $balances['inversion'];
            if ($data['amount'] > $available + 0.01) {
                abort(422, 'El monto del retiro supera el saldo disponible en ese fondo.');
            }
        }

        SavingsMovement::create([
            ...$data,
            'registered_by' => $request->user()->id,
        ]);

        return response()->json(status: 201);
    }

    public function savingsDestroy(SavingsMovement $savingsMovement): JsonResponse
    {
        $savingsMovement->delete();

        return response()->json(status: 204);
    }

    public function uploadReceipt(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf', 'max:10240'],
        ]);

        $url = $this->uploader->upload($request->file('file'), 'segmentos/expenses', 'auto');

        return response()->json(['url' => $url]);
    }

    public function quotationPaymentsStore(Quotation $quotation, Request $request): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'paid_at' => ['required', 'date'],
            'method' => ['required', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($data['amount'] > $quotation->balance_due + 0.01) {
            abort(422, 'El monto supera el saldo pendiente de esta cotizacion.');
        }

        QuotationPayment::create([
            ...$data,
            'quotation_id' => $quotation->id,
            'registered_by' => $request->user()->id,
        ]);

        return response()->json($quotation->fresh(['client', 'project', 'items', 'sunatDocuments', 'payments']), 201);
    }

    public function quotationPaymentsDestroy(QuotationPayment $quotationPayment): JsonResponse
    {
        $quotation = $quotationPayment->quotation;
        $quotationPayment->delete();

        return response()->json($quotation->fresh(['client', 'project', 'items', 'sunatDocuments', 'payments']));
    }

    private function resolveRange(Request $request): array
    {
        $from = $request->filled('from') ? Carbon::parse($request->query('from'))->startOfDay() : Carbon::now()->startOfMonth();
        $to = $request->filled('to') ? Carbon::parse($request->query('to'))->endOfDay() : Carbon::now()->endOfMonth();

        return [$from, $to];
    }

    private function validateSavingsMovement(Request $request): array
    {
        return $request->validate([
            'type' => ['required', 'in:ahorro,inversion'],
            'direction' => ['required', 'in:aporte,retiro'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'movement_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function validateExpense(Request $request): array
    {
        return $request->validate([
            'category' => ['required', 'string', 'max:60'],
            'title' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['required', 'date'],
            'method' => ['nullable', 'string', 'max:60'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'receipt_url' => ['nullable', 'string', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Archivo de boletas simples y facturas: se guarda el PDF, se organiza en carpetas
 * año/mes según la fecha de emisión y se pueden dar de baja (sin borrar el archivo).
 */
class InvoiceController extends Controller
{
    private function disk()
    {
        return Storage::disk(config('taller.invoices_disk'));
    }

    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['transaction:id,amount,category', 'uploader:id,name'])->latest('issue_date')->latest('id');

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('folder')) {
            [$year, $month] = array_pad(explode('/', (string) $request->string('folder')), 2, null);
            $query->whereYear('issue_date', $year);
            if ($month) {
                $query->whereMonth('issue_date', $month);
            }
        }
        if ($request->filled('search')) {
            $term = '%'.trim($request->string('search')).'%';
            $query->where(fn ($q) => $q->where('number', 'like', $term)->orWhere('customer_name', 'like', $term));
        }

        return response()->json($query->limit(500)->get());
    }

    /** Carpetas disponibles (año/mes) con su cantidad de comprobantes. */
    public function folders(): JsonResponse
    {
        $folders = Invoice::query()
            ->whereNotNull('issue_date')
            ->get(['issue_date', 'status'])
            ->groupBy(fn (Invoice $invoice) => $invoice->issue_date->format('Y/m'))
            ->map(fn ($rows, $folder) => [
                'folder' => $folder,
                'count' => $rows->count(),
                'voided' => $rows->where('status', 'Dado de baja')->count(),
            ])
            ->sortKeysDesc()
            ->values();

        return response()->json($folders);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['Boleta simple', 'Factura'])],
            'number' => ['required', 'string', 'max:40', Rule::unique('invoices', 'number')->where('type', $request->input('type'))],
            'issue_date' => ['required', 'date'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'total' => ['nullable', 'numeric', 'min:0'],
            'transaction_id' => ['nullable', 'exists:transactions,id'],
            'file' => ['required', 'file', 'mimetypes:application/pdf,image/jpeg,image/png', 'max:10240'],
        ]);

        $folder = 'invoices/'.date('Y/m', strtotime($data['issue_date']));
        $path = $this->disk()->putFile($folder, $request->file('file'));

        $invoice = Invoice::create([
            ...collect($data)->except('file')->all(),
            'file_path' => $path,
            'status' => 'Emitido',
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json($invoice->load('uploader:id,name'), 201);
    }

    public function void(Request $request, Invoice $invoice): JsonResponse
    {
        abort_if($invoice->status === 'Dado de baja', 422, 'Este comprobante ya fue dado de baja.');

        $data = $request->validate(['reason' => ['required', 'string', 'max:255']]);

        $invoice->update([
            'status' => 'Dado de baja',
            'voided_at' => now(),
            'void_reason' => $data['reason'],
        ]);

        return response()->json($invoice->fresh());
    }

    public function download(Invoice $invoice): StreamedResponse
    {
        abort_unless($this->disk()->exists($invoice->file_path), 404, 'El archivo ya no está disponible.');

        $extension = pathinfo($invoice->file_path, PATHINFO_EXTENSION);
        $name = str_replace(['/', '\\'], '-', ($invoice->type === 'Factura' ? 'Factura' : 'Boleta').'-'.$invoice->number).'.'.$extension;

        return $this->disk()->download($invoice->file_path, $name);
    }
}

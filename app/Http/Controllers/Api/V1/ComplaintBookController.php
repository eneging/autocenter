<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\ComplaintBookCopyMail;
use App\Mail\ComplaintBookResponseMail;
use App\Models\ComplaintBookEntry;
use App\Models\SiteSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class ComplaintBookController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tipo' => ['required', Rule::in(['reclamo', 'queja'])],
            'bien_tipo' => ['required', Rule::in(['producto', 'servicio'])],
            'monto_reclamado' => ['nullable', 'numeric', 'min:0'],
            'bien_descripcion' => ['required', 'string', 'max:2000'],
            'consumidor_nombre' => ['required', 'string', 'max:255'],
            'consumidor_domicilio' => ['required', 'string', 'max:255'],
            'consumidor_documento' => ['required', 'string', 'max:20'],
            'consumidor_telefono' => ['nullable', 'string', 'max:40'],
            'consumidor_email' => ['required', 'email', 'max:255'],
            'es_menor' => ['nullable', 'boolean'],
            'representante_nombre' => ['required_if:es_menor,true', 'nullable', 'string', 'max:255'],
            'detalle' => ['required', 'string', 'max:4000'],
            'pedido' => ['required', 'string', 'max:2000'],
            'enviar_copia_email' => ['nullable', 'boolean'],
            'consumidor_acepta' => ['accepted'],
        ]);

        $entry = ComplaintBookEntry::create([
            ...$data,
            'es_menor' => (bool) ($data['es_menor'] ?? false),
            'enviar_copia_email' => (bool) ($data['enviar_copia_email'] ?? false),
            'consumidor_ip' => $request->ip(),
            'consumidor_acepta_at' => now(),
        ]);

        if ($entry->enviar_copia_email) {
            try {
                Mail::to($entry->consumidor_email)->send(new ComplaintBookCopyMail($entry));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'id' => $entry->id,
            'code' => $entry->code,
            'access_token' => $entry->access_token,
        ], 201);
    }

    public function downloadPdf(Request $request, ComplaintBookEntry $complaintBookEntry)
    {
        $authorized = $request->user() !== null || $request->query('token') === $complaintBookEntry->access_token;
        abort_unless($authorized, 403);

        return Pdf::loadView('pdf.complaint-book', [
            'entry' => $complaintBookEntry,
            'company' => SiteSetting::current(),
        ])->download('hoja-reclamacion-'.$complaintBookEntry->code.'.pdf');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            ComplaintBookEntry::query()
                ->when($request->query('estado'), fn ($query, $estado) => $query->where('estado', $estado))
                ->orderByDesc('id')
                ->get()
        );
    }

    public function respond(Request $request, ComplaintBookEntry $complaintBookEntry): JsonResponse
    {
        $data = $request->validate([
            'respuesta_texto' => ['required', 'string', 'max:4000'],
        ]);

        $complaintBookEntry->update([
            'respuesta_texto' => $data['respuesta_texto'],
            'respuesta_fecha' => now(),
            'estado' => 'respondido',
        ]);

        try {
            Mail::to($complaintBookEntry->consumidor_email)->send(new ComplaintBookResponseMail($complaintBookEntry));
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json($complaintBookEntry->fresh());
    }
}

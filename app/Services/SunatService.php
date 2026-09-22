<?php

namespace App\Services;

use App\Models\Quotation;
use App\Models\SunatDocument;
use App\Models\SunatSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class SunatService
{
    public function emit(Quotation $quotation, User $user): SunatDocument
    {
        $client = $quotation->client;

        if (! $client->document_type || ! $client->document_number) {
            abort(422, 'Completa el tipo y numero de documento del cliente antes de emitir el comprobante.');
        }

        if ($quotation->sunatDocuments()->where('estado', 'aceptado')->exists()) {
            abort(422, 'Esta cotizacion ya tiene un comprobante emitido.');
        }

        $settings = SunatSetting::current();
        $entorno = $settings->isProduction() ? 'production' : 'sandbox';

        if ($entorno === 'production' && ! $settings->hasProductionToken()) {
            abort(422, 'Falta configurar el token de produccion de SUNAT antes de emitir comprobantes reales.');
        }

        $tipo = $client->document_type === '6' ? 'factura' : 'boleta';
        $serie = $tipo === 'factura' ? config('services.sunat.serie_factura') : config('services.sunat.serie_boleta');

        return DB::transaction(function () use ($quotation, $client, $user, $tipo, $serie, $entorno, $settings) {
            $numero = (int) (SunatDocument::where('tipo', $tipo)->where('serie', $serie)->lockForUpdate()->max('numero')) + 1;

            $payload = [
                'documento' => $tipo,
                'serie' => $serie,
                'numero' => $numero,
                'fecha_de_emision' => now('America/Lima')->toDateString(),
                'hora_de_emision' => now('America/Lima')->format('H:i:s'),
                'moneda' => 'PEN',
                'tipo_operacion' => '0101',
                'cliente_tipo_de_documento' => $client->document_type,
                'cliente_numero_de_documento' => $client->document_number,
                'cliente_denominacion' => $client->name,
                'cliente_direccion' => $client->address ?? '',
                'items' => $quotation->items->map(fn ($item) => [
                    'unidad_de_medida' => 'NIU',
                    'descripcion' => $item->description,
                    'cantidad' => (string) $item->quantity,
                    'valor_unitario' => (string) $item->unit_price,
                    'porcentaje_igv' => '18',
                    'codigo_tipo_afectacion_igv' => '10',
                    'nombre_tributo' => 'IGV',
                ])->all(),
                'total' => (string) $quotation->total,
            ];

            $document = SunatDocument::create([
                'quotation_id' => $quotation->id,
                'tipo' => $tipo,
                'serie' => $serie,
                'numero' => $numero,
                'moneda' => 'PEN',
                'estado' => 'error',
                'entorno' => $entorno,
                'payload' => $payload,
                'issued_by' => $user->id,
            ]);

            $baseUrl = $entorno === 'production'
                ? 'https://app.apisunat.pe'
                : 'https://sandbox.apisunat.pe';
            $token = $entorno === 'production' ? $settings->token_production : config('services.sunat.token');

            try {
                $response = Http::withToken($token)
                    ->acceptJson()
                    ->post("{$baseUrl}/api/v3/documents", $payload);

                $body = $response->json();
                $estadoSunat = $body['payload']['estado'] ?? null;

                if ($response->successful() && $estadoSunat === 'ACEPTADO') {
                    $document->update([
                        'estado' => 'aceptado',
                        'mensaje' => $body['message'] ?? null,
                        'hash' => $body['payload']['hash'] ?? null,
                        'xml_url' => $body['payload']['xml'] ?? null,
                        'cdr_url' => $body['payload']['cdr'] ?? null,
                        'pdf_ticket_url' => $body['payload']['pdf']['ticket'] ?? null,
                        'pdf_a4_url' => $body['payload']['pdf']['a4'] ?? null,
                    ]);
                } else {
                    $document->update([
                        'estado' => 'rechazado',
                        'mensaje' => $body['message'] ?? $response->body(),
                    ]);
                }
            } catch (\Throwable $exception) {
                $document->update([
                    'estado' => 'error',
                    'mensaje' => $exception->getMessage(),
                ]);
            }

            return $document->fresh();
        });
    }
}

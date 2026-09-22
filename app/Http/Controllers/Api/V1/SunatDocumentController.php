<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\SunatDocumentMail;
use App\Models\Quotation;
use App\Models\SunatDocument;
use App\Services\SunatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class SunatDocumentController extends Controller
{
    public function __construct(private readonly SunatService $sunatService)
    {
    }

    public function store(Quotation $quotation, Request $request): JsonResponse
    {
        $document = $this->sunatService->emit($quotation, $request->user());

        return response()->json($document, 201);
    }

    public function sendEmail(SunatDocument $sunatDocument, Request $request): JsonResponse
    {
        if ($sunatDocument->estado !== 'aceptado') {
            abort(422, 'Solo se puede enviar por correo un comprobante aceptado por SUNAT.');
        }

        $data = $request->validate(['email' => ['nullable', 'email']]);
        $email = $data['email'] ?? $sunatDocument->quotation->client->email;

        if (! $email) {
            abort(422, 'El cliente no tiene un correo registrado.');
        }

        Mail::to($email)->send(new SunatDocumentMail($sunatDocument->load('quotation.client')));

        return response()->json(['sent_to' => $email]);
    }
}

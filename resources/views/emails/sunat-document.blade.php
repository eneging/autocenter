<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; color: #0b0b0c; font-size: 14px; line-height: 1.6;">
    <p>Hola {{ $document->quotation->client->name }},</p>
    <p>
        Te compartimos tu {{ strtolower($tipoLabel) }} <strong>{{ $document->serie }}-{{ $document->numero }}</strong>
        de parte de {{ $company->company_name ?? config('app.name') }}.
    </p>
    <p>Puedes descargarla desde estos enlaces:</p>
    <p>
        @if ($document->pdf_a4_url)
            <a href="{{ $document->pdf_a4_url }}" style="color: #d71920; font-weight: bold;">Descargar PDF (A4)</a><br>
        @endif
        @if ($document->pdf_ticket_url)
            <a href="{{ $document->pdf_ticket_url }}" style="color: #d71920; font-weight: bold;">Descargar PDF (Ticket)</a><br>
        @endif
        @if ($document->xml_url)
            <a href="{{ $document->xml_url }}" style="color: #d71920; font-weight: bold;">Descargar XML</a><br>
        @endif
    </p>
    <p>Gracias por tu confianza.</p>
</body>
</html>

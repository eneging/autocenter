<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; color: #0b0b0c; font-size: 14px; line-height: 1.6;">
    <p>Hola {{ $quotation->client->name }},</p>
    <p>
        Adjuntamos tu cotizacion <strong>{{ $quotation->number }}</strong> por un total de
        S/ {{ number_format($quotation->total, 2) }}, de parte de {{ $company->company_name ?? config('app.name') }}.
    </p>
    <p>
        Cualquier consulta sobre esta cotizacion, respondenos a este mismo correo
        @if ($company->contact_phone)
            o escribenos al {{ $company->contact_phone }}
        @endif
        .
    </p>
    <p>Gracias por tu confianza.</p>
</body>
</html>

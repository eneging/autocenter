<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; color: #0b0b0c; font-size: 14px; line-height: 1.6;">
    <p>Hola {{ $entry->consumidor_nombre }},</p>
    <p>
        Hemos registrado tu {{ $entry->tipo === 'queja' ? 'queja' : 'reclamo' }} en el Libro de Reclamaciones
        con el numero <strong>{{ $entry->code }}</strong>, con fecha {{ $entry->created_at->format('d/m/Y') }}.
    </p>
    <p>
        Adjuntamos una copia de tu Hoja de Reclamacion en PDF. Te responderemos por este mismo correo
        en un plazo no mayor a quince (15) dias habiles, conforme al Reglamento del Libro de Reclamaciones.
    </p>
    <p>Gracias por tu confianza.</p>
</body>
</html>

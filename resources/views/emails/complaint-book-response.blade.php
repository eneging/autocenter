<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; color: #0b0b0c; font-size: 14px; line-height: 1.6;">
    <p>Hola {{ $entry->consumidor_nombre }},</p>
    <p>
        Esta es nuestra respuesta a tu {{ $entry->tipo === 'queja' ? 'queja' : 'reclamo' }}
        N {{ $entry->code }}, registrado el {{ $entry->created_at->format('d/m/Y') }}:
    </p>
    <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f7f7f5; border-left: 4px solid #d71920;">
        {!! nl2br(e($entry->respuesta_texto)) !!}
    </blockquote>
    <p>Adjuntamos la Hoja de Reclamacion completa en PDF, con esta respuesta incluida.</p>
    <p>Gracias por tu confianza.</p>
</body>
</html>

<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 30px 36px; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: 'Helvetica', Arial, sans-serif; font-size: 10.5px; color: #111111; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #111111; padding: 5px 8px; vertical-align: top; }

        .title-row td { border: 1.5px solid #111111; }
        .title-left { font-size: 15px; font-weight: bold; text-align: center; width: 62%; }
        .title-right { font-size: 11px; font-weight: bold; text-align: center; }
        .title-right .code { font-size: 10px; font-weight: normal; }

        .provider-row td { font-size: 10px; }
        .provider-name { font-weight: bold; }

        .section-head td { background: #fff4b8; font-weight: bold; font-size: 10.5px; text-transform: uppercase; }

        .label { display: block; font-weight: bold; font-size: 9px; text-transform: uppercase; color: #4b4b4b; margin-bottom: 4px; }
        .value { min-height: 14px; }

        .type-badge { display: inline-block; border: 1px solid #111111; padding: 2px 8px; font-weight: bold; margin-right: 6px; margin-top: 2px; }
        .type-badge.active { background: #0b0b0c; color: #fff; }

        .tall td { height: 70px; }
        .signature-cell { text-align: center; font-weight: bold; font-size: 9px; }
        .signature-note { font-size: 8.5px; font-weight: normal; color: #4b4b4b; margin-top: 4px; }

        .footnotes { margin-top: 10px; font-size: 8.5px; color: #333333; line-height: 1.5; }
        .footnotes strong { color: #111111; }
    </style>
</head>
<body>
    <table class="title-row">
        <tr>
            <td class="title-left">LIBRO DE RECLAMACIONES</td>
            <td class="title-right">
                HOJA DE RECLAMACION<br>
                <span class="code">N {{ $entry->code }}</span>
            </td>
        </tr>
    </table>
    <table class="provider-row">
        <tr>
            <td style="width: 50%;">
                <span class="label">Fecha</span>
                {{ $entry->created_at->format('d/m/Y') }}
            </td>
            <td>
                <span class="label">Plazo legal de respuesta (15 dias habiles, improrrogable)</span>
                {{ $entry->plazo_respuesta->format('d/m/Y') }}
            </td>
        </tr>
        <tr>
            <td colspan="2">
                <span class="provider-name">{{ $company->company_name ?? config('app.name') }}</span>
                @if($company->company_ruc) &middot; RUC {{ $company->company_ruc }} @endif
                <br>
                {{ $company->contact_address ?? 'Peru' }} &middot; Libro de Reclamaciones de naturaleza virtual
            </td>
        </tr>
    </table>

    <table>
        <tr class="section-head"><td colspan="2">1. Identificacion del consumidor reclamante</td></tr>
        <tr>
            <td colspan="2"><span class="label">Nombre</span><div class="value">{{ $entry->consumidor_nombre }}</div></td>
        </tr>
        <tr>
            <td colspan="2"><span class="label">Domicilio</span><div class="value">{{ $entry->consumidor_domicilio }}</div></td>
        </tr>
        <tr>
            <td style="width: 50%;"><span class="label">DNI / CE</span><div class="value">{{ $entry->consumidor_documento }}</div></td>
            <td><span class="label">Telefono / E-mail</span><div class="value">{{ $entry->consumidor_telefono ? $entry->consumidor_telefono.' / ' : '' }}{{ $entry->consumidor_email }}</div></td>
        </tr>
        @if($entry->es_menor)
        <tr>
            <td colspan="2"><span class="label">Padre o madre (consumidor menor de edad)</span><div class="value">{{ $entry->representante_nombre }}</div></td>
        </tr>
        @endif
    </table>

    <table>
        <tr class="section-head"><td colspan="2">2. Identificacion del bien contratado</td></tr>
        <tr>
            <td style="width: 50%;">
                <span class="label">Tipo</span>
                <span class="type-badge {{ $entry->bien_tipo === 'producto' ? 'active' : '' }}">PRODUCTO</span>
                <span class="type-badge {{ $entry->bien_tipo === 'servicio' ? 'active' : '' }}">SERVICIO</span>
            </td>
            <td><span class="label">Monto reclamado</span><div class="value">{{ $entry->monto_reclamado ? 'S/ '.number_format((float) $entry->monto_reclamado, 2) : 'No aplica' }}</div></td>
        </tr>
        <tr>
            <td colspan="2"><span class="label">Descripcion</span><div class="value">{{ $entry->bien_descripcion }}</div></td>
        </tr>
    </table>

    <table>
        <tr class="section-head">
            <td style="width: 62%;">3. Detalle de la reclamacion y pedido del consumidor</td>
            <td>
                <span class="type-badge {{ $entry->tipo === 'reclamo' ? 'active' : '' }}">RECLAMO</span>
                <span class="type-badge {{ $entry->tipo === 'queja' ? 'active' : '' }}">QUEJA</span>
            </td>
        </tr>
        <tr class="tall">
            <td colspan="2"><span class="label">Detalle</span><div class="value">{{ $entry->detalle }}</div></td>
        </tr>
        <tr class="tall">
            <td colspan="2"><span class="label">Pedido</span><div class="value">{{ $entry->pedido }}</div></td>
        </tr>
        <tr>
            <td colspan="2" class="signature-cell">
                FIRMA DEL CONSUMIDOR
                <div class="signature-note">
                    Registrado y aceptado electronicamente por el consumidor el
                    {{ $entry->consumidor_acepta_at->format('d/m/Y H:i') }} (IP {{ $entry->consumidor_ip ?? 'no disponible' }}),
                    en reemplazo de firma manuscrita conforme al Art. 5 del Reglamento del Libro de Reclamaciones.
                </div>
            </td>
        </tr>
    </table>

    <table>
        <tr class="section-head"><td colspan="2">4. Observaciones y acciones adoptadas por el proveedor</td></tr>
        <tr>
            <td colspan="2">
                <span class="label">Fecha de comunicacion de la respuesta</span>
                <div class="value">{{ $entry->respuesta_fecha?->format('d/m/Y') ?? 'Pendiente de respuesta' }}</div>
            </td>
        </tr>
        <tr class="tall">
            <td colspan="2"><div class="value">{{ $entry->respuesta_texto ?? '' }}</div></td>
        </tr>
        <tr>
            <td colspan="2" class="signature-cell">
                FIRMA DEL PROVEEDOR
                @if($entry->respuesta_fecha)
                    <div class="signature-note">
                        {{ $company->manager_name ?? $company->company_name }}{{ $company->manager_title ? ' - '.$company->manager_title : '' }}
                        &middot; Firmado electronicamente el {{ $entry->respuesta_fecha->format('d/m/Y') }}
                    </div>
                @endif
            </td>
        </tr>
    </table>

    <div class="footnotes">
        <strong>RECLAMO:</strong> disconformidad relacionada a los productos o servicios.
        <strong>QUEJA:</strong> disconformidad no relacionada a los productos o servicios, o malestar respecto a la atencion al publico.<br>
        La formulacion del reclamo no impide acudir a otras vias de solucion de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.<br>
        El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a quince (15) dias habiles, el cual es improrrogable (Reglamento del Libro de Reclamaciones, Decreto Supremo N 011-2011-PCM, modificado por el Decreto Supremo N 101-2022-PCM).
    </div>
</body>
</html>

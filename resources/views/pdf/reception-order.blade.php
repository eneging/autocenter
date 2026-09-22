<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; line-height: 1.45; color: #0b0b0c; }
        table { width: 100%; border-collapse: collapse; }
        .content-page { padding: 26px 34px; }

        .header-table td { vertical-align: middle; }
        .brand-logo { width: 42px; height: 42px; border-radius: 8px; margin-right: 8px; }
        .brand-name { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
        .brand-tagline { font-size: 9px; color: #4b5563; }
        .brand-address { text-align: right; font-size: 9px; color: #4b5563; }
        .doc-title { margin-top: 10px; padding: 6px 0; background: #0b0b0c; color: #fff; text-align: center; font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }

        h2.section-title { margin: 14px 0 6px; padding: 4px 8px; background: #fff4b8; border-left: 4px solid #d71920; font-size: 10.5px; text-transform: uppercase; font-weight: bold; }

        .info-table td { padding: 3px 6px 3px 0; vertical-align: top; }
        .info-table .label { color: #4b5563; width: 90px; }
        .info-grid { width: 100%; }
        .info-grid td { width: 33%; padding: 3px 8px 3px 0; }

        .box { border: 1px solid #dddddd; padding: 8px; min-height: 40px; }

        .check-grid { width: 100%; }
        .check-grid td { width: 33.33%; padding: 2px 6px 2px 0; font-size: 9.5px; vertical-align: top; }
        /* Dibujado con CSS en vez de un glifo Unicode: la fuente de DomPDF no trae los símbolos ☑/☐. */
        .check-mark { display: inline-block; width: 8px; height: 8px; margin-right: 4px; border: 1px solid #0b0b0c; vertical-align: middle; }
        .check-yes .check-mark { background: #0b0b0c; }
        .check-no .check-mark { background: transparent; }

        .level-table td { padding: 3px 8px 3px 0; font-size: 9.5px; }
        .level-badge { display: inline-block; padding: 1px 6px; border: 1px solid #0b0b0c; border-radius: 3px; font-weight: bold; }
        .level-bad { background: #d71920; color: #fff; border-color: #d71920; }

        .damage-table td { padding: 3px 6px; border-bottom: 1px solid #eee; font-size: 9.5px; }
        .damage-none { color: #4b5563; }
        .damage-yes { color: #d71920; font-weight: bold; }

        .auth-list { margin: 4px 0; padding: 0; list-style: none; font-size: 9.5px; }
        .auth-list li { margin-bottom: 3px; }

        .legal-text { margin-top: 10px; font-size: 8.5px; color: #4b5563; }
        .legal-text p { margin: 3px 0; }

        .signature-row { width: 100%; margin-top: 14px; }
        .signature-col { width: 50%; text-align: center; padding: 0 20px; vertical-align: top; }
        .signature-line { border-top: 1px solid #0b0b0c; padding-top: 4px; margin: 0 10px; font-size: 9px; }
        .qr-col { width: 90px; text-align: center; vertical-align: top; }
        .qr-col svg { width: 80px; height: 80px; }
        .qr-col small { display: block; font-size: 7.5px; color: #4b5563; }
    </style>
</head>
<body>
<div class="content-page">
    <table class="header-table">
        <tr>
            <td style="width: 46px;">
                @if(config('taller.logo_url'))<img class="brand-logo" src="{{ config('taller.logo_url') }}" alt="">@endif
            </td>
            <td>
                <div class="brand-name">{{ $company->company_name ?? config('app.name') }}</div>
                <div class="brand-tagline">{{ $company->project_role ?? 'Mecánica y mantenimiento automotriz' }}</div>
            </td>
            <td class="brand-address">{{ $company->contact_address }}<br>{{ $company->contact_phone }}</td>
        </tr>
    </table>

    <div class="doc-title">Orden de servicio</div>

    <table class="info-grid" style="margin-top: 10px;">
        <tr>
            <td style="width: 60%">
                <h2 class="section-title">Datos del cliente</h2>
                <table class="info-table">
                    <tr><td class="label">Nombre</td><td>{{ $project->client->name }}</td></tr>
                    <tr><td class="label">Dirección</td><td>{{ $project->client->address ?: '—' }}</td></tr>
                    <tr><td class="label">Teléfono</td><td>{{ $project->client->phone }}</td></tr>
                    <tr><td class="label">Documento</td><td>{{ $project->client->document_type === '6' ? 'RUC' : 'DNI' }} {{ $project->client->document_number }}</td></tr>
                </table>
            </td>
            <td style="width: 40%">
                <h2 class="section-title">Datos de la orden</h2>
                <table class="info-table">
                    <tr><td class="label">N.° de orden</td><td><strong>{{ $project->code }}</strong></td></tr>
                    <tr><td class="label">Fecha de ingreso</td><td>{{ optional($project->starts_at)->format('d/m/Y') }}</td></tr>
                    <tr><td class="label">Fecha de entrega</td><td>{{ optional($project->estimated_delivery_at)->format('d/m/Y') ?: '—' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>

    <h2 class="section-title">Datos del vehículo</h2>
    <table class="info-grid">
        <tr>
            <td>Marca: <strong>{{ $project->vehicle->brand ?? '—' }}</strong></td>
            <td>Modelo: <strong>{{ $project->vehicle->model ?? '—' }}</strong></td>
            <td>Año: <strong>{{ $project->vehicle->year ?? '—' }}</strong></td>
        </tr>
        <tr>
            <td>Color: <strong>{{ $project->vehicle->color ?? '—' }}</strong></td>
            <td>Placa: <strong>{{ $project->vehicle->plate ?? '—' }}</strong></td>
            <td>VIN / Serie: <strong>{{ $project->vehicle->vin ?? '—' }}</strong></td>
        </tr>
        <tr>
            <td>Kilometraje: <strong>{{ $project->mileage ? number_format($project->mileage, 0, ',', '.').' km' : '—' }}</strong></td>
            <td>Combustible: <strong>{{ $project->fuel_level ?? '—' }}</strong></td>
            <td>N.° de motor: <strong>{{ $project->vehicle->engine_number ?? '—' }}</strong></td>
        </tr>
    </table>

    <h2 class="section-title">Descripción de falla</h2>
    <div class="box">{{ $project->problem_description }}</div>

    @php($checklist = $project->reception_checklist ?? [])
    <h2 class="section-title">Recepción del vehículo</h2>

    <table class="check-grid">
        @foreach(array_chunk(config('taller.reception.exterior_items'), 3) as $row)
            <tr>
                @foreach($row as $item)
                    @php($present = data_get($checklist, "exterior.$item", true))
                    <td class="{{ $present ? 'check-yes' : 'check-no' }}"><span class="check-mark"></span> {{ $item }}</td>
                @endforeach
            </tr>
        @endforeach
    </table>

    <table class="check-grid" style="margin-top: 6px;">
        @foreach(array_chunk(config('taller.reception.tool_items'), 3) as $row)
            <tr>
                @foreach($row as $item)
                    @php($present = data_get($checklist, "tools.$item", true))
                    <td class="{{ $present ? 'check-yes' : 'check-no' }}"><span class="check-mark"></span> {{ $item }}</td>
                @endforeach
            </tr>
        @endforeach
    </table>

    <table class="level-table" style="margin-top: 6px;">
        <tr>
            @foreach(config('taller.reception.level_items') as $item)
                @php($value = data_get($checklist, "levels.$item", 'Bueno'))
                <td>{{ $item }}: <span class="level-badge {{ $value === 'Malo' ? 'level-bad' : '' }}">{{ $value }}</span></td>
            @endforeach
        </tr>
    </table>

    <table class="damage-table" style="margin-top: 4px;">
        <tr><td colspan="2"><strong>Daños visibles</strong></td></tr>
        @foreach(config('taller.reception.damage_zones') as $zone)
            @php($damage = data_get($checklist, "damages.$zone", ['has_damage' => false, 'note' => '']))
            <tr>
                <td style="width: 140px;">{{ $zone }}</td>
                <td class="{{ !empty($damage['has_damage']) ? 'damage-yes' : 'damage-none' }}">
                    {{ !empty($damage['has_damage']) ? ($damage['note'] ?: 'Con daños') : 'Sin daños visibles' }}
                </td>
            </tr>
        @endforeach
    </table>

    <h2 class="section-title">Autorizaciones del cliente</h2>
    <ul class="auth-list">
        <li class="{{ $project->client_requests_prior_budget ? 'check-yes' : 'check-no' }}"><span class="check-mark"></span> Solicito presupuesto previo antes de autorizar el trabajo</li>
        <li class="{{ $project->client_authorizes_repair_without_budget ? 'check-yes' : 'check-no' }}"><span class="check-mark"></span> Autorizo realizar la reparación sin presupuesto previo</li>
        <li class="{{ $project->client_authorizes_test_drive ? 'check-yes' : 'check-no' }}"><span class="check-mark"></span> Autorizo conducir mi vehículo para pruebas</li>
        <li class="{{ $project->client_accepted_terms_at ? 'check-yes' : 'check-no' }}"><span class="check-mark"></span> Acepto las condiciones expresamente indicadas en esta orden de servicio</li>
    </ul>

    <div class="legal-text">
        <p>{{ config('taller.reception.liability_text') }}</p>
        <p>El cliente se compromete a recoger su vehículo dentro de las {{ config('taller.reception.pickup_hours') }} horas posteriores a la notificación de servicio concluido. Pasado dicho plazo, {{ $company->company_name ?? config('app.name') }} aplicará un cargo diario por almacenaje de S/ {{ number_format(config('taller.reception.storage_fee_per_day'), 2) }} por ocupar espacio operativo en el taller.</p>
    </div>

    <table class="signature-row">
        <tr>
            <td class="signature-col">
                <div class="signature-line">Firma del cliente<br>{{ $project->client->name }}</div>
            </td>
            <td class="signature-col">
                <div class="signature-line">Recibido por<br>{{ $project->responsible->name ?? config('app.name') }}</div>
            </td>
            <td class="qr-col">
                {!! $qr !!}
                <small>Sigue tu vehículo aquí</small>
            </td>
        </tr>
    </table>
</div>
</body>
</html>

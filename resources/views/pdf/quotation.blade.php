<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 0; }

        * { box-sizing: border-box; }

        html, body { margin: 0; padding: 0; }

        body {
            font-family: 'Helvetica', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #0b0b0c;
        }

        table { width: 100%; border-collapse: collapse; }
        .page-break { page-break-after: always; }

        /* Las paginas de contenido simulan el margen de pagina con padding,
           porque DomPDF no aisla bien el margen por pagina (@page :first o
           paginas nombradas terminan afectando a todo el documento). */
        .content-page { padding-top: 30px; padding-right: 40px; padding-bottom: 30px; padding-left: 40px; }

        /* ---- Portada ---- */
        .cover-page {
            width: 100%;
            height: 1122px;
            background: #0b0b0c;
            text-align: center;
        }
        .cover-inner { padding-top: 251px; }
        .cover-logo { width: 620px; }

        /* ---- Header comun ---- */
        .header-table td { vertical-align: middle; }
        .brand-logo { width: 46px; height: 46px; border-radius: 8px; margin-right:8px }
        .brand-name { font-size: 16px; font-weight: bold; color: #0b0b0c; letter-spacing: 2px; }
        .brand-role {
            text-align: right;
            font-size: 10px;
            font-weight: bold;
            color: #d71920;
            text-decoration: underline;
            text-transform: uppercase;
        }
        .doc-title {
            margin-top: 18px;
            font-size: 24px;
            font-weight: bold;
            text-transform: uppercase;
            text-decoration: underline;
            color: #0b0b0c;
            text-align: center;
        }
        .doc-date { text-align: right; font-size: 10.5px; color: #4b5563; }

        /* ---- Cliente ---- */
        .client-block { margin-top: 18px; font-style: italic; }
        .client-name { font-weight: bold; font-size: 12px; }
        .greeting { margin-top: 16px; }
        .greeting strong { color: #0b0b0c; }

        /* ---- Tabla de items ---- */
        .items-table { margin-top: 16px; border: 1px solid #dddddd; }
        .items-table thead th {
            background: #0b0b0c;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            padding: 8px 10px;
            text-align: center;
        }
        .items-table .section-row td {
            background: #fff4b8;
            font-weight: bold;
            text-align: center;
            padding: 5px;
            font-size: 10.5px;
            text-transform: uppercase;
        }
        .items-table tbody td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 10.5px;
            vertical-align: top;
        }
        .items-table tbody tr:nth-child(even) td { background: #f7f7f5; }
        .item-index { width: 26px; text-align: center; font-weight: bold; }
        .item-title { font-weight: bold; margin: 0 0 4px; }
        .item-bullets { margin: 0; padding-left: 14px; }
        .item-bullets li { margin-bottom: 2px; }
        .item-cost { width: 90px; text-align: right; font-style: italic; white-space: nowrap; }
        .extra-row td { background: #f7f7f5; font-size: 10px; }
        .extra-bullets { margin: 0; padding-left: 14px; }
        .total-row td {
            font-weight: bold;
            font-style: italic;
            background: #fff4b8;
            text-align: right;
            padding: 8px 10px;
        }
        .total-row .total-label { text-align: left; }

        /* ---- Pie de pagina ---- */
        .footer { margin-top: 22px; border-top: 2px solid #0b0b0c; padding-top: 8px; }
        .footer-table td { font-size: 9.5px; color: #4b5563; text-align: center; vertical-align: middle; }
        .footer-brand { text-align: left; font-weight: bold; color: #0b0b0c; }
        .footer-social img { width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; }
        .footer-social span { vertical-align: middle; }
        .footer-contact { text-align: right; }
        .footer-contact img { width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; }
        .footer-contact span { vertical-align: middle; }

        /* ---- Pagina de pago ---- */
        .payment-section { margin-top: 20px; }
        .payment-section h3 {
            font-size: 11px;
            text-transform: uppercase;
            color: #0b0b0c;
            margin: 16px 0 6px;
        }
        .payment-line { margin: 3px 0; }
        .payment-line strong { color: #0b0b0c; }
        .terms-block { margin-top: 18px; }
        .terms-block .term-title { font-weight: bold; font-style: italic; margin-top: 10px; }
        .signature-block { margin-top: 70px; text-align: center; }
        .signature-name { font-weight: bold; font-style: italic; }
        .signature-title { font-size: 10px; color: #4b5563; }

        /* ---- Firmas de contrato ---- */
        .signatures-table { width: 100%; margin-top: 70px; }
        .signature-col { width: 50%; text-align: center; padding: 0 20px; vertical-align: top; }
        .signature-line { border-top: 1px solid #0b0b0c; padding-top: 6px; margin: 0 16px; }
    </style>
</head>
<body>
    {{-- Portada --}}
    <div class="cover-page page-break">
        <div class="cover-inner">
            @if(config('taller.logo_url'))<img class="cover-logo" src="{{ config('taller.logo_url') }}" alt="{{ $company->company_name ?? config('app.name') }}">@endif
        </div>
    </div>

    {{-- Cotizacion --}}
    <div class="page-break content-page">
        <table class="header-table">
            <tr>
                <td style="width: 46px;">
                    @if(config('taller.logo_url'))<img class="brand-logo" src="{{ config('taller.logo_url') }}" alt="">@endif
                </td>
                <td><span class="brand-name">{{ $company->company_name ?? config('app.name') }}</span></td>
                <td class="brand-role">{{ $company->project_role ?? 'Taller mecánico y eléctrico automotriz' }}</td>
            </tr>
        </table>

        <div class="doc-title">{{ ($asContract ?? false) ? 'Contrato' : 'Cotización' }}</div>
        <div class="doc-date">{{ optional($quotation->issue_date?->locale('es'))->translatedFormat('l, d \d\e F \d\e\l Y') }}</div>

        <div class="client-block">
            <div class="client-name">{{ mb_strtoupper($quotation->client->name, 'UTF-8') }}</div>
            @if ($quotation->client->document_number)
                <div>{{ $quotation->client->document_type === '6' ? 'RUC' : 'DNI' }}: {{ $quotation->client->document_number }}</div>
            @elseif ($quotation->client->document)
                <div>{{ $quotation->client->document }}</div>
            @endif
        </div>

        <p class="greeting">
            Reciba el más cordial saludo a nombre de la empresa <strong>{{ $company->company_name ?? config('app.name') }}</strong>,
            profesionales en {{ mb_strtolower($company->project_role ?? 'taller mecánico y eléctrico automotriz', 'UTF-8') }}.
        </p>
        <p>A continuación, se detalla lo solicitado por el cliente:</p>

        <table class="items-table">
            <thead>
                <tr>
                    <th colspan="2">Descripción</th>
                    <th>Costo</th>
                </tr>
            </thead>
            <tbody>
                <tr class="section-row"><td colspan="3">Áreas a detalle</td></tr>
                @foreach ($quotation->items as $index => $item)
                    <tr>
                        <td class="item-index">{{ str_pad($index + 1, 2, '0', STR_PAD_LEFT) }}</td>
                        <td>
                            @if ($item->title)
                                <p class="item-title">{{ mb_strtoupper($item->title, 'UTF-8') }}</p>
                            @endif
                            @if ($item->description)
                                <ul class="item-bullets">
                                    @foreach (preg_split('/\r\n|\r|\n/', trim($item->description)) as $line)
                                        @if (trim($line) !== '')
                                            <li>{{ trim($line) }}</li>
                                        @endif
                                    @endforeach
                                </ul>
                            @endif
                        </td>
                        <td class="item-cost">S/ {{ number_format($item->subtotal, 2) }}</td>
                    </tr>
                @endforeach
                <tr class="extra-row">
                    <td class="item-index">*</td>
                    <td>
                        <ul class="extra-bullets">
                            @if ($quotation->extra_terms)
                                @foreach (preg_split('/\r\n|\r|\n/', trim($quotation->extra_terms)) as $line)
                                    @if (trim($line) !== '')
                                        <li>{{ trim($line) }}</li>
                                    @endif
                                @endforeach
                            @endif
                            <li>Tiempo de entrega {{ $quotation->delivery_time ?? 'a definir' }}</li>
                        </ul>
                    </td>
                    <td></td>
                </tr>
                @if ($quotation->includes_igv)
                    <tr class="extra-row">
                        <td></td>
                        <td class="total-label">Subtotal</td>
                        <td class="item-cost">S/ {{ number_format($quotation->subtotal, 2) }}</td>
                    </tr>
                    <tr class="extra-row">
                        <td></td>
                        <td class="total-label">IGV (18%)</td>
                        <td class="item-cost">S/ {{ number_format($quotation->igv, 2) }}</td>
                    </tr>
                @endif
                <tr class="total-row">
                    <td colspan="2" class="total-label">Total{!! $quotation->includes_igv ? '' : ' (no incluye IGV)' !!}</td>
                    <td>S/ {{ number_format($quotation->total, 2) }}</td>
                </tr>
            </tbody>
        </table>

        @include('pdf.partials.quotation-footer')
    </div>

    {{-- Pago y firma --}}
    <div class="content-page">
        <table class="header-table">
            <tr>
                <td style="width: 46px;">
                    @if(config('taller.logo_url'))<img class="brand-logo" src="{{ config('taller.logo_url') }}" alt="">@endif
                </td>
                <td><span class="brand-name">{{ $company->company_name ?? config('app.name') }}</span></td>
                <td class="brand-role">{{ $company->project_role ?? 'Taller mecánico y eléctrico automotriz' }}</td>
            </tr>
        </table>

        <div class="payment-section">
            <p>El medio de pago será acordado entre ambas partes, teniendo como las siguientes:</p>

            <p class="payment-line"><strong>Efectivo</strong> (SOLES) previa coordinación</p>
            @if ($company->yape_number)
                <p class="payment-line"><strong>Depósito - YAPE</strong> - {{ $company->yape_number }} a nombre de {{ $company->yape_holder_name ?? $company->manager_name }}</p>
            @endif
            @if ($company->bank_bcp_account)
                <p class="payment-line"><strong>Transferencia interbancaria</strong> a nombre de {{ $company->manager_name ?? $company->company_name }}</p>
                <p class="payment-line">Cuenta BCP Soles: {{ $company->bank_bcp_account }}</p>
            @endif
            @if ($company->bank_cci_account)
                <p class="payment-line">Cuenta interbancaria (CCI): {{ $company->bank_cci_account }}</p>
            @endif

            @php
                $advancePct = $quotation->advance_percentage ?? 50;
                $advanceAmount = round($quotation->total * $advancePct / 100, 2);
                $balanceAmount = round($quotation->total - $advanceAmount, 2);
            @endphp

            <div class="terms-block">
                <p>La forma de pago será de la siguiente manera:</p>
                <p class="term-title">- ADELANTO:</p>
                <p>Del {{ $advancePct }}%, por la suma de S/ {{ number_format($advanceAmount, 2) }}
                    ({{ \App\Support\NumberToWords::soles($advanceAmount) }}), una vez firmado el contrato.</p>
                <p class="term-title">- SALDO:</p>
                <p>Del {{ 100 - $advancePct }}%, por la suma de S/ {{ number_format($balanceAmount, 2) }}
                    ({{ \App\Support\NumberToWords::soles($balanceAmount) }}), una vez terminado el trabajo.</p>
            </div>

            @if ($asContract ?? false)
                <table class="signatures-table">
                    <tr>
                        <td class="signature-col">
                            <div class="signature-line">
                                <div class="signature-name">{{ $company->manager_name ?? $company->company_name }}</div>
                                <div class="signature-title">{{ $company->manager_title ?? 'Gerente General' }}<br>{{ $company->company_name ?? config('app.name') }}</div>
                            </div>
                        </td>
                        <td class="signature-col">
                            <div class="signature-line">
                                <div class="signature-name">{{ mb_strtoupper($quotation->client->name, 'UTF-8') }}</div>
                                <div class="signature-title">
                                    @if ($quotation->client->document_number)
                                        {{ $quotation->client->document_type === '6' ? 'RUC' : 'DNI' }}: {{ $quotation->client->document_number }}
                                    @elseif ($quotation->client->document)
                                        {{ $quotation->client->document }}
                                    @else
                                        DNI: _______________
                                    @endif
                                </div>
                            </div>
                        </td>
                    </tr>
                </table>
            @else
                <div class="signature-block">
                    <div class="signature-name">{{ $company->manager_name ?? $company->company_name }}</div>
                    <div class="signature-title">{{ $company->manager_title ?? 'Gerente General' }}</div>
                </div>
            @endif
        </div>

        @include('pdf.partials.quotation-footer')
    </div>
</body>
</html>

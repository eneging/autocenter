<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }

        body {
            font-family: 'Helvetica', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #0b0b0c;
        }

        .content-page { padding: 30px 40px; }

        table { width: 100%; border-collapse: collapse; }

        .header-table td { vertical-align: middle; }
        .brand-logo { width: 46px; height: 46px; border-radius: 8px; }
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
            margin-top: 20px;
            font-size: 22px;
            font-weight: bold;
            text-transform: uppercase;
            color: #0b0b0c;
        }
        .doc-period { margin-top: 4px; font-size: 11px; color: #4b5563; }

        .section-title {
            margin-top: 22px;
            padding: 7px 10px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            color: #ffffff;
        }
        .section-income { background: #0b0b0c; }
        .section-expense { background: #d71920; }

        .statement-table { margin-top: 0; border: 1px solid #dddddd; }
        .statement-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 10.5px;
        }
        .statement-table tr:nth-child(even) td { background: #f7f7f5; }
        .amount-col { width: 130px; text-align: right; white-space: nowrap; }

        .subtotal-row td {
            font-weight: bold;
            font-style: italic;
            background: #fff4b8 !important;
        }

        .net-result-table { margin-top: 22px; }
        .net-result-table td {
            padding: 14px 16px;
            font-size: 14px;
            font-weight: bold;
        }
        .net-result-label { background: #0b0b0c; color: #ffffff; text-transform: uppercase; }
        .net-result-amount { background: #fff4b8; color: #0b0b0c; text-align: right; }
        .net-result-negative .net-result-amount { background: #f9e5e3; color: #d71920; }

        .footer { margin-top: 30px; border-top: 2px solid #0b0b0c; padding-top: 8px; font-size: 9.5px; color: #4b5563; }
    </style>
</head>
<body>
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

        <div class="doc-title">Estado de Resultados</div>
        <div class="doc-period">
            Periodo: {{ \Carbon\Carbon::parse($statement['from'])->locale('es')->translatedFormat('d \d\e F \d\e Y') }}
            al {{ \Carbon\Carbon::parse($statement['to'])->locale('es')->translatedFormat('d \d\e F \d\e Y') }}
        </div>

        <div class="section-title section-income">Ingresos</div>
        <table class="statement-table">
            <tr>
                <td>Ingresos cobrados (cotizaciones)</td>
                <td class="amount-col">S/ {{ number_format($statement['income_total'], 2) }}</td>
            </tr>
            <tr class="subtotal-row">
                <td>Total ingresos</td>
                <td class="amount-col">S/ {{ number_format($statement['income_total'], 2) }}</td>
            </tr>
        </table>

        <div class="section-title section-expense">Gastos</div>
        <table class="statement-table">
            <tr>
                <td>Mano de obra</td>
                <td class="amount-col">S/ {{ number_format($statement['labor_total'], 2) }}</td>
            </tr>
            @foreach ($statement['expenses_by_category'] as $row)
                <tr>
                    <td>{{ $row['category'] }}</td>
                    <td class="amount-col">S/ {{ number_format($row['total'], 2) }}</td>
                </tr>
            @endforeach
            <tr class="subtotal-row">
                <td>Total gastos</td>
                <td class="amount-col">S/ {{ number_format($statement['total_outflow'], 2) }}</td>
            </tr>
        </table>

        <table class="net-result-table {{ $statement['net_result'] < 0 ? 'net-result-negative' : '' }}">
            <tr>
                <td class="net-result-label">Utilidad neta del periodo</td>
                <td class="net-result-amount">S/ {{ number_format($statement['net_result'], 2) }}</td>
            </tr>
        </table>

        <div class="footer">
            Generado el {{ \Carbon\Carbon::now()->locale('es')->translatedFormat('d \d\e F \d\e Y, H:i') }}
            — {{ $company->company_name ?? config('app.name') }}
            @if ($company->company_ruc)
                · RUC {{ $company->company_ruc }}
            @endif
        </div>
    </div>
</body>
</html>

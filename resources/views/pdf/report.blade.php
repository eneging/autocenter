<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: 'Helvetica', Arial, sans-serif; font-size: 10.5px; line-height: 1.45; color: #0b0b0c; }
        .page { padding: 28px 36px; }
        table { width: 100%; border-collapse: collapse; }
        .brand { font-size: 16px; font-weight: bold; color: #111827; letter-spacing: 1px; }
        .muted { color: #6b7280; font-size: 10px; }
        h1 { margin: 16px 0 2px; padding-bottom: 6px; font-size: 20px; text-transform: uppercase; border-bottom: 5px solid #ffd400; }
        h2 { margin: 20px 0 6px; padding: 6px 9px; font-size: 11px; text-transform: uppercase; color: #fff; background: #0b0b0c; }
        th { text-align: left; padding: 6px 8px; font-size: 9.5px; text-transform: uppercase; background: #e5e7eb; border-bottom: 1px solid #d1d5db; }
        td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
        .num { text-align: right; white-space: nowrap; }
        .total td { font-weight: bold; background: #f3f4f6; }
        .kpis td { width: 25%; padding: 10px; border: 1px solid #d1d5db; text-align: center; }
        .kpis .v { display: block; font-size: 15px; font-weight: bold; }
        .neg { color: #b91c1c; }
        .pos { color: #0b0b0c; }
        .footer { margin-top: 22px; padding-top: 6px; border-top: 1px solid #d1d5db; font-size: 9px; color: #6b7280; }
    </style>
</head>
<body>
@php
    $s = $report['summary'];
    $money = fn ($v) => 'S/ '.number_format((float) $v, 2);
@endphp
<div class="page">
    <table>
        <tr>
            <td><span class="brand">{{ $company->company_name ?: config('app.name') }}</span>
                @if($company->company_ruc)<br><span class="muted">RUC {{ $company->company_ruc }}</span>@endif</td>
            <td class="num muted">Generado {{ now()->format('d/m/Y H:i') }}</td>
        </tr>
    </table>

    <h1>{{ $report['title'] }}</h1>
    <div class="muted">Del {{ \Illuminate\Support\Carbon::parse($report['from'])->format('d/m/Y') }} al {{ \Illuminate\Support\Carbon::parse($report['to'])->format('d/m/Y') }}</div>

    <table class="kpis" style="margin-top:14px">
        <tr>
            <td>Ingresos<span class="v">{{ $money($s['income_total']) }}</span></td>
            <td>Egresos<span class="v">{{ $money($s['expenses_total']) }}</span></td>
            <td>Resultado neto<span class="v {{ $s['net_result'] < 0 ? 'neg' : 'pos' }}">{{ $money($s['net_result']) }}</span></td>
            <td>IGV en ingresos (18%)<span class="v">{{ $money($s['igv_income']) }}</span></td>
        </tr>
    </table>

    <h2>Ingresos por método de pago</h2>
    <table>
        <tr><th>Método</th><th class="num">Monto</th></tr>
        @foreach($s['income_by_method'] as $method => $amount)
            <tr><td>{{ $method }}</td><td class="num">{{ $money($amount) }}</td></tr>
        @endforeach
        <tr class="total"><td>Total ingresos</td><td class="num">{{ $money($s['income_total']) }}</td></tr>
    </table>

    <h2>Egresos</h2>
    <table>
        <tr><th>Categoría</th><th class="num">Monto</th></tr>
        @forelse($s['expenses_by_category'] as $category => $amount)
            <tr><td>{{ $category }}</td><td class="num">{{ $money($amount) }}</td></tr>
        @empty
            <tr><td colspan="2" class="muted">Sin egresos en el período.</td></tr>
        @endforelse
        <tr><td>Gastos fijos</td><td class="num">{{ $money($s['fixed_expenses_total']) }}</td></tr>
        <tr><td>Gastos variables</td><td class="num">{{ $money($s['variable_expenses_total']) }}</td></tr>
        <tr class="total"><td>Total egresos</td><td class="num">{{ $money($s['expenses_total']) }}</td></tr>
    </table>

    @if(count($report['daily']) > 1)
        <h2>Detalle por día</h2>
        <table>
            <tr><th>Fecha</th><th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Neto</th></tr>
            @foreach($report['daily'] as $day)
                <tr>
                    <td>{{ \Illuminate\Support\Carbon::parse($day['date'])->format('d/m/Y') }}</td>
                    <td class="num">{{ $money($day['income']) }}</td>
                    <td class="num">{{ $money($day['expenses']) }}</td>
                    <td class="num">{{ $money($day['net']) }}</td>
                </tr>
            @endforeach
        </table>
    @endif

    @if(count($report['commissions']))
        <h2>Comisiones de técnicos</h2>
        <table>
            <tr><th>Técnico</th><th class="num">Órdenes</th><th class="num">Generado</th><th class="num">Comisión</th></tr>
            @foreach($report['commissions'] as $row)
                <tr>
                    <td>{{ $row['worker_name'] }}</td>
                    <td class="num">{{ $row['orders'] }}</td>
                    <td class="num">{{ $money($row['generated']) }}</td>
                    <td class="num">{{ $money($row['commission']) }}</td>
                </tr>
            @endforeach
        </table>
    @endif

    <h2>Movimientos ({{ count($report['transactions']) }})</h2>
    <table>
        <tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Método</th><th>Orden</th><th class="num">Monto</th></tr>
        @foreach($report['transactions'] as $t)
            <tr>
                <td>{{ \Illuminate\Support\Carbon::parse($t['date'])->format('d/m') }}</td>
                <td>{{ $t['type'] }}</td>
                <td>{{ $t['category'] }}</td>
                <td>{{ $t['payment_method'] ?? '—' }}</td>
                <td>{{ $t['order'] ?? '—' }}</td>
                <td class="num {{ $t['type'] === 'Ingreso' ? 'pos' : 'neg' }}">{{ $t['type'] === 'Ingreso' ? '' : '-' }}{{ $money($t['amount']) }}</td>
            </tr>
        @endforeach
    </table>

    <div class="footer">
        Órdenes recibidas: {{ $report['orders_received'] }} · Órdenes finalizadas: {{ $report['orders_finished'] }} · Cajas del período: {{ $report['cash_registers'] }}
    </div>
</div>
</body>
</html>

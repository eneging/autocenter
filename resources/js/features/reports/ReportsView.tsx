import { FileSpreadsheet, FileText } from 'lucide-react';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Loading, Metric, PanelTitle, useToast } from '../../components/ui';
import { money, toIsoDate } from '../../lib/constants';
import { downloadFile, errorMessage, formatDate } from '../../lib/taller';
import type { ReportData } from '../../types-taller';

type Period = ReportData['period'];

const PERIOD_LABEL: Record<Period, string> = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };

export function ReportsView() {
  const notify = useToast();
  const [period, setPeriod] = useState<Period>('daily');
  const [day, setDay] = useState(toIsoDate(new Date()));
  const [month, setMonth] = useState(toIsoDate(new Date()).slice(0, 7));

  const reference = period === 'monthly' ? month : day;

  const { data, isLoading } = useQuery({
    queryKey: ['report', period, reference],
    queryFn: async () => (await api.get<ReportData>(`/reports/${period}`, { params: { date: reference } })).data,
    enabled: !!reference,
  });

  const exportAs = async (format: 'pdf' | 'xlsx') => {
    try {
      await downloadFile(`/reports/${period}/export`, { date: reference, format }, `reporte-${period}-${reference}.${format}`);
    } catch (error) {
      notify(errorMessage(error, 'No se pudo generar el archivo.'), 'error');
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <PanelTitle title="Reportes" subtitle="Resúmenes de caja por día, semana o mes, exportables a PDF y Excel" />
        <div className="toolbar">
          <div className="toggle-group toggle-group-compact">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((value) => (
              <button key={value} className={`toggle-option ${period === value ? 'is-active' : ''}`} onClick={() => setPeriod(value)}>
                {PERIOD_LABEL[value]}
              </button>
            ))}
          </div>
          {period === 'monthly' ? (
            <label>
              Mes
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </label>
          ) : (
            <label>
              {period === 'weekly' ? 'Semana que incluye el' : 'Día'}
              <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
            </label>
          )}
          <button className="ghost-button" onClick={() => exportAs('pdf')}>
            <FileText size={15} /> PDF
          </button>
          <button className="ghost-button" onClick={() => exportAs('xlsx')}>
            <FileSpreadsheet size={15} /> Excel
          </button>
        </div>
      </section>

      {isLoading || !data ? (
        <Loading />
      ) : (
        <>
          <section className="panel">
            <PanelTitle title={data.title} subtitle={`${formatDate(data.from)} al ${formatDate(data.to)} · ${data.orders_received} órdenes recibidas · ${data.orders_finished} finalizadas`} />
            <div className="metric-grid">
              <Metric label="Ingresos" value={money(data.summary.income_total)} tone="green" />
              {Object.entries(data.summary.income_by_method).map(([method, amount]) => (
                <Metric key={method} label={`· ${method}`} value={money(amount)} />
              ))}
              <Metric label="Egresos" value={money(data.summary.expenses_total)} />
              <Metric label="IGV en ingresos" value={money(data.summary.igv_income)} tone="gold" />
              <Metric label="Resultado neto" value={money(data.summary.net_result)} danger={data.summary.net_result < 0} />
            </div>
          </section>

          {data.daily.length > 1 && (
            <section className="table-panel">
              <table className="stack-on-mobile">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Ingresos</th>
                    <th>Egresos</th>
                    <th>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((row) => (
                    <tr key={row.date}>
                      <td data-label="Día">{formatDate(row.date)}</td>
                      <td data-label="Ingresos">{money(row.income)}</td>
                      <td data-label="Egresos">{money(row.expenses)}</td>
                      <td data-label="Neto">{money(row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="table-panel">
            <table className="stack-on-mobile">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Método</th>
                  <th>Orden</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((transaction, index) => (
                  <tr key={index}>
                    <td data-label="Fecha">{formatDate(transaction.date)}</td>
                    <td data-label="Tipo">{transaction.type}</td>
                    <td data-label="Categoría">{transaction.category}</td>
                    <td data-label="Método">{transaction.payment_method ?? '—'}</td>
                    <td data-label="Orden">{transaction.order ?? '—'}</td>
                    <td data-label="Monto">{money(transaction.amount)}</td>
                  </tr>
                ))}
                {data.transactions.length === 0 && (
                  <tr>
                    <td colSpan={6}>Sin movimientos en este período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

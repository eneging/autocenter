import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  CalendarRange,
  CircleEllipsis,
  FileSpreadsheet,
  FileText,
  HardHat,
  Landmark,
  ListTree,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { LucideIcon } from 'lucide-react';
import { api } from '../../apiClient';
import { IncomeExpenseChart } from '../../components/charts';
import { Badge, ConfirmModal, Loading, Metric, Modal, PanelTitle, useToast } from '../../components/ui';
import { computeDateRange, DateRangePreset, money, toIsoDate } from '../../lib/constants';
import { Expense, FinanceSummary, LedgerEntry, Project, ProjectProfitability, Quotation, SavingsMovement, SavingsSummary } from '../../types';

const EXPENSE_CATEGORIES = ['Materiales', 'Herramientas', 'Alquiler', 'Servicios', 'Transporte', 'Impuestos', 'Otros'];
const PAYMENT_METHODS = ['Efectivo', 'Yape', 'Transferencia', 'Deposito', 'Tarjeta', 'Otro'];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Materiales: Boxes,
  Herramientas: Wrench,
  Alquiler: Building2,
  Servicios: Zap,
  Transporte: Truck,
  Impuestos: Landmark,
  Otros: CircleEllipsis,
  'Mano de obra': HardHat,
  'Cobro de cotizacion': Banknote,
};

function CategoryIcon({ category, size = 15 }: { category: string; size?: number }) {
  const Icon = CATEGORY_ICONS[category] ?? Receipt;
  const color = category === 'Cobro de cotizacion' ? 'var(--brand-black)' : 'var(--brand-red-dark)';
  return <Icon size={size} style={{ color }} />;
}

const FINANCE_TABS: { key: 'summary' | 'ledger' | 'expenses' | 'savings' | 'profitability'; label: string; icon: typeof Wallet; accent: 'green' | 'gold' }[] = [
  { key: 'summary', label: 'Resumen', icon: Wallet, accent: 'green' },
  { key: 'ledger', label: 'Movimientos', icon: ListTree, accent: 'gold' },
  { key: 'expenses', label: 'Gastos', icon: Receipt, accent: 'green' },
  { key: 'savings', label: 'Ahorros e inversiones', icon: PiggyBank, accent: 'gold' },
  { key: 'profitability', label: 'Rentabilidad', icon: TrendingUp, accent: 'gold' },
];

const SAVINGS_TYPES: { key: 'ahorro' | 'inversion'; label: string; icon: LucideIcon }[] = [
  { key: 'ahorro', label: 'Ahorro', icon: PiggyBank },
  { key: 'inversion', label: 'Inversion', icon: TrendingUp },
];

const RANGE_PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'last-month', label: 'Mes pasado' },
];

function firstOfMonth(): string {
  const today = new Date();
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const activePreset = RANGE_PRESETS.find((preset) => {
    const range = computeDateRange(preset.key);
    return range.from === from && range.to === to;
  });
  const [customOpen, setCustomOpen] = useState(!activePreset);

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="card-actions">
        {RANGE_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.key}
            className={`ghost-button ${activePreset?.key === preset.key && !customOpen ? 'ghost-button-accent' : ''}`}
            onClick={() => {
              setCustomOpen(false);
              onChange(computeDateRange(preset.key));
            }}
          >
            <CalendarDays size={14} /> {preset.label}
          </button>
        ))}
        <button type="button" className={`ghost-button ${customOpen ? 'ghost-button-accent' : ''}`} onClick={() => setCustomOpen((value) => !value)}>
          <CalendarRange size={14} /> Elegir otro rango
        </button>
      </div>

      {customOpen ? (
        <div className="embed-row" style={{ marginTop: 10 }}>
          <label className="finance-date-field">
            Desde
            <input type="date" value={from} onChange={(event) => onChange({ from: event.target.value, to })} />
          </label>
          <label className="finance-date-field">
            Hasta
            <input type="date" value={to} onChange={(event) => onChange({ from, to: event.target.value })} />
          </label>
        </div>
      ) : (
        <p className="finance-hint">
          Mostrando del {formatShortDate(from)} al {formatShortDate(to)}
        </p>
      )}
    </div>
  );
}

export function FinanceView({ onGoToPayroll }: { onGoToPayroll?: () => void }) {
  const [tab, setTab] = useState<'summary' | 'ledger' | 'expenses' | 'savings' | 'profitability'>('summary');

  return (
    <>
      <div className="site-tabs">
        {FINANCE_TABS.map(({ key, label, icon: Icon, accent }) => (
          <button key={key} className={`site-tab site-tab-${accent} ${tab === key ? 'is-active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === 'summary' && <SummaryTab />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'expenses' && <ExpensesTab onGoToPayroll={onGoToPayroll} />}
      {tab === 'savings' && <SavingsTab />}
      {tab === 'profitability' && <ProfitabilityTab />}
    </>
  );
}

function SummaryTab() {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(() => toIsoDate(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ['finance-summary', from, to],
    queryFn: async () => (await api.get<FinanceSummary>('/finance/summary', { params: { from, to } })).data,
  });

  const downloadStatement = async (format: 'pdf' | 'csv') => {
    const response = await api.get(`/finance/income-statement/${format}`, { params: { from, to }, responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estado-de-resultados-${from}-a-${to}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <DateRangePicker
        from={from}
        to={to}
        onChange={(range) => {
          setFrom(range.from);
          setTo(range.to);
        }}
      />

      {isLoading || !data ? (
        <Loading />
      ) : (
        <>
          <div className="metric-grid">
            <Metric label="Ingresos cobrados" value={money(data.totals.income_total)} tone="green" />
            <Metric label="Mano de obra" value={money(data.totals.labor_total)} tone="gold" />
            <Metric label="Otros gastos" value={money(data.totals.expenses_total)} tone="gold" />
            <Metric
              label="Balance del periodo"
              value={money(data.totals.balance)}
              danger={data.totals.balance < 0}
              tone={data.totals.balance >= 0 ? 'green' : undefined}
            />
          </div>

          <div className="card-actions" style={{ marginBottom: 18 }}>
            <button type="button" className="ghost-button" onClick={() => downloadStatement('pdf')}>
              <FileText size={15} /> Estado de resultados (PDF)
            </button>
            <button type="button" className="ghost-button" onClick={() => downloadStatement('csv')}>
              <FileSpreadsheet size={15} /> Estado de resultados (Excel)
            </button>
          </div>

          <div className="content-grid">
            <section className="panel panel-wide">
              <PanelTitle title="Ingresos vs egresos" subtitle="Ultimos 6 meses" />
              <IncomeExpenseChart data={data.monthly} />
            </section>
            <section className="panel">
              <PanelTitle title="Gastos por categoria" subtitle="En el rango seleccionado" />
              <div className="stack">
                {data.expenses_by_category.map((row) => (
                  <article className="list-item" key={row.category}>
                    <div className="list-item-heading">
                      <strong className="icon-label">
                        <CategoryIcon category={row.category} /> {row.category}
                      </strong>
                    </div>
                    <span style={{ color: 'var(--brand-red-dark)', fontWeight: 700 }}>{money(row.total)}</span>
                  </article>
                ))}
                {data.expenses_by_category.length === 0 && <span>Sin gastos registrados en este rango.</span>}
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="settings-section-header">
              <Scale size={18} />
              <PanelTitle title="Cuentas por cobrar" subtitle="Cotizaciones con saldo pendiente de pago" />
            </div>
            <section className="table-panel">
              <table className="stack-on-mobile">
                <thead>
                  <tr>
                    <th>Cotizacion</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Cobrado</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.receivables.map((quotation) => (
                    <tr key={quotation.id}>
                      <td data-label="Cotizacion">{quotation.number}</td>
                      <td data-label="Cliente">{quotation.client.name}</td>
                      <td data-label="Total">{money(quotation.total)}</td>
                      <td data-label="Cobrado" style={{ color: 'var(--brand-black)' }}>
                        {money(quotation.paid_amount)}
                      </td>
                      <td data-label="Saldo" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                        {money(quotation.balance_due)}
                      </td>
                      <td data-label="Estado">
                        <Badge label={quotation.payment_status} tone={quotation.payment_status === 'Parcial' ? 'warning' : 'danger'} />
                      </td>
                    </tr>
                  ))}
                  {data.receivables.length === 0 && (
                    <tr>
                      <td colSpan={6}>No hay saldos pendientes. Todo cobrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </section>
        </>
      )}
    </>
  );
}

function LedgerTab() {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get<Project[]>('/projects')).data });
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(() => toIsoDate(new Date()));
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['finance-ledger', from, to, projectId, type],
    queryFn: async () =>
      (
        await api.get<LedgerEntry[]>('/finance/ledger', {
          params: { from, to, project_id: projectId || undefined, type: type || undefined },
        })
      ).data,
  });

  const total = useMemo(
    () => data.reduce((sum, entry) => sum + (entry.type === 'ingreso' ? entry.amount : -entry.amount), 0),
    [data],
  );

  return (
    <section className="panel">
      <DateRangePicker
        from={from}
        to={to}
        onChange={(range) => {
          setFrom(range.from);
          setTo(range.to);
        }}
      />
      <div className="embed-row" style={{ marginBottom: 16 }}>
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">Todos los proyectos</option>
          {projects.map((project) => (
            <option value={project.id} key={project.id}>
              {project.code} - {project.name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Ingresos y egresos</option>
          <option value="ingreso">Solo ingresos</option>
          <option value="egreso">Solo egresos</option>
        </select>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <section className="table-panel">
            <table className="stack-on-mobile">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Descripcion</th>
                  <th>Proyecto</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Fecha">{entry.date}</td>
                    <td data-label="Tipo">
                      {entry.type === 'ingreso' ? (
                        <Badge label="Ingreso" tone="success" />
                      ) : (
                        <Badge label="Egreso" tone="warning" />
                      )}
                    </td>
                    <td data-label="Categoria">
                      <span className="icon-label">
                        <CategoryIcon category={entry.category} /> {entry.category}
                      </span>
                    </td>
                    <td data-label="Descripcion">{entry.description}</td>
                    <td data-label="Proyecto">{entry.project ? `${entry.project.code}` : '—'}</td>
                    <td
                      data-label="Monto"
                      style={{ color: entry.type === 'ingreso' ? 'var(--brand-black)' : 'var(--brand-red-dark)', fontWeight: 700 }}
                    >
                      {entry.type === 'ingreso' ? '+' : '-'}
                      {money(entry.amount)}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6}>No hay movimientos con esos filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          <div className="settings-save-bar">
            <strong style={{ color: total >= 0 ? 'var(--brand-black)' : 'var(--danger)' }}>Neto del periodo: {money(total)}</strong>
          </div>
        </>
      )}
    </section>
  );
}

function ExpensesTab({ onGoToPayroll }: { onGoToPayroll?: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => (await api.get<Expense[]>('/expenses')).data,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['finance-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeletingExpense(null);
      notify('Gasto eliminado correctamente');
    },
    onError: () => notify('No se pudo eliminar el gasto. Intenta de nuevo.', 'error'),
  });

  return (
    <section className="panel settings-section settings-section-gold">
      <div className="settings-section-header">
        <Receipt size={18} />
        <PanelTitle title="Gastos del negocio" subtitle="Materiales, herramientas, alquiler, servicios y otros egresos" />
      </div>
      <div className="card-actions">
        <button
          className="primary-button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={15} /> Registrar gasto
        </button>
        {onGoToPayroll && (
          <button type="button" className="ghost-button ghost-button-accent" onClick={onGoToPayroll}>
            <HardHat size={15} /> Pagar a un trabajador
          </button>
        )}
      </div>
      {onGoToPayroll && (
        <p className="finance-hint icon-label">
          <HardHat size={14} /> Los pagos a trabajadores se calculan por horas trabajadas en Asistencia — el boton de arriba te lleva directo.
        </p>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <div className="stack">
          {expenses.map((expense) => (
            <article className="list-item" key={expense.id}>
              <div className="list-item-heading">
                <strong className="icon-label">
                  <CategoryIcon category={expense.category} /> {expense.title}
                </strong>
                <Badge label={expense.category} tone="normal" />
              </div>
              <span>
                <strong style={{ color: 'var(--brand-red-dark)' }}>{money(expense.amount)}</strong> · {expense.expense_date.slice(0, 10)}
                {expense.project ? ` · ${expense.project.code}` : ''}
                {expense.method ? ` · ${expense.method}` : ''}
              </span>
              <div className="card-actions">
                {expense.receipt_url && (
                  <a className="ghost-button" href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                    Ver comprobante
                  </a>
                )}
                <button
                  className="ghost-button"
                  onClick={() => {
                    setEditing(expense);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={14} /> Editar
                </button>
                <button className="ghost-button ghost-button-danger" onClick={() => setDeletingExpense(expense)}>
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </article>
          ))}
          {expenses.length === 0 && <span>Aun no registras gastos.</span>}
        </div>
      )}

      {formOpen && <ExpenseFormModal expense={editing} onClose={() => setFormOpen(false)} />}
      {deletingExpense && (
        <ConfirmModal
          title="Eliminar gasto"
          message={`Esto eliminara el gasto "${deletingExpense.title}" por ${money(deletingExpense.amount)}. Esta accion no se puede deshacer.`}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deletingExpense.id)}
          onClose={() => setDeletingExpense(null)}
        />
      )}
    </section>
  );
}

type ExpenseFormValues = {
  category: string;
  title: string;
  amount: number | '';
  expense_date: string;
  method: string;
  project_id: string;
  receipt_url: string;
  notes: string;
};

function ExpenseFormModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const isEdit = !!expense;
  const queryClient = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get<Project[]>('/projects')).data });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasExtraDetails = !!(expense?.project_id || expense?.receipt_url || expense?.notes || (expense?.method && expense.method !== PAYMENT_METHODS[0]));
  const [showMore, setShowMore] = useState(hasExtraDetails);
  const { register, handleSubmit, setValue, watch } = useForm<ExpenseFormValues>({
    defaultValues: {
      category: expense?.category ?? EXPENSE_CATEGORIES[0],
      title: expense?.title ?? '',
      amount: expense ? Number(expense.amount) : '',
      expense_date: expense?.expense_date.slice(0, 10) ?? toIsoDate(new Date()),
      method: expense?.method ?? PAYMENT_METHODS[0],
      project_id: expense?.project_id ? String(expense.project_id) : '',
      receipt_url: expense?.receipt_url ?? '',
      notes: expense?.notes ?? '',
    },
  });
  const category = watch('category');

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post<{ url: string }>('/finance/upload-receipt', formData);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: unknown) => (isEdit ? api.put(`/expenses/${expense!.id}`, payload) : api.post('/expenses', payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['finance-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['finance-projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) =>
      setSubmitError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo guardar el gasto.' : 'No se pudo guardar el gasto.'),
  });

  return (
    <Modal title={isEdit ? 'Editar gasto' : 'Registrar gasto'} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={handleSubmit((values) =>
          saveMutation.mutate({
            ...values,
            title: values.title.trim() || values.category,
            amount: Number(values.amount),
            project_id: values.project_id ? Number(values.project_id) : null,
            receipt_url: values.receipt_url || null,
            notes: values.notes || null,
          }),
        )}
      >
        <label>
          En que se gasto
          <input type="hidden" {...register('category', { required: true })} />
          <div className="site-tabs" style={{ marginTop: 6, marginBottom: 0 }}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                className={`site-tab site-tab-gold ${category === cat ? 'is-active' : ''}`}
                onClick={() => setValue('category', cat)}
              >
                <CategoryIcon category={cat} size={14} /> {cat}
              </button>
            ))}
          </div>
        </label>
        <label>
          Monto (S/)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            autoFocus
            {...register('amount', { required: true, valueAsNumber: true })}
          />
        </label>
        <label>
          Descripcion (opcional)
          <input placeholder={`Ej: ${category}`} {...register('title')} />
        </label>

        <button
          type="button"
          className="ghost-button"
          style={{ gridColumn: '1 / -1', justifySelf: 'start' }}
          onClick={() => setShowMore((value) => !value)}
        >
          {showMore ? 'Ocultar detalles' : 'Mas detalles (fecha, metodo de pago, proyecto, comprobante)'}
        </button>

        {showMore && (
          <>
            <label>
              Fecha
              <input type="date" {...register('expense_date', { required: true })} />
            </label>
            <label>
              Metodo de pago
              <select {...register('method')}>
                {PAYMENT_METHODS.map((method) => (
                  <option value={method} key={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proyecto (opcional)
              <select {...register('project_id')}>
                <option value="">Gasto general del negocio</option>
                {projects.map((project) => (
                  <option value={project.id} key={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Comprobante (opcional)
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const res = await uploadMutation.mutateAsync(file);
                    setValue('receipt_url', res.data.url);
                  } catch {
                    // el mensaje de error ya se muestra abajo via uploadMutation.isError
                  } finally {
                    event.target.value = '';
                  }
                }}
              />
              {uploadMutation.isPending && <span>Subiendo comprobante...</span>}
              {uploadMutation.isError && (
                <span className="login-error">
                  {axios.isAxiosError(uploadMutation.error)
                    ? uploadMutation.error.response?.data?.message ?? 'No se pudo subir el comprobante. Intenta de nuevo.'
                    : 'No se pudo subir el comprobante. Intenta de nuevo.'}
                </span>
              )}
              {watch('receipt_url') && (
                <a href={watch('receipt_url')} target="_blank" rel="noopener noreferrer">
                  Ver archivo subido
                </a>
              )}
            </label>
            <label>
              Notas (opcional)
              <textarea rows={2} {...register('notes')} />
            </label>
          </>
        )}

        {submitError && <p className="login-error" style={{ gridColumn: '1 / -1' }}>{submitError}</p>}

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saveMutation.isPending}>
            {isEdit ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SavingsTab() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['savings'],
    queryFn: async () => (await api.get<SavingsSummary>('/savings')).data,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<SavingsMovement | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/savings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      setDeleting(null);
      notify('Movimiento eliminado correctamente');
    },
    onError: () => notify('No se pudo eliminar el movimiento. Intenta de nuevo.', 'error'),
  });

  const movements = data?.movements ?? [];
  const balances = data?.balances ?? { ahorro: 0, inversion: 0, total: 0 };

  return (
    <section className="panel settings-section settings-section-gold">
      <div className="settings-section-header">
        <PiggyBank size={18} />
        <PanelTitle title="Ahorros e inversiones" subtitle="Dinero que apartas del negocio — no afecta el neto ni la utilidad de proyectos" />
      </div>

      <div className="metric-grid">
        <Metric label="Ahorro acumulado" value={money(balances.ahorro)} tone="green" />
        <Metric label="Inversion acumulada" value={money(balances.inversion)} tone="gold" />
        <Metric label="Total apartado" value={money(balances.total)} tone="green" />
      </div>

      <div className="card-actions">
        <button
          className="primary-button"
          onClick={() => setFormOpen(true)}
        >
          <Plus size={15} /> Registrar movimiento
        </button>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <div className="stack">
          {movements.map((movement) => {
            const typeInfo = SAVINGS_TYPES.find((item) => item.key === movement.type)!;
            const Icon = typeInfo.icon;
            const isRetiro = movement.direction === 'retiro';
            return (
              <article className="list-item" key={movement.id}>
                <div className="list-item-heading">
                  <strong className="icon-label">
                    <Icon size={15} style={{ color: 'var(--brand-red-dark)' }} /> {typeInfo.label}
                  </strong>
                  <Badge label={isRetiro ? 'Retiro' : 'Aporte'} tone={isRetiro ? 'warning' : 'success'} />
                </div>
                <span>
                  <strong style={{ color: isRetiro ? 'var(--danger)' : 'var(--brand-black)' }}>
                    {isRetiro ? '-' : '+'}
                    {money(movement.amount)}
                  </strong>{' '}
                  · {movement.movement_date.slice(0, 10)}
                  {movement.notes ? ` · ${movement.notes}` : ''}
                </span>
                <div className="card-actions">
                  <button className="ghost-button ghost-button-danger" onClick={() => setDeleting(movement)}>
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              </article>
            );
          })}
          {movements.length === 0 && <span>Aun no registras ahorros ni inversiones.</span>}
        </div>
      )}

      {formOpen && <SavingsFormModal balances={balances} onClose={() => setFormOpen(false)} />}
      {deleting && (
        <ConfirmModal
          title="Eliminar movimiento"
          message={`Esto eliminara el ${deleting.direction} de ${money(deleting.amount)} registrado en ${SAVINGS_TYPES.find((item) => item.key === deleting.type)!.label}. Esta accion no se puede deshacer.`}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

type SavingsFormValues = {
  type: 'ahorro' | 'inversion';
  direction: 'aporte' | 'retiro';
  amount: number | '';
  movement_date: string;
  notes: string;
};

function SavingsFormModal({ balances, onClose }: { balances: SavingsSummary['balances']; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, watch } = useForm<SavingsFormValues>({
    defaultValues: {
      type: 'ahorro',
      direction: 'aporte',
      amount: '',
      movement_date: toIsoDate(new Date()),
      notes: '',
    },
  });
  const type = watch('type');
  const direction = watch('direction');
  const available = type === 'ahorro' ? balances.ahorro : balances.inversion;

  const saveMutation = useMutation({
    mutationFn: (payload: unknown) => api.post('/savings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      notify('Movimiento registrado correctamente');
      onClose();
    },
    onError: (err) =>
      setSubmitError(
        axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo guardar el movimiento.' : 'No se pudo guardar el movimiento.',
      ),
  });

  return (
    <Modal title="Registrar movimiento de ahorro o inversion" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={handleSubmit((values) =>
          saveMutation.mutate({
            ...values,
            amount: Number(values.amount),
            notes: values.notes || null,
          }),
        )}
      >
        <label>
          Fondo
          <input type="hidden" {...register('type', { required: true })} />
          <div className="site-tabs" style={{ marginTop: 6, marginBottom: 0 }}>
            {SAVINGS_TYPES.map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                key={key}
                className={`site-tab site-tab-gold ${type === key ? 'is-active' : ''}`}
                onClick={() => setValue('type', key)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </label>
        <label>
          Movimiento
          <input type="hidden" {...register('direction', { required: true })} />
          <div className="site-tabs" style={{ marginTop: 6, marginBottom: 0 }}>
            <button
              type="button"
              className={`site-tab site-tab-green ${direction === 'aporte' ? 'is-active' : ''}`}
              onClick={() => setValue('direction', 'aporte')}
            >
              <TrendingUp size={14} /> Aporte
            </button>
            <button
              type="button"
              className={`site-tab site-tab-gold ${direction === 'retiro' ? 'is-active' : ''}`}
              onClick={() => setValue('direction', 'retiro')}
            >
              <TrendingDown size={14} /> Retiro
            </button>
          </div>
          {direction === 'retiro' && <p className="finance-hint">Disponible en este fondo: {money(available)}</p>}
        </label>
        <label>
          Monto (S/)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            autoFocus
            {...register('amount', { required: true, valueAsNumber: true })}
          />
        </label>
        <label>
          Fecha
          <input type="date" {...register('movement_date', { required: true })} />
        </label>
        <label>
          Notas (opcional)
          <textarea rows={2} {...register('notes')} />
        </label>

        {submitError && <p className="login-error" style={{ gridColumn: '1 / -1' }}>{submitError}</p>}

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saveMutation.isPending}>
            Registrar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProfitabilityTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['finance-projects'],
    queryFn: async () => (await api.get<ProjectProfitability[]>('/finance/projects')).data,
  });

  if (isLoading) return <Loading />;

  return (
    <section className="panel">
      <div className="settings-section-header">
        <BarChart3 size={18} />
        <PanelTitle title="Rentabilidad por proyecto" subtitle="Ingresos cobrados menos mano de obra y gastos asignados a cada proyecto" />
      </div>
      <section className="table-panel">
        <table className="stack-on-mobile">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Cotizado</th>
              <th>Cobrado</th>
              <th>Mano de obra</th>
              <th>Gastos</th>
              <th>Utilidad</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.project.id}>
                <td data-label="Proyecto">
                  {row.project.code} — {row.project.name}
                </td>
                <td data-label="Cotizado">{money(row.quoted_total)}</td>
                <td data-label="Cobrado" style={{ color: 'var(--brand-black)', fontWeight: 600 }}>
                  <ArrowUpCircle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {money(row.income)}
                </td>
                <td data-label="Mano de obra" style={{ color: 'var(--brand-red-dark)', fontWeight: 600 }}>
                  <ArrowDownCircle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {money(row.labor)}
                </td>
                <td data-label="Gastos" style={{ color: 'var(--brand-red-dark)', fontWeight: 600 }}>
                  <ArrowDownCircle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {money(row.expenses)}
                </td>
                <td data-label="Utilidad">
                  <Badge label={money(row.profit)} tone={row.profit >= 0 ? 'success' : 'danger'} />
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6}>Aun no hay movimientos ligados a proyectos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}


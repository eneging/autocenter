import { Lock, Pencil, Plus, Trash2, Unlock } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, ConfirmModal, Loading, Metric, Modal, PanelTitle, useToast } from '../../components/ui';
import { money, toIsoDate } from '../../lib/constants';
import { errorMessage, formatDate, formatDateTime, PAYMENT_METHODS } from '../../lib/taller';
import type { CashOptions, CashRegister, CashSummary, ServiceOrder, Transaction } from '../../types-taller';
import type { Worker } from '../../types';

type Tab = 'current' | 'history' | 'commissions';

export function CashRegisterView() {
  const [tab, setTab] = useState<Tab>('current');

  return (
    <>
      <div className="site-tabs" role="tablist">
        {(
          [
            ['current', 'Caja de hoy'],
            ['history', 'Historial de cajas'],
            ['commissions', 'Comisiones'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} role="tab" className={`site-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'current' && <CurrentRegister />}
      {tab === 'history' && <RegisterHistory />}
      {tab === 'commissions' && <Commissions />}
    </>
  );
}

function SummaryMetrics({ summary }: { summary: CashSummary }) {
  return (
    <div className="metric-grid">
      <Metric label="Ingresos" value={money(summary.income_total)} tone="green" />
      {Object.entries(summary.income_by_method).map(([method, amount]) => (
        <Metric key={method} label={`· ${method}`} value={money(amount)} />
      ))}
      <Metric label="Gastos fijos" value={money(summary.fixed_expenses_total)} />
      <Metric label="Gastos variables" value={money(summary.variable_expenses_total)} />
      <Metric label="IGV en ingresos (18%)" value={money(summary.igv_income)} tone="gold" />
      <Metric label="Resultado neto" value={money(summary.net_result)} danger={summary.net_result < 0} />
      <Metric label="Efectivo esperado en caja" value={money(summary.expected_cash)} />
    </div>
  );
}

function CurrentRegister() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState('0');
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const { data: register, isLoading } = useQuery({
    queryKey: ['cash-register', 'current'],
    queryFn: async () => (await api.get<CashRegister | null>('/cash-registers/current')).data,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-register'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const open = useMutation({
    mutationFn: async () => (await api.post('/cash-registers', { opening_amount: Number(opening) || 0 })).data,
    onSuccess: () => {
      notify('Caja abierta.');
      refresh();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const close = useMutation({
    mutationFn: async () => (await api.post(`/cash-registers/${register?.id}/close`)).data,
    onSuccess: () => {
      notify('Caja cerrada.');
      setClosing(false);
      refresh();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const remove = useMutation({
    mutationFn: async (transaction: Transaction) => api.delete(`/transactions/${transaction.id}`),
    onSuccess: () => {
      notify('Movimiento eliminado.');
      setDeleting(null);
      refresh();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  if (isLoading) return <Loading />;

  if (!register) {
    return (
      <section className="panel">
        <PanelTitle title="Apertura de caja" subtitle="No hay una caja abierta. Registra el efectivo inicial para comenzar el día." />
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            open.mutate();
          }}
        >
          <label>
            Efectivo inicial (S/)
            <input type="number" step="0.01" min="0" value={opening} onChange={(event) => setOpening(event.target.value)} />
          </label>
          <button className="primary-button" disabled={open.isPending}>
            <Unlock size={16} /> Abrir caja
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <PanelTitle title={`Caja abierta · ${formatDateTime(register.opened_at)}`} subtitle={`Abrió ${register.opened_by?.name ?? '—'} con ${money(register.opening_amount)}`} />
        {register.summary && <SummaryMetrics summary={register.summary} />}
        <div className="toolbar">
          <button className="primary-button" onClick={() => setEditing('new')}>
            <Plus size={16} /> Nuevo movimiento
          </button>
          <button className="ghost-button ghost-button-danger" onClick={() => setClosing(true)}>
            <Lock size={15} /> Cerrar caja
          </button>
        </div>
      </section>

      <TransactionsTable
        transactions={register.transactions ?? []}
        onEdit={(transaction) => setEditing(transaction)}
        onDelete={(transaction) => setDeleting(transaction)}
      />

      {editing && <TransactionModal registerId={register.id} transaction={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {closing && (
        <ConfirmModal
          title="Cerrar caja"
          message={`Se cerrará la caja con ingresos de ${money(register.summary?.income_total ?? 0)}. Después no podrás agregar ni editar movimientos.`}
          confirmLabel="Cerrar caja"
          danger={false}
          pending={close.isPending}
          onConfirm={() => close.mutate()}
          onClose={() => setClosing(false)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Eliminar movimiento"
          message={`¿Eliminar "${deleting.category}" por ${money(deleting.amount)}?`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function TransactionsTable({ transactions, onEdit, onDelete }: { transactions: Transaction[]; onEdit?: (t: Transaction) => void; onDelete?: (t: Transaction) => void }) {
  return (
    <section className="table-panel">
      <table className="stack-on-mobile">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th>Método</th>
            <th>Detalle</th>
            <th>IGV</th>
            <th>Monto</th>
            {onEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td data-label="Fecha">{formatDate(transaction.transaction_date)}</td>
              <td data-label="Tipo">
                <Badge label={transaction.type} tone={transaction.type === 'Ingreso' ? 'success' : transaction.type === 'Gasto Fijo' ? 'warning' : 'normal'} />
              </td>
              <td data-label="Categoría">{transaction.category}</td>
              <td data-label="Método">{transaction.payment_method ?? '—'}</td>
              <td data-label="Detalle">
                {transaction.project?.code}
                {transaction.worker ? ` · ${transaction.worker.name}` : ''}
                <span>{transaction.description}</span>
              </td>
              <td data-label="IGV">{transaction.is_taxable ? money(transaction.igv_amount) : '—'}</td>
              <td data-label="Monto">
                <strong className={transaction.type === 'Ingreso' ? 'amount-in' : 'amount-out'}>
                  {transaction.type === 'Ingreso' ? '+' : '−'}
                  {money(transaction.amount)}
                </strong>
              </td>
              {onEdit && onDelete && (
                <td>
                  <div className="card-actions">
                    <button className="ghost-button" onClick={() => onEdit(transaction)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className="ghost-button ghost-button-danger" onClick={() => onDelete(transaction)} aria-label="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={8}>Sin movimientos todavía.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

type TransactionForm = {
  type: Transaction['type'];
  category: string;
  payment_method: string;
  amount: string;
  is_taxable: boolean;
  project_id: string;
  worker_id: string;
  description: string;
  transaction_date: string;
};

function TransactionModal({ registerId, transaction, onClose, onSaved }: { registerId: number; transaction: Transaction | null; onClose: () => void; onSaved: () => void }) {
  const notify = useToast();
  const { data: options } = useQuery({ queryKey: ['cash-options'], queryFn: async () => (await api.get<CashOptions>('/cash-registers/options')).data });
  const { data: orders = [] } = useQuery({ queryKey: ['service-orders', '', ''], queryFn: async () => (await api.get<ServiceOrder[]>('/service-orders')).data });
  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: async () => (await api.get<Worker[]>('/workers')).data });

  const { register, handleSubmit, watch, setValue } = useForm<TransactionForm>({
    defaultValues: {
      type: transaction?.type ?? 'Ingreso',
      category: transaction?.category ?? 'Servicio',
      payment_method: transaction?.payment_method ?? 'Efectivo',
      amount: transaction?.amount ?? '',
      is_taxable: transaction?.is_taxable ?? false,
      project_id: transaction?.project ? String(transaction.project.id) : '',
      worker_id: transaction?.worker ? String(transaction.worker.id) : '',
      description: transaction?.description ?? '',
      transaction_date: transaction?.transaction_date?.slice(0, 10) ?? toIsoDate(new Date()),
    },
  });

  const type = watch('type');
  const amount = Number(watch('amount') || 0);
  const taxable = watch('is_taxable');
  const rate = options?.igv_rate ?? 0.18;
  const igv = taxable ? amount - amount / (1 + rate) : 0;

  const categories = !options ? [] : type === 'Ingreso' ? options.income_categories : type === 'Gasto Fijo' ? options.fixed_expense_categories : options.variable_expense_categories;

  const mutation = useMutation({
    mutationFn: async (values: TransactionForm) => {
      const payload = {
        ...values,
        payment_method: values.payment_method || null,
        project_id: values.project_id || null,
        worker_id: values.worker_id || null,
        description: values.description || null,
      };
      return transaction ? api.put(`/transactions/${transaction.id}`, payload) : api.post(`/cash-registers/${registerId}/transactions`, payload);
    },
    onSuccess: () => {
      notify(transaction ? 'Movimiento actualizado.' : 'Movimiento registrado.');
      onSaved();
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title={transaction ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
      <form className="form-grid two-columns" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label>
          Tipo
          <select
            {...register('type', {
              onChange: (event) => {
                const next = event.target.value as Transaction['type'];
                const first = next === 'Ingreso' ? options?.income_categories[0] : next === 'Gasto Fijo' ? options?.fixed_expense_categories[0] : options?.variable_expense_categories[0];
                if (first) setValue('category', first);
              },
            })}
          >
            <option>Ingreso</option>
            <option>Gasto Fijo</option>
            <option>Gasto Variable</option>
          </select>
        </label>
        <label>
          Categoría
          <select {...register('category', { required: true })}>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Método de pago
          <select {...register('payment_method', { required: type === 'Ingreso' })}>
            {type !== 'Ingreso' && <option value="">—</option>}
            {PAYMENT_METHODS.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
        </label>
        <label>
          Monto total (S/)
          <input type="number" step="0.01" min="0.01" {...register('amount', { required: true })} />
        </label>
        <label className="check-inline span-2">
          <input type="checkbox" {...register('is_taxable')} /> Operación gravada con IGV (el monto ya incluye el IGV)
        </label>
        {taxable && (
          <p className="field-hint span-2">
            Base {money(amount - igv)} · IGV {Math.round(rate * 100)}% {money(igv)}
          </p>
        )}
        {type === 'Ingreso' && (
          <label className="span-2">
            Orden de servicio (opcional)
            <select {...register('project_id')}>
              <option value="">Sin orden</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.code} · {order.vehicle?.plate} · {order.client?.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {type !== 'Ingreso' && (
          <label className="span-2">
            Trabajador (sueldos, comisiones o adelantos)
            <select {...register('worker_id')}>
              <option value="">No aplica</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Fecha
          <input type="date" {...register('transaction_date')} />
        </label>
        <label>
          Descripción
          <input {...register('description')} maxLength={500} />
        </label>
        <div className="modal-actions span-2">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RegisterHistory() {
  const [openId, setOpenId] = useState<number | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ['cash-register', 'history'], queryFn: async () => (await api.get<CashRegister[]>('/cash-registers')).data });

  if (isLoading) return <Loading />;

  return (
    <>
      <section className="table-panel">
        <table className="stack-on-mobile">
          <thead>
            <tr>
              <th>Apertura</th>
              <th>Cierre</th>
              <th>Estado</th>
              <th>Ingresos</th>
              <th>Responsable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((register) => (
              <tr key={register.id}>
                <td data-label="Apertura">{formatDateTime(register.opened_at)}</td>
                <td data-label="Cierre">{register.closed_at ? formatDateTime(register.closed_at) : '—'}</td>
                <td data-label="Estado">
                  <Badge label={register.status} tone={register.status === 'Abierta' ? 'info' : 'normal'} />
                </td>
                <td data-label="Ingresos">{money(register.total_income)}</td>
                <td data-label="Responsable">{register.opened_by?.name ?? '—'}</td>
                <td>
                  <button className="ghost-button" onClick={() => setOpenId(register.id)}>
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6}>Aún no hay cajas registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      {openId !== null && <RegisterDetailModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function RegisterDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['cash-register', id], queryFn: async () => (await api.get<CashRegister>(`/cash-registers/${id}`)).data });

  return (
    <Modal title={data ? `Caja del ${formatDate(data.opened_at)}` : 'Caja'} onClose={onClose} wide>
      {isLoading || !data ? (
        <Loading />
      ) : (
        <div className="stack">
          {data.summary && <SummaryMetrics summary={data.summary} />}
          <TransactionsTable transactions={data.transactions ?? []} />
        </div>
      )}
    </Modal>
  );
}

type CommissionRow = { worker_id: number; worker_name: string; generated: number; commission: number; orders: number };

function Commissions() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const today = new Date();
  const [from, setFrom] = useState(toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [method, setMethod] = useState('Efectivo');

  const { data, isLoading } = useQuery({
    queryKey: ['commissions', from, to],
    queryFn: async () => (await api.get<{ tiers: { min: number; amount: number }[]; rows: CommissionRow[] }>('/commissions', { params: { from, to } })).data,
  });

  const pay = useMutation({
    mutationFn: async (workerId: number) => (await api.post('/commissions/pay', { worker_id: workerId, from, to, payment_method: method })).data,
    onSuccess: () => {
      notify('Comisión registrada como gasto en la caja abierta.');
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const tiers = [...(data?.tiers ?? [])].sort((a, b) => a.min - b.min);

  return (
    <section className="panel">
      <PanelTitle
        title="Comisiones por técnico"
        subtitle={tiers.length ? `Escalones: ${tiers.map((tier) => `desde ${money(tier.min)} → ${money(tier.amount)}`).join(' · ')}` : 'Comisión según ingresos generados'}
      />
      <div className="toolbar">
        <label>
          Desde
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label>
          Pagar con
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            {PAYMENT_METHODS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {isLoading ? (
        <Loading />
      ) : (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Técnico</th>
                <th>Órdenes</th>
                <th>Ingresos generados</th>
                <th>Comisión</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((row) => (
                <tr key={row.worker_id}>
                  <td data-label="Técnico">{row.worker_name}</td>
                  <td data-label="Órdenes">{row.orders}</td>
                  <td data-label="Ingresos generados">{money(row.generated)}</td>
                  <td data-label="Comisión">
                    <strong>{money(row.commission)}</strong>
                  </td>
                  <td>
                    <button className="ghost-button" disabled={row.commission <= 0 || pay.isPending} onClick={() => pay.mutate(row.worker_id)}>
                      Registrar pago
                    </button>
                  </td>
                </tr>
              ))}
              {(data?.rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={5}>No hay ingresos ligados a órdenes de técnicos en este período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </section>
  );
}

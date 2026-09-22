import { Banknote, Calculator, CalendarDays, ClipboardList, Pencil, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../../apiClient';
import { Badge, ConfirmModal, Loading, Modal, PanelTitle, useToast } from '../../components/ui';
import { computeDateRange, DateRangePreset, money, toIsoDate } from '../../lib/constants';
import { Attendance, Project, Worker, WorkerPayment } from '../../types';

const formatDateTime = (value: string) => new Date(value).toLocaleString('es-PE');

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const ATTENDANCE_TABS: { key: 'records' | 'payroll'; label: string; icon: typeof ClipboardList; accent: 'green' | 'gold' }[] = [
  { key: 'records', label: 'Registros', icon: ClipboardList, accent: 'green' },
  { key: 'payroll', label: 'Pagos y tarifas', icon: Banknote, accent: 'gold' },
];

export function AttendanceAdminView({ initialTab = 'records' }: { initialTab?: 'records' | 'payroll' }) {
  const [tab, setTab] = useState<'records' | 'payroll'>(initialTab);

  return (
    <>
      <div className="site-tabs">
        {ATTENDANCE_TABS.map(({ key, label, icon: Icon, accent }) => (
          <button key={key} className={`site-tab site-tab-${accent} ${tab === key ? 'is-active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === 'records' && <AttendanceRecordsTab />}
      {tab === 'payroll' && <PayrollTab />}
    </>
  );
}

function AttendanceRecordsTab() {
  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: async () => (await api.get<Worker[]>('/workers')).data });
  const [workerId, setWorkerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<Attendance | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['attendance', workerId, from, to],
    queryFn: async () =>
      (
        await api.get<Attendance[]>('/attendance', {
          params: { worker_id: workerId || undefined, from: from || undefined, to: to || undefined },
        })
      ).data,
  });

  return (
    <section className="panel settings-section settings-section-green">
      <div className="settings-section-header">
        <ClipboardList size={18} />
        <PanelTitle title="Registros de asistencia" subtitle="Filtra por trabajador y rango de fechas" />
      </div>
      <div className="embed-row" style={{ marginBottom: 16 }}>
        <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
          <option value="">Todos los trabajadores</option>
          {workers.map((worker) => (
            <option value={worker.id} key={worker.id}>
              {worker.name}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>

      {isLoading && <Loading />}
      {!isLoading && (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Trabajador</th>
                <th>Entrada</th>
                <th>Almuerzo</th>
                <th>Salida</th>
                <th>Horas</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((attendance) => (
                <tr key={attendance.id}>
                  <td data-label="Trabajador">{attendance.worker?.name}</td>
                  <td data-label="Entrada">{formatDateTime(attendance.clock_in)}</td>
                  <td data-label="Almuerzo">
                    {attendance.break_start
                      ? `${formatDateTime(attendance.break_start)} ${attendance.break_end ? `— ${formatDateTime(attendance.break_end)}` : '(sin volver)'}`
                      : '—'}
                  </td>
                  <td data-label="Salida">{attendance.clock_out ? formatDateTime(attendance.clock_out) : 'En curso'}</td>
                  <td data-label="Horas">{attendance.worked_hours ?? '—'}</td>
                  <td data-label="Estado">
                    {attendance.worker_payment_id ? <Badge label="Pagado" tone="success" /> : <Badge label="Sin pagar" tone="normal" />}
                  </td>
                  <td>
                    {!attendance.worker_payment_id && (
                      <button className="ghost-button" onClick={() => setEditing(attendance)}>
                        <Pencil size={14} /> Corregir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7}>No hay registros con esos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {editing && <AttendanceEditModal attendance={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function AttendanceEditModal({ attendance, onClose }: { attendance: Attendance; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [clockIn, setClockIn] = useState(toLocalInputValue(attendance.clock_in));
  const [clockOut, setClockOut] = useState(attendance.clock_out ? toLocalInputValue(attendance.clock_out) : '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/attendance/${attendance.id}`, { clock_in: clockIn, clock_out: clockOut || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      notify('Asistencia actualizada correctamente');
      onClose();
    },
    onError: (err) => setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo guardar.' : 'No se pudo guardar.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/attendance/${attendance.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      notify('Registro de asistencia eliminado correctamente');
      onClose();
    },
    onError: (err) => setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo eliminar.' : 'No se pudo eliminar.'),
  });

  return (
    <>
    <Modal title={`Corregir asistencia — ${attendance.worker?.name ?? ''}`} onClose={onClose} narrow>
      {error && <p className="login-error">{error}</p>}
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <label>
          Entrada
          <input type="datetime-local" value={clockIn} onChange={(event) => setClockIn(event.target.value)} required />
        </label>
        <label>
          Salida
          <input type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="danger-button" onClick={() => setConfirmingDelete(true)} disabled={deleteMutation.isPending}>
            <Trash2 size={16} /> Eliminar
          </button>
          <button className="primary-button" disabled={saveMutation.isPending}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
    {confirmingDelete && (
      <ConfirmModal
        title="Eliminar registro de asistencia"
        message="Esto borrara por completo la entrada y salida de este dia para el trabajador. Esta accion no se puede deshacer."
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setConfirmingDelete(false)}
      />
    )}
    </>
  );
}

type PaymentSummary = {
  worker: Worker;
  attendances: Attendance[];
  total_hours: number;
  hourly_rate: string;
  total_amount: number;
  advances: { id: number; amount: string; requested_at: string }[];
  advances_deductible: number;
  net_amount: number;
};

function PayrollTab() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: async () => (await api.get<Worker[]>('/workers')).data });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get<Project[]>('/projects')).data });
  const [workerId, setWorkerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paidAt, setPaidAt] = useState(() => toIsoDate(new Date()));
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState('');
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState('');
  const [rateSaved, setRateSaved] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<WorkerPayment | null>(null);

  const worker = workers.find((item) => String(item.id) === workerId) ?? null;

  React.useEffect(() => {
    setSummary(null);
    setRateDraft(worker?.hourly_rate ?? '');
    setRateSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  const { data: payments = [] } = useQuery({
    queryKey: ['worker-payments', workerId],
    queryFn: async () => (await api.get<WorkerPayment[]>('/worker-payments', { params: { worker_id: workerId } })).data,
    enabled: !!workerId,
  });

  const rateMutation = useMutation({
    mutationFn: () =>
      api.put(`/workers/${workerId}`, {
        name: worker!.name,
        role: worker!.role,
        phone: worker!.phone ?? null,
        is_active: worker!.is_active ?? true,
        hourly_rate: rateDraft,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      setRateSaved(true);
    },
  });

  const applyPreset = (preset: DateRangePreset) => {
    const range = computeDateRange(preset);
    setFrom(range.from);
    setTo(range.to);
    setSummary(null);
    setError(null);
  };

  const calculate = async () => {
    setError(null);
    try {
      const { data } = await api.get<PaymentSummary>(`/workers/${workerId}/payment-summary`, { params: { from, to } });
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo calcular.' : 'No se pudo calcular.');
    }
  };

  const payMutation = useMutation({
    mutationFn: () =>
      api.post('/worker-payments', {
        worker_id: Number(workerId),
        project_id: projectId ? Number(projectId) : null,
        period_start: from,
        period_end: to,
        paid_at: paidAt,
        notes: notes || null,
      }),
    onSuccess: () => {
      setSummary(null);
      setNotes('');
      setProjectId('');
      queryClient.invalidateQueries({ queryKey: ['worker-payments', workerId] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['finance-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['finance-projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notify('Pago registrado correctamente');
    },
    onError: (err) => setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo registrar el pago.' : 'No se pudo registrar el pago.'),
  });

  const voidMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/worker-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments', workerId] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setVoidingPayment(null);
      notify('Pago anulado correctamente');
    },
    onError: () => notify('No se pudo anular el pago. Intenta de nuevo.', 'error'),
  });

  return (
    <div className="stack">
      <section className="panel settings-section settings-section-green">
        <div className="settings-section-header">
          <Banknote size={18} />
          <PanelTitle title="Tarifa por hora" subtitle="Elige un trabajador para ver y editar su pago por hora" />
        </div>
        <div className="form-grid">
          <label>
            Trabajador
            <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
              <option value="">Elige un trabajador</option>
              {workers.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {worker && (
            <label>
              Tarifa por hora de {worker.name} (S/)
              <input
                type="number"
                step="0.01"
                min="0"
                value={rateDraft}
                onChange={(event) => {
                  setRateDraft(event.target.value);
                  setRateSaved(false);
                }}
              />
            </label>
          )}
        </div>
        {worker && (
          <div className="card-actions" style={{ marginTop: 4 }}>
            <button type="button" className="primary-button" onClick={() => rateMutation.mutate()} disabled={rateMutation.isPending}>
              Guardar tarifa
            </button>
            {rateSaved && <Badge label="Tarifa actualizada" tone="success" />}
          </div>
        )}
      </section>

      <section className="panel settings-section settings-section-gold">
        <div className="settings-section-header">
          <Calculator size={18} />
          <PanelTitle title="Calcular pago" subtitle="Suma las horas sin pagar del trabajador en un rango de fechas" />
        </div>

        {!workerId && <p>Primero elige un trabajador en la seccion de arriba.</p>}

        {workerId && (
          <>
            <div className="card-actions" style={{ marginBottom: 12 }}>
              <button type="button" className="ghost-button" onClick={() => applyPreset('week')}>
                <CalendarDays size={14} /> Esta semana
              </button>
              <button type="button" className="ghost-button" onClick={() => applyPreset('last-week')}>
                <CalendarDays size={14} /> Semana pasada
              </button>
              <button type="button" className="ghost-button" onClick={() => applyPreset('month')}>
                <CalendarDays size={14} /> Este mes
              </button>
              <button type="button" className="ghost-button" onClick={() => applyPreset('last-month')}>
                <CalendarDays size={14} /> Mes pasado
              </button>
            </div>

            <div className="embed-row" style={{ marginBottom: 16 }}>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              <button type="button" className="ghost-button ghost-button-accent" onClick={calculate} disabled={!from || !to}>
                Calcular
              </button>
            </div>

            {error && <p className="login-error">{error}</p>}

            {summary && (
              <div className="stack">
                <article className="quote-card is-accepted">
                  <div>
                    <strong>{summary.total_hours} horas sin pagar</strong>
                    <span>Tarifa: {money(summary.hourly_rate)}/hora</span>
                  </div>
                  <strong className="quote-total-amount">{money(summary.total_amount)}</strong>
                </article>
                {summary.advances_deductible > 0 && (
                  <p className="field-hint">
                    Se descontarán {money(summary.advances_deductible)} de adelantos ya entregados ({summary.advances.length} en total pendientes de descuento). Neto a pagar:{' '}
                    <strong>{money(summary.net_amount)}</strong>
                  </p>
                )}
                <div className="form-grid">
                  <label>
                    Fecha de pago
                    <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
                  </label>
                  <label>
                    Proyecto (opcional)
                    <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                      <option value="">Sin proyecto asociado</option>
                      {projects.map((project) => (
                        <option value={project.id} key={project.id}>
                          {project.code} - {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Notas
                    <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" />
                  </label>
                </div>
                <button
                  className="primary-button"
                  onClick={() => payMutation.mutate()}
                  disabled={payMutation.isPending || summary.total_hours <= 0}
                >
                  Registrar pago
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {workerId && (
        <section className="panel settings-section settings-section-important">
          <div className="settings-section-header">
            <ClipboardList size={18} />
            <PanelTitle title={`Historial de pagos — ${worker?.name ?? ''}`} subtitle="Pagos ya registrados para este trabajador" />
          </div>
          <div className="stack">
            {payments.map((payment) => (
              <article className="list-item" key={payment.id}>
                <div className="list-item-heading">
                  <strong>
                    {payment.period_start.slice(0, 10)} — {payment.period_end.slice(0, 10)}
                  </strong>
                  <Badge label={`${payment.total_hours} horas`} tone="normal" />
                </div>
                <span>
                  {money(payment.total_amount)} · pagado el {payment.paid_at.slice(0, 10)}
                  {payment.project ? ` · ${payment.project.code}` : ''}
                  {payment.notes ? ` · ${payment.notes}` : ''}
                </span>
                <div className="card-actions">
                  <button className="ghost-button ghost-button-danger" onClick={() => setVoidingPayment(payment)} disabled={voidMutation.isPending}>
                    <Trash2 size={14} /> Anular
                  </button>
                </div>
              </article>
            ))}
            {payments.length === 0 && <span>Sin pagos registrados todavia.</span>}
          </div>
        </section>
      )}
      {voidingPayment && (
        <ConfirmModal
          title="Anular pago"
          message={`Esto anulara el pago de ${money(voidingPayment.total_amount)} y las horas volveran a quedar sin pagar. Esta accion no se puede deshacer.`}
          confirmLabel="Anular pago"
          pending={voidMutation.isPending}
          onConfirm={() => voidMutation.mutate(voidingPayment.id)}
          onClose={() => setVoidingPayment(null)}
        />
      )}
    </div>
  );
}

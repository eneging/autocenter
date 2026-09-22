import { CheckCircle2, Coffee, QrCode, Undo2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../../apiClient';
import { QrScanner } from '../../components/QrScanner';
import { Badge, Loading, Modal, PanelTitle } from '../../components/ui';
import { Attendance } from '../../types';

type MyAttendanceStatus = {
  today: Attendance | null;
  history: Attendance[];
};

type ScanResult = { type: 'Entrada' | 'Salida'; attendance: Attendance };

type Confirmation =
  | { kind: 'in'; time: string }
  | { kind: 'break-start'; time: string }
  | { kind: 'break-end'; time: string }
  | { kind: 'out'; time: string; hours: number | null };

const formatTime = (value: string) => new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
const formatDate = (value: string) => new Date(value).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).toUpperCase();
const todayLabel = `Hoy, ${new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}`;

function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${pad(minutes)}min`;
}

function useTicker(active: boolean) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

/** Tiempo trabajado hasta ahora: se congela mientras esta en almuerzo y descuenta ese tiempo cuando vuelve. */
function useWorkedElapsed(today: Attendance | null, ticking: boolean): string {
  useTicker(ticking);
  if (!today) return '0h 00min';

  const clockInMs = new Date(today.clock_in).getTime();
  const onBreak = !!today.break_start && !today.break_end;
  const endMs = onBreak
    ? new Date(today.break_start as string).getTime()
    : today.clock_out
      ? new Date(today.clock_out).getTime()
      : Date.now();

  let totalMs = endMs - clockInMs;
  if (today.break_start && today.break_end) {
    totalMs -= new Date(today.break_end).getTime() - new Date(today.break_start).getTime();
  }

  return formatSeconds(totalMs / 1000);
}

/** Tiempo de almuerzo transcurrido, solo cuenta mientras esta en pausa. */
function useBreakElapsed(breakStart: string | null | undefined, ticking: boolean): string {
  useTicker(ticking);
  if (!breakStart) return '0h 00min';
  return formatSeconds((Date.now() - new Date(breakStart).getTime()) / 1000);
}

export function MyAttendanceView() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: async () => (await api.get<MyAttendanceStatus>('/my-attendance')).data,
  });

  const today = data?.today ?? null;
  const onBreak = !!today && !!today.break_start && !today.break_end && !today.clock_out;
  const isWorking = !!today && !today.clock_out && !onBreak;
  const alreadyUsedBreak = !!today?.break_start;
  const isDone = !!today?.clock_out;

  const workedElapsed = useWorkedElapsed(today, isWorking);
  const breakElapsed = useBreakElapsed(today?.break_start, onBreak);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-attendance'] });
  const onError = (err: unknown) => {
    setError(axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Ocurrio un error.') : 'Ocurrio un error.');
  };

  const scanMutation = useMutation({
    mutationFn: (code: string) => api.post<ScanResult>('/my-attendance/scan', { code }),
    onSuccess: (response) => {
      setError(null);
      setScanning(false);
      setManualCode('');
      const { type, attendance } = response.data;
      setConfirmation(
        type === 'Entrada'
          ? { kind: 'in', time: attendance.clock_in }
          : { kind: 'out', time: attendance.clock_out!, hours: attendance.worked_hours },
      );
      invalidate();
    },
    onError,
  });

  const breakStartMutation = useMutation({
    mutationFn: () => api.post<Attendance>('/my-attendance/break-start'),
    onSuccess: (response) => {
      setError(null);
      setConfirmation({ kind: 'break-start', time: response.data.break_start! });
      invalidate();
    },
    onError,
  });

  const breakEndMutation = useMutation({
    mutationFn: () => api.post<Attendance>('/my-attendance/break-end'),
    onSuccess: (response) => {
      setError(null);
      setConfirmation({ kind: 'break-end', time: response.data.break_end! });
      invalidate();
    },
    onError,
  });

  if (isLoading || !data) return <Loading />;

  const busy = scanMutation.isPending || breakStartMutation.isPending || breakEndMutation.isPending;
  const needsScan = !today || isWorking; // marcar entrada o marcar salida, ambas por QR

  const statusState = onBreak ? 'break' : isWorking ? 'working' : isDone ? 'done' : 'not-started';
  const statusText = onBreak
    ? `En almuerzo · ${breakElapsed}`
    : isWorking
      ? `Jornada activa · ${workedElapsed}`
      : isDone
        ? `Jornada terminada · ${today!.worked_hours} horas`
        : 'Jornada sin iniciar';

  return (
    <div className="stack">
      <section className="panel attendance-hero">
        <PanelTitle title="Mi jornada" subtitle={todayLabel} />
        {error && <p className="login-error">{error}</p>}

        <div className={`attendance-status-banner is-${statusState}`}>
          <span className="attendance-status-dot" />
          <span>{statusText}</span>
        </div>

        <div className="attendance-times-grid">
          <div className="attendance-time-cell">
            <span className="attendance-time-cell-label">Entrada</span>
            <strong>{today ? formatTime(today.clock_in) : '—'}</strong>
          </div>
          <div className="attendance-time-cell">
            <span className="attendance-time-cell-label">Almuerzo</span>
            <strong>
              {today?.break_start
                ? `${formatTime(today.break_start)}${today.break_end ? ` - ${formatTime(today.break_end)}` : ''}`
                : '—'}
            </strong>
          </div>
          <div className="attendance-time-cell">
            <span className="attendance-time-cell-label">Salida</span>
            <strong>{today?.clock_out ? formatTime(today.clock_out) : '—'}</strong>
          </div>
        </div>

        {needsScan && !scanning && (
          <button type="button" className="primary-button" onClick={() => setScanning(true)} disabled={busy}>
            <QrCode size={18} /> {isWorking ? 'Escanear QR para marcar salida' : 'Escanear QR para marcar entrada'}
          </button>
        )}

        {needsScan && scanning && (
          <div className="stack">
            <p className="field-hint">Escanea el código QR de asistencia pegado en el taller.</p>
            <QrScanner onScan={(code) => scanMutation.mutate(code.trim())} active={!scanMutation.isPending} />
            <form
              className="manual-code"
              onSubmit={(event) => {
                event.preventDefault();
                if (manualCode.trim()) scanMutation.mutate(manualCode.trim());
              }}
            >
              <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="O escribe el código (ASIST-...)" />
              <button className="ghost-button" disabled={scanMutation.isPending}>
                Marcar
              </button>
            </form>
            <button type="button" className="ghost-button" onClick={() => setScanning(false)}>
              Cancelar
            </button>
          </div>
        )}

        {isDone && <p className="attendance-summary">Ya completaste tu jornada de hoy. ¡Buen trabajo!</p>}

        {onBreak && (
          <button
            type="button"
            className="primary-button attendance-action-button attendance-action-regreso"
            onClick={() => breakEndMutation.mutate()}
            disabled={busy}
          >
            <Undo2 size={18} /> Regresar de almuerzo
          </button>
        )}

        {isWorking && !alreadyUsedBreak && (
          <button
            type="button"
            className="ghost-button ghost-button-accent attendance-break-button"
            onClick={() => breakStartMutation.mutate()}
            disabled={busy}
          >
            <Coffee size={15} /> Marcar almuerzo
          </button>
        )}
      </section>

      <section className="panel">
        <PanelTitle title="Historial reciente" subtitle="Ultimos 30 dias" />
        <div className="stack">
          {data.history.map((item) => (
            <article className="list-item" key={item.id}>
              <div className="list-item-heading">
                <strong className="attendance-history-date">{formatDate(item.date)}</strong>
                {item.clock_out ? (
                  <CheckCircle2 size={17} className="attendance-history-check" />
                ) : (
                  <Badge label="En curso" tone="warning" />
                )}
              </div>
              <span className="attendance-history-label">Jornada laboral</span>
              <span className="attendance-history-range">
                {formatTime(item.clock_in)} — {item.clock_out ? formatTime(item.clock_out) : 'en curso'}
              </span>
              {item.break_start && (
                <span className="attendance-history-break">
                  Almuerzo {formatTime(item.break_start)}
                  {item.break_end ? ` — ${formatTime(item.break_end)}` : ' (sin volver)'}
                </span>
              )}
              <div className="badge-row">
                {item.worked_hours !== null && <Badge label={`${item.worked_hours} horas`} tone="normal" />}
                {item.worker_payment_id && <Badge label="Pagado" tone="success" />}
              </div>
            </article>
          ))}
          {data.history.length === 0 && <span>Sin registros todavia.</span>}
        </div>
      </section>

      {confirmation && (
        <Modal
          title={
            confirmation.kind === 'in'
              ? 'Entrada registrada'
              : confirmation.kind === 'break-start'
                ? 'Buen provecho'
                : confirmation.kind === 'break-end'
                  ? 'De vuelta al trabajo'
                  : 'Salida registrada'
          }
          onClose={() => setConfirmation(null)}
          narrow
        >
          <div className="confirm-icon">
            <CheckCircle2 />
          </div>
          <p className="confirm-text">
            {confirmation.kind === 'in' && (
              <>
                Marcaste tu entrada a las <strong>{formatTime(confirmation.time)}</strong> ¡Buen trabajo!
              </>
            )}
            {confirmation.kind === 'break-start' && (
              <>
                Saliste a almorzar a las <strong>{formatTime(confirmation.time)}</strong>. Tu tiempo de trabajo queda en pausa
                hasta que vuelvas.
              </>
            )}
            {confirmation.kind === 'break-end' && (
              <>
                Volviste del almuerzo a las <strong>{formatTime(confirmation.time)}</strong>. Tu tiempo de trabajo sigue
                contando.
              </>
            )}
            {confirmation.kind === 'out' && (
              <>
                Marcaste tu salida a las <strong>{formatTime(confirmation.time)}</strong>
                {confirmation.hours !== null && (
                  <>
                    {' '}
                    · trabajaste <strong>{confirmation.hours} horas</strong> hoy
                  </>
                )}
              </>
            )}
          </p>
          <div className="modal-actions" style={{ justifyContent: 'center' }}>
            <button className="primary-button" onClick={() => setConfirmation(null)}>
              Listo
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

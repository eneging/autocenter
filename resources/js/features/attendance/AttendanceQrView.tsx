import { Ban, Clock, Infinity as InfinityIcon, Printer, QrCode } from 'lucide-react';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { ConfirmModal, Loading, PanelTitle, useToast } from '../../components/ui';
import { errorMessage, formatDateTime } from '../../lib/taller';

type AttendanceQr = {
  id: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  creator: { id: number; name: string } | null;
  svg: string;
};

/**
 * El QR de asistencia lo genera y controla el administrador (no cada trabajador): se imprime
 * y se pega en el taller. Cualquier técnico lo escanea desde su propia cuenta para marcar su
 * entrada o salida. Aquí se elige cuánto dura o si no vence nunca.
 */
export function AttendanceQrView() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [neverExpires, setNeverExpires] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const { data: current, isLoading } = useQuery({
    queryKey: ['attendance-qr'],
    queryFn: async () => (await api.get<AttendanceQr | null>('/attendance/qr')).data,
  });

  const generate = useMutation({
    mutationFn: async () => (await api.post<AttendanceQr>('/attendance/qr', { never_expires: neverExpires, expires_at: neverExpires ? null : expiresAt })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['attendance-qr'], data);
      notify('QR de asistencia generado. Imprímelo y pégalo en el taller.');
      setConfirmingReplace(false);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const revoke = useMutation({
    mutationFn: async () => (await api.post<AttendanceQr>(`/attendance/qr/${current?.id}/revoke`)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['attendance-qr'], data);
      notify('QR desactivado. Los técnicos ya no podrán usarlo.');
      setRevoking(false);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  if (isLoading) return <Loading />;

  return (
    <div className="stack">
      <section className="panel">
        <PanelTitle
          title="QR de asistencia"
          subtitle="Un solo código para todo el taller: imprímelo y pégalo en la entrada. Cada técnico lo escanea desde su cuenta para marcar su propia entrada y salida."
        />

        {current ? (
          <div className="qr-card">
            <div className="qr-svg-box" dangerouslySetInnerHTML={{ __html: current.svg }} />
            <strong>{current.expires_at ? `Vence el ${formatDateTime(current.expires_at)}` : 'Sin vencimiento'}</strong>
            <small>
              Generado {formatDateTime(current.created_at)}
              {current.creator ? ` por ${current.creator.name}` : ''}
            </small>
            <div className="card-actions">
              <button className="primary-button" onClick={() => window.print()}>
                <Printer size={15} /> Imprimir
              </button>
              <button className="ghost-button ghost-button-danger" onClick={() => setRevoking(true)}>
                <Ban size={14} /> Desactivar
              </button>
            </div>
          </div>
        ) : (
          <p className="field-hint">No hay ningún QR de asistencia activo todavía. Genera uno para que los técnicos puedan marcar su asistencia.</p>
        )}
      </section>

      <section className="panel">
        <PanelTitle title={current ? 'Generar un QR nuevo' : 'Generar el QR de asistencia'} subtitle="Al generar uno nuevo, el anterior deja de funcionar de inmediato." />
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            if (current) setConfirmingReplace(true);
            else generate.mutate();
          }}
        >
          <div className="toggle-group">
            <button type="button" className={`toggle-option ${neverExpires ? 'is-active' : ''}`} onClick={() => setNeverExpires(true)}>
              <InfinityIcon size={15} /> Sin vencimiento
            </button>
            <button type="button" className={`toggle-option ${!neverExpires ? 'is-active' : ''}`} onClick={() => setNeverExpires(false)}>
              <Clock size={15} /> Vence en una fecha
            </button>
          </div>
          {!neverExpires && (
            <label>
              Vence el
              <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required={!neverExpires} />
            </label>
          )}
          <p className="field-hint">
            {neverExpires
              ? 'Este QR seguirá funcionando indefinidamente hasta que lo desactives o generes uno nuevo.'
              : 'Después de esa fecha, el QR dejará de aceptar marcaciones.'}
          </p>
          <button className="primary-button" disabled={generate.isPending}>
            <QrCode size={16} /> {current ? 'Generar QR nuevo' : 'Generar QR'}
          </button>
        </form>
      </section>

      {confirmingReplace && (
        <ConfirmModal
          title="Generar un QR nuevo"
          message="El código actual dejará de funcionar de inmediato. Tendrás que imprimir y pegar el nuevo en el taller."
          confirmLabel="Generar de todas formas"
          pending={generate.isPending}
          onConfirm={() => generate.mutate()}
          onClose={() => setConfirmingReplace(false)}
        />
      )}
      {revoking && (
        <ConfirmModal
          title="Desactivar QR de asistencia"
          message="Ningún técnico podrá marcar su entrada o salida hasta que generes uno nuevo."
          confirmLabel="Desactivar"
          pending={revoke.isPending}
          onConfirm={() => revoke.mutate()}
          onClose={() => setRevoking(false)}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, Loading, PanelTitle, useToast } from '../../components/ui';
import { money } from '../../lib/constants';
import { errorMessage, formatDateTime } from '../../lib/taller';
import type { PayrollAdvance } from '../../types-taller';

export const advanceTone = (status: PayrollAdvance['status']): 'warning' | 'info' | 'danger' | 'success' =>
  status === 'Pendiente' ? 'warning' : status === 'Aprobado' ? 'info' : status === 'Rechazado' ? 'danger' : 'success';

export function MyAdvancesView() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const { data = [], isLoading } = useQuery({ queryKey: ['my-advances'], queryFn: async () => (await api.get<PayrollAdvance[]>('/my-advances')).data });

  const mutation = useMutation({
    mutationFn: async () => (await api.post('/my-advances', { amount: Number(amount), reason: reason || null })).data,
    onSuccess: () => {
      notify('Solicitud enviada. El administrador la revisará.');
      setAmount('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['my-advances'] });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const hasPending = data.some((advance) => advance.status === 'Pendiente');

  return (
    <div className="stack">
      <section className="panel">
        <PanelTitle title="Solicitar adelanto de sueldo" subtitle="Se descuenta automáticamente de tu próximo pago una vez entregado" />
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            Monto (S/)
            <input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={hasPending} />
          </label>
          <label>
            Motivo (opcional)
            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} disabled={hasPending} />
          </label>
          <button className="primary-button" disabled={mutation.isPending || hasPending || !amount}>
            {hasPending ? 'Tienes una solicitud pendiente' : 'Enviar solicitud'}
          </button>
        </form>
      </section>

      <section className="panel">
        <PanelTitle title="Mis solicitudes" subtitle="Historial de adelantos" />
        {isLoading ? (
          <Loading />
        ) : (
          <div className="stack">
            {data.map((advance) => (
              <article className="list-item" key={advance.id}>
                <div className="list-item-heading">
                  <strong>{money(advance.amount)}</strong>
                  <Badge label={advance.status} tone={advanceTone(advance.status)} />
                </div>
                <small>
                  {formatDateTime(advance.requested_at)}
                  {advance.reason ? ` · ${advance.reason}` : ''}
                </small>
              </article>
            ))}
            {data.length === 0 && <p className="field-hint">Todavía no has solicitado adelantos.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

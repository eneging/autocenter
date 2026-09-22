import { Check, HandCoins, X } from 'lucide-react';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, Loading, Modal, useToast } from '../../components/ui';
import { money } from '../../lib/constants';
import { errorMessage, formatDateTime, PAYMENT_METHODS } from '../../lib/taller';
import type { PayrollAdvance } from '../../types-taller';
import { advanceTone } from './MyAdvancesView';

export function AdvancesAdminView() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [paying, setPaying] = useState<PayrollAdvance | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['payroll-advances', status],
    queryFn: async () => (await api.get<PayrollAdvance[]>('/payroll-advances', { params: { status: status || undefined } })).data,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-advances'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const resolve = useMutation({
    mutationFn: async ({ advance, action }: { advance: PayrollAdvance; action: 'approve' | 'reject' }) => api.post(`/payroll-advances/${advance.id}/${action}`),
    onSuccess: (_, { action }) => {
      notify(action === 'approve' ? 'Adelanto aprobado.' : 'Solicitud rechazada.');
      refresh();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <>
      <div className="toolbar">
        <div className="toggle-group toggle-group-compact">
          {['', 'Pendiente', 'Aprobado', 'Pagado', 'Rechazado'].map((value) => (
            <button key={value} className={`toggle-option ${status === value ? 'is-active' : ''}`} onClick={() => setStatus(value)}>
              {value || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Trabajador</th>
                <th>Monto</th>
                <th>Motivo</th>
                <th>Solicitado</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((advance) => (
                <tr key={advance.id}>
                  <td data-label="Trabajador">
                    <strong>{advance.worker?.name}</strong>
                    <span>{advance.worker?.role}</span>
                  </td>
                  <td data-label="Monto">{money(advance.amount)}</td>
                  <td data-label="Motivo">{advance.reason ?? '—'}</td>
                  <td data-label="Solicitado">{formatDateTime(advance.requested_at)}</td>
                  <td data-label="Estado">
                    <Badge label={advance.status} tone={advanceTone(advance.status)} />
                  </td>
                  <td>
                    <div className="card-actions">
                      {advance.status === 'Pendiente' && (
                        <>
                          <button className="ghost-button" disabled={resolve.isPending} onClick={() => resolve.mutate({ advance, action: 'approve' })}>
                            <Check size={14} /> Aprobar
                          </button>
                          <button className="ghost-button ghost-button-danger" disabled={resolve.isPending} onClick={() => resolve.mutate({ advance, action: 'reject' })}>
                            <X size={14} /> Rechazar
                          </button>
                        </>
                      )}
                      {advance.status === 'Aprobado' && (
                        <button className="ghost-button ghost-button-accent" onClick={() => setPaying(advance)}>
                          <HandCoins size={14} /> Entregar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6}>No hay solicitudes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {paying && <PayModal advance={paying} onClose={() => setPaying(null)} onPaid={refresh} />}
    </>
  );
}

function PayModal({ advance, onClose, onPaid }: { advance: PayrollAdvance; onClose: () => void; onPaid: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [inCash, setInCash] = useState(true);
  const [method, setMethod] = useState('Efectivo');

  const mutation = useMutation({
    mutationFn: async () => api.post(`/payroll-advances/${advance.id}/pay`, { register_in_cash: inCash, payment_method: inCash ? method : undefined }),
    onSuccess: () => {
      notify('Adelanto entregado.');
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      onPaid();
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title={`Entregar adelanto · ${advance.worker?.name}`} onClose={onClose} narrow>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="confirm-text">Monto: {money(advance.amount)}. Se descontará del próximo pago de planilla.</p>
        <label className="check-inline">
          <input type="checkbox" checked={inCash} onChange={(event) => setInCash(event.target.checked)} /> Registrar la salida en la caja abierta (gasto fijo · Sueldos)
        </label>
        {inCash && (
          <label>
            Método de pago
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {PAYMENT_METHODS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            Confirmar entrega
          </button>
        </div>
      </form>
    </Modal>
  );
}

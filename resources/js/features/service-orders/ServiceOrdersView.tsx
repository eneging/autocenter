import { Car, Plus, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, Loading } from '../../components/ui';
import { money } from '../../lib/constants';
import { formatDate, ORDER_STATUSES, statusTone } from '../../lib/taller';
import type { ServiceOrder } from '../../types-taller';
import { OrderDetailModal } from './OrderDetailModal';
import { ReceptionModal } from './ReceptionModal';

/** `mode="technician"`: el técnico ve solo sus órdenes asignadas (el servidor lo garantiza). */
export function ServiceOrdersView({ mode = 'admin' }: { mode?: 'admin' | 'technician' }) {
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['service-orders', status, search],
    queryFn: async () => (await api.get<ServiceOrder[]>('/service-orders', { params: { status: status || undefined, search: search || undefined } })).data,
  });

  return (
    <>
      <div className="toolbar">
        {mode === 'admin' && (
          <button className="primary-button" onClick={() => setReceiving(true)}>
            <Plus size={17} /> Recibir vehículo
          </button>
        )}
        <div className="toggle-group toggle-group-compact">
          {['', ...ORDER_STATUSES].map((value) => (
            <button key={value || 'all'} className={`toggle-option ${status === value ? 'is-active' : ''}`} onClick={() => setStatus(value)}>
              {value || 'Todas'}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Placa, orden, marca o cliente" />
        </label>
      </div>

      {isLoading ? (
        <Loading />
      ) : data.length === 0 ? (
        <section className="panel empty-state">
          <Car size={32} />
          <p>{mode === 'admin' ? 'No hay órdenes de servicio con estos filtros.' : 'No tienes órdenes asignadas por ahora.'}</p>
        </section>
      ) : (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Vehículo</th>
                <th>Cliente</th>
                <th>Técnico</th>
                <th>Estado</th>
                <th>Ingreso</th>
                <th>Presupuesto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((order) => (
                <tr key={order.id}>
                  <td data-label="Orden">
                    <strong>{order.code}</strong>
                    <span>{order.service_type ?? 'Sin clasificar'}</span>
                  </td>
                  <td data-label="Vehículo">
                    <strong>{order.vehicle?.plate}</strong>
                    <span>
                      {order.vehicle?.brand} {order.vehicle?.model}
                    </span>
                  </td>
                  <td data-label="Cliente">
                    {order.client?.name}
                    <br />
                    <span>{order.client?.phone}</span>
                  </td>
                  <td data-label="Técnico">{order.responsible?.name ?? <Badge label="Sin asignar" tone="warning" />}</td>
                  <td data-label="Estado">
                    <Badge label={order.status} tone={statusTone(order.status)} />
                  </td>
                  <td data-label="Ingreso">{formatDate(order.starts_at)}</td>
                  <td data-label="Presupuesto">{order.budget ? money(order.budget) : '—'}</td>
                  <td>
                    <button className="ghost-button" onClick={() => setOpenId(order.id)}>
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {receiving && (
        <ReceptionModal
          onClose={() => setReceiving(false)}
          onCreated={(order) => {
            setReceiving(false);
            setOpenId(order.id);
          }}
        />
      )}
      {openId !== null && <OrderDetailModal orderId={openId} isAdmin={mode === 'admin'} onClose={() => setOpenId(null)} />}
    </>
  );
}

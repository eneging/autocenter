import { ExternalLink } from 'lucide-react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, Loading, PanelTitle } from '../../components/ui';
import { money } from '../../lib/constants';
import { formatDate, statusTone, trackingUrl } from '../../lib/taller';
import type { OrderStatus, Vehicle } from '../../types-taller';
import type { Quotation } from '../../types';

type MyOrder = {
  id: number;
  code: string;
  status: OrderStatus;
  progress: number;
  service_type: string | null;
  starts_at: string | null;
  estimated_delivery_at: string | null;
  exit_date: string | null;
  budget: string | null;
  client_access_token: string;
  vehicle: Vehicle | null;
  responsible?: { id: number; name: string } | null;
};

type MyRequestItem = {
  id: number;
  title: string;
  description: string;
  status: string;
  quotation: Quotation | null;
  project: { id: number } | null;
};

export function ClientVehiclesView() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['my-projects'],
    queryFn: async () => (await api.get<MyOrder[]>('/my-projects')).data,
  });
  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['my-requests'],
    queryFn: async () => (await api.get<MyRequestItem[]>('/my-requests')).data,
  });
  const pendingRequests = requests.filter((request) => !request.project);

  if (isLoading || loadingRequests) return <Loading />;

  return (
    <div className="stack">
      {pendingRequests.length > 0 && (
        <section className="panel compact-panel">
          <PanelTitle title="Mis solicitudes" subtitle="Estado de tus pedidos de cotización" />
          <div className="stack">
            {pendingRequests.map((request) => (
              <article className="list-item" key={request.id}>
                <strong>
                  {request.title} · {request.status}
                </strong>
                <span>{request.description}</span>
                {request.quotation && (
                  <span>
                    Cotización {request.quotation.number}: {money(request.quotation.total)}
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <PanelTitle title="Mis vehículos" subtitle="Órdenes de servicio de tus vehículos en el taller" />
        <div className="stack">
          {data.map((order) => (
            <article className="list-item" key={order.id}>
              <div className="list-item-heading">
                <strong>
                  {order.vehicle ? `${order.vehicle.brand} ${order.vehicle.model} · ${order.vehicle.plate}` : order.code}
                </strong>
                <Badge label={order.status} tone={statusTone(order.status)} />
              </div>
              <span>
                Orden {order.code}
                {order.service_type ? ` · ${order.service_type}` : ''} · Técnico: {order.responsible?.name ?? 'Por asignar'}
              </span>
              <span>
                Ingreso {formatDate(order.starts_at)}
                {order.exit_date ? ` · Salida ${formatDate(order.exit_date)}` : order.estimated_delivery_at ? ` · Entrega estimada ${formatDate(order.estimated_delivery_at)}` : ''}
              </span>
              <div className="progress">
                <span style={{ width: `${order.progress}%` }} />
              </div>
              <div className="card-actions">
                <a className="primary-button" href={trackingUrl(order.client_access_token)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} /> Ver seguimiento completo
                </a>
              </div>
            </article>
          ))}
          {data.length === 0 && pendingRequests.length === 0 && <p className="field-hint">Aún no tienes vehículos ni solicitudes registradas.</p>}
        </div>
      </section>
    </div>
  );
}

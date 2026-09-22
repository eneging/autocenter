import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, ConfirmModal, Loading, Modal, useToast } from '../../components/ui';
import { money, toIsoDate } from '../../lib/constants';
import { SERVICE_TYPES } from '../../lib/taller';
import { Client, Quotation, Worker } from '../../types';

function defaultDeliveryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  return toIsoDate(date);
}

type AdminQuoteRequest = {
  id: number;
  title: string;
  description: string;
  vehicle_plate: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  reference_image_url: string | null;
  status: string;
  rejected_reason: string | null;
  client: Client;
  quotation: Quotation | null;
  project: { id: number; code: string } | null;
};

export function QuoteRequestsView() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data = [], isLoading } = useQuery({
    queryKey: ['quote-requests'],
    queryFn: async () => (await api.get<AdminQuoteRequest[]>('/quote-requests')).data,
  });
  const [quotingRequest, setQuotingRequest] = useState<AdminQuoteRequest | null>(null);
  const [approvingRequest, setApprovingRequest] = useState<AdminQuoteRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<AdminQuoteRequest | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/quote-requests/${id}/status`, { status }),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote-requests'] });
      setRejectingRequest(null);
      notify(variables.status === 'Rechazado' ? 'Solicitud rechazada' : 'Solicitud marcada como contactada');
    },
    onError: () => notify('No se pudo actualizar la solicitud. Intenta de nuevo.', 'error'),
  });

  if (isLoading) return <Loading />;

  return (
    <>
      <div className="stack">
        {data.map((request) => (
          <article className="panel" key={request.id}>
            <div className="badge-row">
              <Badge
                label={request.status}
                tone={request.status === 'Rechazado' ? 'danger' : request.status === 'Aprobado' ? 'success' : 'normal'}
              />
            </div>
            <h3>{request.title}</h3>
            <p>
              {request.client.name} · {request.client.email} · {request.client.phone}
            </p>
            {request.vehicle_plate && (
              <p>
                <strong>Vehículo:</strong> {[request.vehicle_brand, request.vehicle_model].filter(Boolean).join(' ')} · {request.vehicle_plate}
              </p>
            )}
            <p>{request.description}</p>
            {request.reference_image_url && (
              <img src={request.reference_image_url} alt={request.title} style={{ maxWidth: 220, borderRadius: 8 }} />
            )}
            {request.quotation && (
              <p>
                Cotizacion: {request.quotation.number} — {money(request.quotation.total)}
              </p>
            )}
            {request.project && <p>Orden de servicio creada: {request.project.code}</p>}
            <div className="card-actions">
              {request.status === 'Pendiente' && (
                <button className="ghost-button" onClick={() => statusMutation.mutate({ id: request.id, status: 'Contactado' })}>
                  Marcar como contactado
                </button>
              )}
              {request.status !== 'Aprobado' && request.status !== 'Rechazado' && (
                <button className="ghost-button ghost-button-danger" onClick={() => setRejectingRequest(request)}>
                  Rechazar
                </button>
              )}
              {!request.quotation && request.status !== 'Rechazado' && (
                <button className="ghost-button" onClick={() => setQuotingRequest(request)}>
                  Generar cotizacion
                </button>
              )}
              {request.quotation && !request.project && (
                <button className="primary-button" onClick={() => setApprovingRequest(request)}>
                  Aprobar y crear orden de servicio
                </button>
              )}
            </div>
          </article>
        ))}
        {data.length === 0 && <section className="panel">No hay solicitudes por el momento.</section>}
      </div>
      {quotingRequest && <QuoteRequestQuotationModal request={quotingRequest} onClose={() => setQuotingRequest(null)} />}
      {approvingRequest && <QuoteRequestApproveModal request={approvingRequest} onClose={() => setApprovingRequest(null)} />}
      {rejectingRequest && (
        <ConfirmModal
          title="Rechazar solicitud"
          message={`Esto marcara como rechazada la solicitud de ${rejectingRequest.client.name}.`}
          confirmLabel="Rechazar"
          pending={statusMutation.isPending}
          onConfirm={() => statusMutation.mutate({ id: rejectingRequest.id, status: 'Rechazado' })}
          onClose={() => setRejectingRequest(null)}
        />
      )}
    </>
  );
}

function QuoteRequestQuotationModal({ request, onClose }: { request: AdminQuoteRequest; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { register, handleSubmit } = useForm({
    defaultValues: { title: request.title, description: '', amount: 0, delivery_time: '20 dias calendario' },
  });
  const mutation = useMutation({
    mutationFn: (values: { title: string; description: string; amount: number; delivery_time: string }) =>
      api.post(`/quote-requests/${request.id}/quotation`, {
        delivery_time: values.delivery_time,
        items: [{ title: values.title, description: values.description || null, amount: values.amount }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-requests'] });
      notify('Cotizacion generada correctamente');
      onClose();
    },
    onError: () => notify('No se pudo generar la cotizacion. Intenta de nuevo.', 'error'),
  });

  return (
    <Modal title={`Generar cotizacion — ${request.title}`} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label>
          Nombre del trabajo
          <input {...register('title', { required: true })} />
        </label>
        <label>
          Especificaciones (opcional)
          <textarea rows={3} {...register('description')} />
        </label>
        <label>
          Costo (S/)
          <input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
        </label>
        <label>
          Tiempo de entrega
          <input {...register('delivery_time', { required: true })} />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            Generar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function QuoteRequestApproveModal({ request, onClose }: { request: AdminQuoteRequest; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: async () => (await api.get<Worker[]>('/workers')).data });
  const { register, handleSubmit } = useForm({
    defaultValues: { service_type: '', priority: 'Media', estimated_delivery_at: defaultDeliveryDate(), responsible_worker_id: '' },
  });
  const mutation = useMutation({
    mutationFn: (payload: unknown) => api.post(`/quote-requests/${request.id}/approve`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-requests'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notify('Orden de servicio creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      onClose();
    },
    onError: () => notify('No se pudo aprobar la solicitud. Intenta de nuevo.', 'error'),
  });

  return (
    <Modal title={`Aprobar y crear orden — ${request.title}`} onClose={onClose} narrow>
      <form
        className="form-grid"
        onSubmit={handleSubmit((values) =>
          mutation.mutate({
            ...values,
            service_type: values.service_type || null,
            estimated_delivery_at: values.estimated_delivery_at || null,
            responsible_worker_id: values.responsible_worker_id ? Number(values.responsible_worker_id) : null,
          }),
        )}
      >
        <label>
          Tipo de servicio
          <select {...register('service_type')}>
            <option value="">Por definir</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select {...register('priority')}>
            <option>Baja</option>
            <option>Media</option>
            <option>Alta</option>
            <option>Urgente</option>
          </select>
        </label>
        <label>
          Técnico a cargo
          <select {...register('responsible_worker_id')}>
            <option value="">Sin asignar (asignar despues)</option>
            {workers.map((worker) => (
              <option value={worker.id} key={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entrega estimada
          <input type="date" min={toIsoDate(new Date())} {...register('estimated_delivery_at')} />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            Aprobar
          </button>
        </div>
      </form>
    </Modal>
  );
}

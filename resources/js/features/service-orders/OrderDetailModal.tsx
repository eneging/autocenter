import { Camera, CheckCircle2, Copy, Download, MessageCircle, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { ReceptionFields } from '../../components/ReceptionFields';
import { Badge, ConfirmModal, Loading, Modal, useToast } from '../../components/ui';
import { money } from '../../lib/constants';
import { defaultReceptionChecklist, downloadFile, errorMessage, formatDate, formatDateTime, getReceptionOptions, ORDER_STATUSES, SERVICE_TYPES, statusTone, trackingUrl } from '../../lib/taller';
import type { ReceptionChecklist } from '../../lib/taller';
import type { InventoryItem, OrderStatus, ServiceOrder } from '../../types-taller';
import type { Worker } from '../../types';

type Tab = 'ficha' | 'seguimiento' | 'repuestos' | 'cliente';

export function OrderDetailModal({ orderId, isAdmin, onClose }: { orderId: number; isAdmin: boolean; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('ficha');

  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order', orderId],
    queryFn: async () => (await api.get<ServiceOrder>(`/service-orders/${orderId}`)).data,
  });

  const refresh = (updated?: ServiceOrder) => {
    if (updated) queryClient.setQueryData(['service-order', orderId], updated);
    else queryClient.invalidateQueries({ queryKey: ['service-order', orderId] });
    queryClient.invalidateQueries({ queryKey: ['service-orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const statusMutation = useMutation({
    mutationFn: async (status: OrderStatus) => (await api.patch<ServiceOrder>(`/service-orders/${orderId}/status`, { status })).data,
    onSuccess: (updated) => {
      notify(`Estado: ${updated.status}`);
      refresh(updated);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const copyLink = async () => {
    if (!order) return;
    await navigator.clipboard.writeText(trackingUrl(order.client_access_token));
    notify('Enlace de seguimiento copiado.');
  };

  const openWhatsApp = async () => {
    try {
      const { data } = await api.get<{ url: string; whatsapp_url: string | null }>(`/service-orders/${orderId}/tracking-link`);
      if (!data.whatsapp_url) return notify('El cliente no tiene un teléfono válido para WhatsApp.', 'error');
      window.open(data.whatsapp_url, '_blank', 'noopener');
    } catch (error) {
      notify(errorMessage(error), 'error');
    }
  };

  const downloadPdf = async () => {
    if (!order) return;
    try {
      await downloadFile(`/service-orders/${order.id}/reception-pdf`, undefined, `${order.code}-orden-de-servicio.pdf`);
    } catch (error) {
      notify(errorMessage(error, 'No se pudo descargar el PDF.'), 'error');
    }
  };

  return (
    <Modal title={order ? `${order.code} · ${order.vehicle?.plate ?? ''}` : 'Orden de servicio'} onClose={onClose} wide>
      {isLoading || !order ? (
        <Loading />
      ) : (
        <div className="order-detail">
          <div className="order-detail-head">
            <div>
              <strong>
                {order.vehicle?.brand} {order.vehicle?.model}
              </strong>
              <span>
                {order.client?.name} · {order.client?.phone}
              </span>
            </div>
            <div className="toggle-group toggle-group-compact" role="group" aria-label="Estado de la orden">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  className={`toggle-option ${order.status === status ? 'is-active' : ''}`}
                  disabled={statusMutation.isPending}
                  onClick={() => order.status !== status && statusMutation.mutate(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="badge-row">
              <button className="ghost-button" onClick={downloadPdf}>
                <Download size={14} /> Orden de servicio (PDF)
              </button>
              <button className="ghost-button" onClick={copyLink}>
                <Copy size={14} /> Copiar enlace
              </button>
              <button className="ghost-button ghost-button-accent" onClick={openWhatsApp}>
                <MessageCircle size={14} /> Enviar por WhatsApp
              </button>
            </div>
          </div>

          <div className="site-tabs" role="tablist">
            {(
              [
                ['ficha', 'Ficha técnica'],
                ['seguimiento', `Seguimiento (${order.tracking_logs?.length ?? 0})`],
                ['repuestos', `Repuestos (${order.parts_requests?.length ?? 0})`],
                ['cliente', 'Cliente y cierre'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button key={key} role="tab" className={`site-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'ficha' && <TechnicalSheet order={order} isAdmin={isAdmin} onSaved={refresh} />}
          {tab === 'seguimiento' && <TrackingTab order={order} onChanged={() => refresh()} />}
          {tab === 'repuestos' && <PartsTab order={order} onChanged={refresh} />}
          {tab === 'cliente' && <ClientTab order={order} isAdmin={isAdmin} onDeleted={onClose} />}
        </div>
      )}
    </Modal>
  );
}

type SheetForm = {
  technical_diagnostic: string;
  solution: string;
  service_type: string;
  budget: string;
  estimated_time: string;
  estimated_delivery_at: string;
  starts_at: string;
  exit_date: string;
  notes: string;
  problem_description: string;
  responsible_worker_id: string;
  mileage: string;
  fuel_level: string;
  budget_authorization: 'request_budget' | 'no_budget_needed' | '';
  client_authorizes_test_drive: boolean;
};

function TechnicalSheet({ order, isAdmin, onSaved }: { order: ServiceOrder; isAdmin: boolean; onSaved: (order: ServiceOrder) => void }) {
  const notify = useToast();
  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: async () => (await api.get<Worker[]>('/workers')).data,
    enabled: isAdmin,
  });
  const { data: options } = useQuery({ queryKey: ['reception-options'], queryFn: getReceptionOptions });

  const toForm = (o: ServiceOrder): SheetForm => ({
    technical_diagnostic: o.technical_diagnostic ?? '',
    solution: o.solution ?? '',
    service_type: o.service_type ?? '',
    budget: o.budget ?? '',
    estimated_time: o.estimated_time ?? '',
    estimated_delivery_at: o.estimated_delivery_at ?? '',
    starts_at: o.starts_at ?? '',
    exit_date: o.exit_date ?? '',
    notes: o.notes ?? '',
    problem_description: o.problem_description ?? '',
    responsible_worker_id: o.responsible_worker_id ? String(o.responsible_worker_id) : '',
    mileage: o.mileage != null ? String(o.mileage) : '',
    fuel_level: o.fuel_level ?? '',
    budget_authorization: o.client_requests_prior_budget ? 'request_budget' : o.client_authorizes_repair_without_budget ? 'no_budget_needed' : '',
    client_authorizes_test_drive: !!o.client_authorizes_test_drive,
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<SheetForm>({ defaultValues: toForm(order) });
  useEffect(() => reset(toForm(order)), [order.id, order.status, order.exit_date]); // eslint-disable-line react-hooks/exhaustive-deps

  const [checklist, setChecklist] = useState<ReceptionChecklist | null>(null);
  useEffect(() => {
    if (order.reception_checklist) setChecklist(order.reception_checklist);
    else if (options) setChecklist(defaultReceptionChecklist(options));
  }, [order.id, options]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExterior = (item: string) =>
    setChecklist((current) => (current ? { ...current, exterior: { ...current.exterior, [item]: !current.exterior[item] } } : current));
  const toggleTool = (item: string) =>
    setChecklist((current) => (current ? { ...current, tools: { ...current.tools, [item]: !current.tools[item] } } : current));
  const setLevel = (item: string, value: string) =>
    setChecklist((current) => (current ? { ...current, levels: { ...current.levels, [item]: value } } : current));
  const toggleDamage = (zone: string) =>
    setChecklist((current) =>
      current ? { ...current, damages: { ...current.damages, [zone]: { ...current.damages[zone], has_damage: !current.damages[zone].has_damage } } } : current,
    );
  const setDamageNote = (zone: string, note: string) =>
    setChecklist((current) => (current ? { ...current, damages: { ...current.damages, [zone]: { ...current.damages[zone], note } } } : current));

  const mutation = useMutation({
    mutationFn: async (values: SheetForm) => {
      const { budget_authorization, ...rest } = values;
      const payload = {
        ...Object.fromEntries(
          Object.entries(rest)
            .filter(([key]) => isAdmin || !['problem_description', 'responsible_worker_id'].includes(key))
            .map(([key, value]) => [key, value === '' ? null : value]),
        ),
        client_requests_prior_budget: budget_authorization === 'request_budget',
        client_authorizes_repair_without_budget: budget_authorization === 'no_budget_needed',
        reception_checklist: checklist,
      };
      return (await api.put<ServiceOrder>(`/service-orders/${order.id}`, payload)).data;
    },
    onSuccess: (updated) => {
      notify('Ficha técnica guardada.');
      onSaved(updated);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <form className="form-grid two-columns" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <label className="span-2">
        Problema reportado por el cliente
        <textarea rows={2} {...register('problem_description')} readOnly={!isAdmin} />
      </label>
      <label className="span-2">
        Diagnóstico técnico
        <textarea rows={3} {...register('technical_diagnostic')} />
      </label>
      <label className="span-2">
        Solución propuesta / aplicada
        <textarea rows={3} {...register('solution')} />
      </label>
      <label>
        Tipo de servicio
        <select {...register('service_type')}>
          <option value="">Sin clasificar</option>
          {SERVICE_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        Presupuesto (S/)
        <input type="number" step="0.01" min="0" {...register('budget')} />
      </label>
      <label>
        Tiempo de demora
        <input {...register('estimated_time')} placeholder="Ej. 2 días" />
      </label>
      <label>
        Entrega estimada
        <input type="date" {...register('estimated_delivery_at')} />
      </label>
      <label>
        Fecha de ingreso
        <input type="date" {...register('starts_at')} />
      </label>
      <label>
        Fecha de salida
        <input type="date" {...register('exit_date')} />
      </label>
      {isAdmin && (
        <label>
          Técnico asignado
          <select {...register('responsible_worker_id')}>
            <option value="">Sin asignar</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="span-2">
        Notas internas (el cliente no las ve)
        <textarea rows={2} {...register('notes')} />
      </label>

      <h3 className="form-section">Recepción del vehículo</h3>
      {options && checklist ? (
        <>
          <ReceptionFields
            options={options}
            checklist={checklist}
            mileage={watch('mileage') ?? ''}
            onMileageChange={(value) => setValue('mileage', value)}
            fuelLevel={watch('fuel_level') ?? ''}
            onFuelLevelChange={(value) => setValue('fuel_level', value)}
            onToggleExterior={toggleExterior}
            onToggleTool={toggleTool}
            onSetLevel={setLevel}
            onToggleDamage={toggleDamage}
            onSetDamageNote={setDamageNote}
          />
          <h3 className="form-section">Autorizaciones del cliente</h3>
          <div className="span-2 toggle-group toggle-group-stack">
            <button
              type="button"
              className={`toggle-option ${watch('budget_authorization') === 'request_budget' ? 'is-active' : ''}`}
              onClick={() => setValue('budget_authorization', 'request_budget')}
            >
              Solicita presupuesto previo antes de autorizar el trabajo
            </button>
            <button
              type="button"
              className={`toggle-option ${watch('budget_authorization') === 'no_budget_needed' ? 'is-active' : ''}`}
              onClick={() => setValue('budget_authorization', 'no_budget_needed')}
            >
              Autoriza la reparación sin presupuesto previo
            </button>
          </div>
          <button
            type="button"
            className={`span-2 big-check-button ${watch('client_authorizes_test_drive') ? 'is-active' : ''}`}
            onClick={() => setValue('client_authorizes_test_drive', !watch('client_authorizes_test_drive'))}
          >
            <span className="big-check-box">{watch('client_authorizes_test_drive') ? <CheckCircle2 size={20} /> : null}</span>
            Autoriza conducir el vehículo para pruebas
          </button>
        </>
      ) : (
        <div className="span-2">
          <Loading />
        </div>
      )}

      <div className="modal-actions span-2">
        <button className="primary-button" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Guardar ficha'}
        </button>
      </div>
    </form>
  );
}

function TrackingTab({ order, onChanged }: { order: ServiceOrder; onChanged: () => void }) {
  const notify = useToast();
  const [annotation, setAnnotation] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const add = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      if (annotation.trim()) form.append('annotation', annotation.trim());
      if (image) form.append('image', image);
      return (await api.post(`/service-orders/${order.id}/logs`, form)).data;
    },
    onSuccess: () => {
      notify('Novedad publicada para el cliente.');
      setAnnotation('');
      setImage(null);
      if (fileInput.current) fileInput.current.value = '';
      onChanged();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const remove = useMutation({
    mutationFn: async (logId: number) => api.delete(`/service-orders/${order.id}/logs/${logId}`),
    onSuccess: onChanged,
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <div className="stack">
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <label>
          Nota para el cliente
          <textarea rows={2} value={annotation} onChange={(event) => setAnnotation(event.target.value)} placeholder="Ej. Se desmontó el alternador para revisión" maxLength={2000} />
        </label>
        <label className="file-field">
          <Camera size={16} /> {image ? image.name : 'Adjuntar foto (se le agrega la marca de agua del taller)'}
          <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
        </label>
        <button className="primary-button" disabled={add.isPending || (!annotation.trim() && !image)}>
          {add.isPending ? 'Subiendo...' : 'Publicar en el seguimiento'}
        </button>
      </form>

      <ol className="timeline">
        {(order.tracking_logs ?? []).map((log) => (
          <li key={log.id}>
            <span className="timeline-dot" />
            <div className="timeline-body">
              <time>
                {formatDateTime(log.created_at)}
                {log.creator ? ` · ${log.creator.name}` : ''}
              </time>
              {log.annotation && <p>{log.annotation}</p>}
              {log.watermarked_image_path && <img src={log.watermarked_image_path} alt="Foto del avance" loading="lazy" />}
              <button className="ghost-button ghost-button-danger" onClick={() => remove.mutate(log.id)} aria-label="Eliminar novedad">
                <Trash2 size={13} /> Quitar
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PartsTab({ order, onChanged }: { order: ServiceOrder; onChanged: (order?: ServiceOrder) => void }) {
  const notify = useToast();
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const { data: items = [] } = useQuery({
    queryKey: ['inventory', 'parts', search],
    queryFn: async () => (await api.get<InventoryItem[]>('/inventory', { params: { type: 'Repuesto', search: search || undefined } })).data,
  });

  const add = useMutation({
    mutationFn: async () => (await api.post<ServiceOrder>(`/service-orders/${order.id}/parts`, { inventory_item_id: Number(itemId), quantity })).data,
    onSuccess: (updated) => {
      notify('Repuesto asignado a la orden.');
      setItemId('');
      setQuantity(1);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onChanged(updated);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: async (partId: number) => (await api.delete<ServiceOrder>(`/service-orders/${order.id}/parts/${partId}`)).data,
    onSuccess: (updated) => {
      notify('Repuesto devuelto al inventario.');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onChanged(updated);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const selected = items.find((item) => String(item.id) === itemId);

  return (
    <div className="stack">
      <form
        className="parts-form"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar repuesto por nombre o código" />
        <select value={itemId} onChange={(event) => setItemId(event.target.value)} required>
          <option value="">Selecciona un repuesto</option>
          {items.map((item) => (
            <option key={item.id} value={item.id} disabled={item.stock < 1}>
              {item.name} · stock {item.stock} · {money(item.price_breakdown.total)}
            </option>
          ))}
        </select>
        <input type="number" min={1} max={selected?.stock ?? 9999} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} aria-label="Cantidad" />
        <button className="primary-button" disabled={!itemId || add.isPending}>
          Asignar
        </button>
      </form>

      <section className="table-panel">
        <table className="stack-on-mobile">
          <thead>
            <tr>
              <th>Repuesto</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(order.parts_requests ?? []).map((part) => (
              <tr key={part.id}>
                <td data-label="Repuesto">{part.inventory_item?.name ?? 'Repuesto eliminado'}</td>
                <td data-label="Cant.">{part.quantity}</td>
                <td data-label="Precio unit.">{money(part.unit_price)}</td>
                <td data-label="Subtotal">{money(part.quantity * Number(part.unit_price))}</td>
                <td>
                  <button className="ghost-button ghost-button-danger" onClick={() => remove.mutate(part.id)}>
                    <Trash2 size={13} /> Quitar
                  </button>
                </td>
              </tr>
            ))}
            {(order.parts_requests ?? []).length === 0 && (
              <tr>
                <td colSpan={5}>Todavía no se asignaron repuestos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {order.totals && (
        <div className="totals-box">
          <div>
            <span>Servicio (presupuesto)</span>
            <strong>{money(order.totals.service_budget)}</strong>
          </div>
          <div>
            <span>Repuestos</span>
            <strong>{money(order.totals.parts_total)}</strong>
          </div>
          <div className="totals-grand">
            <span>Total</span>
            <strong>{money(order.totals.total)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientTab({ order, isAdmin, onDeleted }: { order: ServiceOrder; isAdmin: boolean; onDeleted: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: async () => api.delete(`/service-orders/${order.id}`),
    onSuccess: () => {
      notify('Orden eliminada.');
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      onDeleted();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <div className="stack">
      <section className="panel compact-panel">
        <h3>{order.client?.name}</h3>
        <p>
          Tel. {order.client?.phone ?? '—'} · Doc. {order.client?.document_number ?? '—'} · {order.client?.email ?? 'sin correo'}
        </p>
        <p>
          Ingreso {formatDate(order.starts_at)} · Salida {formatDate(order.exit_date)}
        </p>
        <Badge label={order.status} tone={statusTone(order.status)} />
      </section>

      <section className="panel compact-panel">
        <h3>Comentario del cliente</h3>
        {order.client_commented_at ? (
          <>
            {order.client_rating && <div className="star-rating is-static">{'★'.repeat(order.client_rating)}</div>}
            <blockquote>{order.client_comment}</blockquote>
            <small>{formatDateTime(order.client_commented_at)}</small>
          </>
        ) : (
          <p className="field-hint">{order.status === 'Finalizado' ? 'El cliente todavía no dejó un comentario.' : 'Podrá comentar cuando la orden esté finalizada.'}</p>
        )}
      </section>

      {isAdmin && (
        <div className="modal-actions">
          <button className="danger-button" onClick={() => setConfirming(true)}>
            <Trash2 size={14} /> Eliminar orden
          </button>
        </div>
      )}
      {confirming && (
        <ConfirmModal
          title="Eliminar orden"
          message={`¿Eliminar la orden ${order.code}? El cliente dejará de ver su seguimiento.`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

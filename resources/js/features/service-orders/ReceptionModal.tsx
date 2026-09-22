import { CheckCircle2, Download, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { PlateUsageHint } from '../../components/PlateUsageHint';
import { ReceptionFields } from '../../components/ReceptionFields';
import { Loading, Modal, useToast } from '../../components/ui';
import { defaultReceptionChecklist, downloadFile, errorMessage, getReceptionOptions, lookupPlate, plateLookupMessage, SERVICE_TYPES } from '../../lib/taller';
import type { ReceptionChecklist } from '../../lib/taller';
import type { ServiceOrder } from '../../types-taller';
import type { Worker } from '../../types';

type ReceptionForm = {
  name: string;
  phone: string;
  document_type: '1' | '6';
  document_number: string;
  email: string;
  address: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  engine_number: string;
  mileage: string;
  fuel_level: string;
  problem_description: string;
  service_type: string;
  responsible_worker_id: string;
  estimated_delivery_at: string;
  estimated_time: string;
  budget_authorization: 'request_budget' | 'no_budget_needed';
  client_authorizes_test_drive: boolean;
  client_accepts_terms: boolean;
};

export function ReceptionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (order: ServiceOrder) => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, watch } = useForm<ReceptionForm>({
    defaultValues: {
      document_type: '1',
      service_type: '',
      responsible_worker_id: '',
      budget_authorization: 'request_budget',
      client_authorizes_test_drive: false,
      client_accepts_terms: false,
    },
  });

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: async () => (await api.get<Worker[]>('/workers')).data,
  });
  const { data: options } = useQuery({ queryKey: ['reception-options'], queryFn: getReceptionOptions });
  const [checklist, setChecklist] = useState<ReceptionChecklist | null>(null);
  if (options && !checklist) setChecklist(defaultReceptionChecklist(options));

  const documentType = watch('document_type');
  const [searching, setSearching] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<ServiceOrder | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Autocompleta con los datos del taller (vehículo y dueño) o, si es nueva, con el registro vehicular.
  const searchPlate = async (plate: string) => {
    if (plate.trim().length < 5 || searching) return;
    setSearching(true);
    try {
      const result = await lookupPlate(plate);
      const vehicle = result.vehicle;
      if (vehicle) {
        if (vehicle.brand) setValue('brand', vehicle.brand);
        if (vehicle.model) setValue('model', vehicle.model);
        if (vehicle.year) setValue('year', vehicle.year);
        if (vehicle.color) setValue('color', vehicle.color);
        if (vehicle.vin) setValue('vin', vehicle.vin);
        if (vehicle.engine_number) setValue('engine_number', vehicle.engine_number);
        if (vehicle.client) {
          setValue('name', vehicle.client.name);
          if (vehicle.client.phone) setValue('phone', vehicle.client.phone);
          if (vehicle.client.document_number) setValue('document_number', vehicle.client.document_number);
          if (vehicle.client.document_type === '1' || vehicle.client.document_type === '6') setValue('document_type', vehicle.client.document_type);
          if (vehicle.client.email) setValue('email', vehicle.client.email);
        }
      }
      const message = plateLookupMessage(result);
      notify(message.text, message.tone);
    } catch (error) {
      notify(errorMessage(error, 'No se pudo consultar la placa.'), 'error');
    } finally {
      setSearching(false);
      queryClient.invalidateQueries({ queryKey: ['plate-lookup-usage'] });
    }
  };

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
    mutationFn: async (values: ReceptionForm) => {
      const { budget_authorization, ...rest } = values;
      const payload = {
        ...Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, value === '' ? null : value])),
        client_requests_prior_budget: budget_authorization === 'request_budget',
        client_authorizes_repair_without_budget: budget_authorization === 'no_budget_needed',
        reception_checklist: checklist,
      };
      return (await api.post<ServiceOrder>('/service-orders', payload)).data;
    },
    onSuccess: (order) => {
      notify(`Orden ${order.code} creada.`);
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setCreatedOrder(order);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const downloadPdf = async () => {
    if (!createdOrder) return;
    setDownloading(true);
    try {
      await downloadFile(`/service-orders/${createdOrder.id}/reception-pdf`, undefined, `${createdOrder.code}-orden-de-servicio.pdf`);
    } catch (error) {
      notify(errorMessage(error, 'No se pudo descargar el PDF.'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (createdOrder) {
    return (
      <Modal title="Orden registrada" onClose={() => onCreated(createdOrder)} narrow>
        <div className="confirm-icon">
          <CheckCircle2 />
        </div>
        <p className="confirm-text">
          La orden <strong>{createdOrder.code}</strong> se registró correctamente. Puedes descargar la orden de servicio en PDF para imprimirla y que el cliente la firme.
        </p>
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <button className="ghost-button" onClick={downloadPdf} disabled={downloading}>
            <Download size={15} /> {downloading ? 'Descargando...' : 'Descargar PDF'}
          </button>
          <button className="primary-button" onClick={() => onCreated(createdOrder)}>
            Continuar
          </button>
        </div>
      </Modal>
    );
  }

  if (!options || !checklist) {
    return (
      <Modal title="Recepción de vehículo" onClose={onClose} wide>
        <Loading />
      </Modal>
    );
  }

  return (
    <Modal title="Recepción de vehículo" onClose={onClose} wide>
      <form
        className="form-grid two-columns"
        onSubmit={handleSubmit((values) => {
          if (!values.client_accepts_terms) {
            notify('Falta aceptar las condiciones de la orden de servicio.', 'error');
            return;
          }
          mutation.mutate(values);
        })}
      >
        <h3 className="form-section">Vehículo</h3>
        <label className="plate-field">
          Placa
          <span className="plate-field-row">
            <input {...register('plate', { required: true, onBlur: (event) => searchPlate(event.target.value) })} placeholder="ABC-123" autoCapitalize="characters" />
            <button type="button" className="ghost-button ghost-button-accent" disabled={searching} onClick={() => searchPlate(watch('plate') ?? '')}>
              <Search size={15} /> {searching ? 'Buscando...' : 'Buscar placa'}
            </button>
          </span>
          <PlateUsageHint />
        </label>
        <label>
          Marca
          <input {...register('brand', { required: true })} />
        </label>
        <label>
          Modelo
          <input {...register('model', { required: true })} />
        </label>
        <label>
          Año (opcional)
          <input {...register('year')} maxLength={4} inputMode="numeric" />
        </label>
        <label>
          Color (opcional)
          <input {...register('color')} />
        </label>
        <label>
          Serie / VIN (opcional)
          <input {...register('vin')} />
        </label>
        <label>
          N.° de motor (opcional)
          <input {...register('engine_number')} />
        </label>

        <h3 className="form-section">Cliente</h3>
        <label>
          Nombre / Razón social
          <input {...register('name', { required: true })} />
        </label>
        <label>
          Teléfono
          <input {...register('phone', { required: true })} inputMode="tel" />
        </label>
        <label>
          Tipo de documento
          <select {...register('document_type')}>
            <option value="1">DNI</option>
            <option value="6">RUC</option>
          </select>
        </label>
        <label>
          {documentType === '6' ? 'RUC (11 dígitos)' : 'DNI (8 dígitos)'}
          <input
            {...register('document_number', { required: true, pattern: documentType === '6' ? /^\d{11}$/ : /^\d{8}$/ })}
            inputMode="numeric"
            maxLength={documentType === '6' ? 11 : 8}
          />
        </label>
        <label>
          Correo (opcional)
          <input type="email" {...register('email')} />
        </label>
        <label>
          Dirección (opcional)
          <input {...register('address')} />
        </label>

        <h3 className="form-section">Servicio</h3>
        <label className="span-2">
          Descripción del problema
          <textarea rows={3} {...register('problem_description', { required: true })} placeholder="Lo que reporta el cliente" />
        </label>
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
        <label>
          Tiempo estimado
          <input {...register('estimated_time')} placeholder="Ej. 2 días" />
        </label>
        <label>
          Entrega estimada
          <input type="date" {...register('estimated_delivery_at')} />
        </label>

        <h3 className="form-section">Recepción del vehículo</h3>
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
            Solicito presupuesto previo antes de autorizar el trabajo
          </button>
          <button
            type="button"
            className={`toggle-option ${watch('budget_authorization') === 'no_budget_needed' ? 'is-active' : ''}`}
            onClick={() => setValue('budget_authorization', 'no_budget_needed')}
          >
            Autorizo realizar la reparación sin presupuesto previo
          </button>
        </div>
        <button
          type="button"
          className={`span-2 big-check-button ${watch('client_authorizes_test_drive') ? 'is-active' : ''}`}
          onClick={() => setValue('client_authorizes_test_drive', !watch('client_authorizes_test_drive'))}
        >
          <span className="big-check-box">{watch('client_authorizes_test_drive') ? <CheckCircle2 size={20} /> : null}</span>
          Autorizo conducir mi vehículo para pruebas
        </button>

        <p className="span-2 field-hint reception-legal-text">
          {options.liability_text} El cliente se compromete a recoger su vehículo dentro de las {options.pickup_hours} horas posteriores a la notificación de servicio
          concluido. Pasado dicho plazo, se aplicará un cargo diario por almacenaje de S/ {options.storage_fee_per_day.toFixed(2)}.
        </p>
        <button
          type="button"
          className={`span-2 big-check-button accept-terms-button ${watch('client_accepts_terms') ? 'is-active' : ''}`}
          onClick={() => setValue('client_accepts_terms', !watch('client_accepts_terms'))}
        >
          <span className="big-check-box">{watch('client_accepts_terms') ? <CheckCircle2 size={20} /> : null}</span>
          El cliente acepta las condiciones indicadas en esta orden de servicio
        </button>

        <div className="modal-actions span-2">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Registrar ingreso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { PlateUsageHint } from '../../components/PlateUsageHint';
import { Badge, ConfirmModal, Loading, Modal, useToast } from '../../components/ui';
import { errorMessage, formatDate, lookupPlate, plateLookupMessage, statusTone } from '../../lib/taller';
import type { Client } from '../../types';
import type { Vehicle } from '../../types-taller';

export function VehiclesView() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['vehicles', search],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles', { params: { search: search || undefined } })).data,
  });

  return (
    <>
      <div className="toolbar">
        <button className="primary-button" onClick={() => setEditing('new')}>
          <Plus size={17} /> Nuevo vehículo
        </button>
        <label className="search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Placa, marca, modelo o dueño" />
        </label>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Vehículo</th>
                <th>Dueño</th>
                <th>Próximo mantenimiento</th>
                <th>Órdenes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td data-label="Placa">
                    <strong>{vehicle.plate}</strong>
                  </td>
                  <td data-label="Vehículo">
                    {vehicle.brand} {vehicle.model}
                    <span>
                      {[vehicle.year, vehicle.color].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td data-label="Dueño">
                    {vehicle.client?.name}
                    <span>{vehicle.client?.phone}</span>
                  </td>
                  <td data-label="Próximo mantenimiento">{vehicle.next_maintenance_at ? formatDate(vehicle.next_maintenance_at) : '—'}</td>
                  <td data-label="Órdenes">{vehicle.projects_count}</td>
                  <td>
                    <div className="card-actions">
                      <button className="ghost-button" onClick={() => setHistoryId(vehicle.id)}>
                        Historial
                      </button>
                      <button className="ghost-button" onClick={() => setEditing(vehicle)}>
                        <Pencil size={14} /> Editar
                      </button>
                      <button className="ghost-button ghost-button-danger" onClick={() => setDeleting(vehicle)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6}>No hay vehículos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {editing && <VehicleFormModal vehicle={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteVehicleModal vehicle={deleting} onClose={() => setDeleting(null)} />}
      {historyId !== null && <VehicleHistoryModal vehicleId={historyId} onClose={() => setHistoryId(null)} />}
    </>
  );
}

type VehicleForm = { client_id: string; plate: string; brand: string; model: string; year: string; color: string; vin: string; engine_number: string; next_maintenance_at: string; notes: string };

function VehicleFormModal({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: async () => (await api.get<Client[]>('/clients')).data });
  const [searching, setSearching] = useState(false);
  const { register, handleSubmit, setValue, watch } = useForm<VehicleForm>({
    defaultValues: {
      client_id: vehicle ? String(vehicle.client_id) : '',
      plate: vehicle?.plate ?? '',
      brand: vehicle?.brand ?? '',
      model: vehicle?.model ?? '',
      year: vehicle?.year ?? '',
      color: vehicle?.color ?? '',
      vin: vehicle?.vin ?? '',
      engine_number: vehicle?.engine_number ?? '',
      next_maintenance_at: vehicle?.next_maintenance_at?.slice(0, 10) ?? '',
      notes: vehicle?.notes ?? '',
    },
  });

  // Completa marca, modelo, año, color, serie y motor desde el registro vehicular (json.pe).
  const searchPlate = async (plate: string) => {
    if (plate.trim().length < 5 || searching) return;
    setSearching(true);
    try {
      const result = await lookupPlate(plate);
      const found = result.vehicle;
      if (found) {
        if (found.brand) setValue('brand', found.brand);
        if (found.model) setValue('model', found.model);
        if (found.year) setValue('year', found.year);
        if (found.color) setValue('color', found.color);
        if (found.vin) setValue('vin', found.vin);
        if (found.engine_number) setValue('engine_number', found.engine_number);
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
  const mutation = useMutation({
    mutationFn: async (values: VehicleForm) => {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' ? null : value]));
      return vehicle ? api.put(`/vehicles/${vehicle.id}`, payload) : api.post('/vehicles', payload);
    },
    onSuccess: () => {
      notify(vehicle ? 'Vehículo actualizado.' : 'Vehículo registrado.');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title={vehicle ? 'Editar vehículo' : 'Nuevo vehículo'} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label>
          Dueño
          <select {...register('client_id', { required: true })}>
            <option value="">Selecciona un cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} {client.document_number ? `· ${client.document_number}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="plate-field">
          Placa
          <span className="plate-field-row">
            <input {...register('plate', { required: true, onBlur: (event) => !vehicle && searchPlate(event.target.value) })} autoCapitalize="characters" />
            <button type="button" className="ghost-button ghost-button-accent" disabled={searching} onClick={() => searchPlate(watch('plate') ?? '')}>
              <Search size={15} /> {searching ? 'Buscando...' : 'Buscar placa'}
            </button>
          </span>
          {!vehicle && <PlateUsageHint />}
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
          Año
          <input {...register('year')} maxLength={4} inputMode="numeric" />
        </label>
        <label>
          Color
          <input {...register('color')} />
        </label>
        <label>
          Serie / VIN
          <input {...register('vin')} />
        </label>
        <label>
          N.° de motor
          <input {...register('engine_number')} />
        </label>
        <label>
          Próximo mantenimiento (recordatorio por WhatsApp)
          <input type="date" {...register('next_maintenance_at')} />
        </label>
        <label>
          Notas
          <textarea rows={2} {...register('notes')} />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteVehicleModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => api.delete(`/vehicles/${vehicle.id}`),
    onSuccess: () => {
      notify('Vehículo eliminado.');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return <ConfirmModal title="Eliminar vehículo" message={`¿Eliminar el vehículo ${vehicle.plate}?`} pending={mutation.isPending} onConfirm={() => mutation.mutate()} onClose={onClose} />;
}

function VehicleHistoryModal({ vehicleId, onClose }: { vehicleId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['vehicle', vehicleId], queryFn: async () => (await api.get<Vehicle>(`/vehicles/${vehicleId}`)).data });

  return (
    <Modal title={data ? `Historial · ${data.plate}` : 'Historial'} onClose={onClose}>
      {isLoading || !data ? (
        <Loading />
      ) : (
        <div className="stack">
          {(data.projects ?? []).map((order) => (
            <article className="list-item" key={order.id}>
              <div className="list-item-heading">
                <strong>{order.code}</strong>
                <Badge label={order.status} tone={statusTone(order.status)} />
              </div>
              <small>
                {order.service_type ?? 'Sin clasificar'} · ingreso {formatDate(order.starts_at)} · salida {formatDate(order.exit_date)}
              </small>
            </article>
          ))}
          {(data.projects ?? []).length === 0 && <p className="field-hint">Este vehículo aún no tiene órdenes de servicio.</p>}
        </div>
      )}
    </Modal>
  );
}

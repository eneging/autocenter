import { Pencil } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, Loading, Modal } from '../../components/ui';
import { Client } from '../../types';

export function ClientsView() {
  const { data = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: async () => (await api.get<Client[]>('/clients')).data });
  const [editing, setEditing] = useState<Client | null>(null);
  if (isLoading) return <Loading />;

  return (
    <>
      <section className="table-panel">
        <table className="stack-on-mobile">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>N. documento</th>
              <th>Datos para facturar</th>
              <th>Contacto</th>
              <th>Proyectos</th>
              <th>Cotizaciones</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((client) => (
              <tr key={client.id}>
                <td data-label="Cliente">
                  <strong>{client.name}</strong>
                  <span>{client.company || 'Cliente particular'}</span>
                </td>
                <td data-label="N. documento">{client.document}</td>
                <td data-label="Datos para facturar">
                  {client.document_type && client.document_number ? (
                    <Badge label={`${client.document_type === '6' ? 'RUC' : 'DNI'} ${client.document_number}`} tone="success" />
                  ) : (
                    <Badge label="Falta completar" tone="danger" />
                  )}
                </td>
                <td data-label="Contacto">
                  {client.email}
                  <br />
                  {client.phone}
                </td>
                <td data-label="Proyectos">{client.projects_count}</td>
                <td data-label="Cotizaciones">{client.quotations_count}</td>
                <td>
                  <button className="ghost-button" onClick={() => setEditing(client)}>
                    <Pencil size={14} /> Editar cliente
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {editing && <ClientFormModal client={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ClientFormModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
      company: client.company ?? '',
      document_type: client.document_type ?? '1',
      document_number: client.document_number ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: unknown) => api.put(`/clients/${client.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
  });

  return (
    <Modal title={`Editar cliente — ${client.name}`} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label>
          Nombre
          <input {...register('name', { required: true })} />
        </label>
        <label>
          Correo
          <input type="email" {...register('email')} />
        </label>
        <label>
          Telefono
          <input {...register('phone')} />
        </label>
        <label>
          Empresa (opcional)
          <input {...register('company')} />
        </label>
        <label>
          Direccion
          <input {...register('address')} />
        </label>
        <label>
          Tipo de documento (para facturar)
          <select {...register('document_type')}>
            <option value="1">DNI</option>
            <option value="6">RUC</option>
          </select>
        </label>
        <label>
          Numero de documento
          <input {...register('document_number')} placeholder="Ej: 45891230" />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            Guardar cambios
          </button>
        </div>
      </form>
    </Modal>
  );
}

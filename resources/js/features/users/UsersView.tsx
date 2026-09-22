import { Key, Pencil, Plus, ShieldX, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../../apiClient';
import { Badge, ConfirmModal, Loading, Modal, useToast } from '../../components/ui';
import { Client, Worker } from '../../types';

const ROLE_LABELS: Record<string, string> = {
  Administrador: 'Administrador',
  Trabajador: 'Trabajador',
  Cliente: 'Cliente',
  'Community Manager': 'Encargado de redes sociales',
};

const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

type AdminUser = {
  id: number | null;
  name: string;
  email: string | null;
  is_active: boolean;
  roles: string[];
  worker: Worker | null;
  client: Client | null;
  has_login: boolean;
};

export function UsersView() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get<AdminUser[]>('/users')).data });
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [grantingAccessFor, setGrantingAccessFor] = useState<Worker | null>(null);

  const toggleActive = useMutation({
    mutationFn: ({ user, active }: { user: AdminUser; active: boolean }) =>
      active
        ? api.put(`/users/${user.id}`, { name: user.name, email: user.email, is_active: true })
        : api.post(`/users/${user.id}/deactivate`),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeactivatingUser(null);
      notify(variables.active ? 'Usuario reactivado correctamente' : 'Usuario desactivado correctamente');
    },
    onError: () => notify('No se pudo actualizar el usuario. Intenta de nuevo.', 'error'),
  });

  const deleteUser = useMutation({
    mutationFn: (user: AdminUser) => api.delete(`/users/${user.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeletingUser(null);
      notify('Usuario eliminado correctamente');
    },
    onError: (err) =>
      notify(
        axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo eliminar el usuario.' : 'No se pudo eliminar el usuario.',
        'error',
      ),
  });

  const toggleWorkerActive = useMutation({
    mutationFn: ({ worker, active }: { worker: Worker; active: boolean }) =>
      api.put(`/workers/${worker.id}`, {
        name: worker.name,
        role: worker.role,
        phone: worker.phone,
        hourly_rate: Number(worker.hourly_rate ?? 0),
        is_active: active,
      }),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      notify(variables.active ? 'Trabajador reactivado correctamente' : 'Trabajador desactivado correctamente');
    },
    onError: () => notify('No se pudo actualizar el trabajador. Intenta de nuevo.', 'error'),
  });

  if (isLoading) return <Loading />;

  return (
    <>
      <button
        className="primary-button"
        onClick={() => {
          setEditingUser(null);
          setFormOpen(true);
        }}
      >
        <Plus size={17} /> Nuevo usuario
      </button>
      <section className="table-panel">
        <table className="stack-on-mobile">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((user) => (
              <tr key={user.id ?? `worker-${user.worker!.id}`}>
                <td data-label="Nombre">{user.name}</td>
                <td data-label="Correo">
                  {user.has_login ? user.email : <Badge label="Sin acceso al sistema" tone="normal" />}
                </td>
                <td data-label="Rol">{user.roles.map(roleLabel).join(', ')}</td>
                <td data-label="Estado">
                  <Badge label={user.is_active ? 'Activo' : 'Inactivo'} tone={user.is_active ? 'success' : 'danger'} />
                </td>
                <td>
                  <div className="card-actions">
                    <button
                      className="ghost-button"
                      onClick={() => {
                        setEditingUser(user);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    {user.has_login ? (
                      <>
                        <button
                          className="ghost-button"
                          onClick={() =>
                            user.is_active ? setDeactivatingUser(user) : toggleActive.mutate({ user, active: true })
                          }
                        >
                          {user.is_active ? <ShieldX size={14} /> : <Plus size={14} />} {user.is_active ? 'Desactivar' : 'Reactivar'}
                        </button>
                        <button className="ghost-button ghost-button-danger" onClick={() => setDeletingUser(user)}>
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="ghost-button"
                          onClick={() => toggleWorkerActive.mutate({ worker: user.worker!, active: !user.is_active })}
                        >
                          {user.is_active ? <Trash2 size={14} /> : <Plus size={14} />} {user.is_active ? 'Desactivar' : 'Reactivar'}
                        </button>
                        <button className="ghost-button ghost-button-accent" onClick={() => setGrantingAccessFor(user.worker)}>
                          <Key size={14} /> Dar acceso
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {formOpen && <UserFormModal user={editingUser} onClose={() => setFormOpen(false)} />}
      {deactivatingUser && (
        <ConfirmModal
          title="Desactivar usuario"
          message={`${deactivatingUser.name} no podra iniciar sesion hasta que reactives su cuenta.`}
          confirmLabel="Desactivar"
          pending={toggleActive.isPending}
          onConfirm={() => toggleActive.mutate({ user: deactivatingUser, active: false })}
          onClose={() => setDeactivatingUser(null)}
        />
      )}
      {grantingAccessFor && <GrantAccessModal worker={grantingAccessFor} onClose={() => setGrantingAccessFor(null)} />}
      {deletingUser && (
        <ConfirmModal
          title="Eliminar usuario"
          message={`¿Seguro que quieres eliminar a ${deletingUser.name}? Esta accion es permanente y no se puede deshacer.`}
          confirmLabel="Eliminar definitivamente"
          pending={deleteUser.isPending}
          onConfirm={() => deleteUser.mutate(deletingUser)}
          onClose={() => setDeletingUser(null)}
        />
      )}
    </>
  );
}

function GrantAccessModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm({ defaultValues: { email: '', password: '' } });

  const mutation = useMutation({
    mutationFn: (payload: unknown) => api.post(`/workers/${worker.id}/grant-access`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify(`${worker.name} ya puede iniciar sesion en el sistema`);
      onClose();
    },
    onError: (err) =>
      setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo dar acceso.' : 'No se pudo dar acceso.'),
  });

  return (
    <Modal title={`Dar acceso al sistema a ${worker.name}`} onClose={onClose} narrow>
      <form className="form-grid" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {error && <p className="login-error" style={{ gridColumn: '1 / -1' }}>{error}</p>}
        <label>
          Correo
          <input type="email" {...register('email', { required: true })} />
        </label>
        <label>
          Contrasena
          <input type="password" {...register('password', { required: true, minLength: 6 })} />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            Crear acceso
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UserFormModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const isEdit = !!user;
  const queryClient = useQueryClient();
  const notify = useToast();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch } = useForm({
    defaultValues: isEdit
      ? {
          name: user!.name,
          email: user!.email,
          password: '',
          is_active: user!.is_active,
          role: user!.roles[0] ?? 'Trabajador',
          phone: user!.worker?.phone ?? user!.client?.phone ?? '',
          worker_role: user!.worker?.role ?? '',
          hourly_rate: user!.worker?.hourly_rate ?? '',
          document: user!.client?.document ?? '',
          address: user!.client?.address ?? '',
          company: user!.client?.company ?? '',
        }
      : {
          name: '',
          email: '',
          password: '',
          role: 'Trabajador',
          phone: '',
          worker_role: '',
          hourly_rate: '',
          document: '',
          address: '',
          company: '',
        },
  });
  const isOrphanEdit = isEdit && !user!.has_login;
  const role = !isOrphanEdit ? String(watch('role' as never) ?? '') : null;
  const isWorkerFields = role === 'Trabajador';
  const isClientFields = role === 'Cliente';

  const mutation = useMutation({
    mutationFn: (payload: unknown) => {
      if (isOrphanEdit) {
        const values = payload as { name: string; worker_role: string; phone: string; hourly_rate: number | ''; is_active: boolean };
        return api.put(`/workers/${user!.worker!.id}`, {
          name: values.name,
          role: values.worker_role,
          phone: values.phone || null,
          hourly_rate: Number(values.hourly_rate || 0),
          is_active: values.is_active,
        });
      }
      return isEdit ? api.put(`/users/${user!.id}`, payload) : api.post('/users', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      notify(isEdit ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
      onClose();
    },
    onError: (err) =>
      setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo guardar el usuario.' : 'No se pudo guardar el usuario.'),
  });

  return (
    <Modal title={isEdit ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {error && <p className="login-error" style={{ gridColumn: '1 / -1' }}>{error}</p>}
        {isOrphanEdit && (
          <p className="finance-hint" style={{ gridColumn: '1 / -1' }}>
            Este trabajador no tiene cuenta de acceso al sistema (no puede iniciar sesion). Usa "Dar acceso" en la lista si necesita entrar.
          </p>
        )}
        <label>
          Nombre
          <input {...register('name', { required: true })} />
        </label>
        {!isOrphanEdit && (
          <>
            <label>
              Correo
              <input type="email" {...register('email', { required: true })} />
            </label>
            <label>
              {isEdit ? 'Nueva contrasena (opcional)' : 'Contrasena'}
              <input type="password" {...register('password', { required: !isEdit, minLength: 6 })} />
            </label>
          </>
        )}
        {!isOrphanEdit && (
          <label>
            Rol
            <select {...register('role')}>
              <option value="Administrador">Administrador</option>
              <option value="Trabajador">Trabajador</option>
              <option value="Cliente">Cliente</option>
              <option value="Community Manager">Encargado de redes sociales</option>
            </select>
          </label>
        )}
        {(isWorkerFields || isClientFields) && (
          <label>
            Telefono
            <input {...register('phone')} />
          </label>
        )}
        {isWorkerFields && (
          <>
            <label>
              Oficio
              <input placeholder="Ej: Acabados" {...register('worker_role')} />
            </label>
            <label>
              Pago por hora
              <input type="number" step="0.01" min="0" placeholder="Ej: 15" {...register('hourly_rate')} />
            </label>
          </>
        )}
        {isClientFields && (
          <>
            <label>
              Documento
              <input {...register('document')} />
            </label>
            <label>
              Direccion
              <input {...register('address')} />
            </label>
            <label>
              Empresa
              <input {...register('company')} />
            </label>
          </>
        )}
        {isEdit && (
          <label className="checkbox-label">
            <input type="checkbox" {...register('is_active')} /> {isOrphanEdit ? 'Trabajador activo' : 'Cuenta activa'}
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

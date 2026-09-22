import { Dices, Pencil, Plus, Ticket, Trash2, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, ConfirmModal, Loading, Modal, useToast } from '../../components/ui';
import { errorMessage, formatDate, formatDateTime } from '../../lib/taller';
import type { Promotion, PromotionEntry } from '../../types-taller';

const TYPE_LABEL: Record<Promotion['type'], string> = { evento: 'Evento', sorteo: 'Sorteo', cupon: 'Cupón de descuento' };

export function PromotionsAdminView() {
  const [editing, setEditing] = useState<Promotion | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [entriesOf, setEntriesOf] = useState<Promotion | null>(null);

  const { data = [], isLoading } = useQuery({ queryKey: ['promotions-admin'], queryFn: async () => (await api.get<Promotion[]>('/admin/promotions')).data });

  return (
    <>
      <div className="toolbar">
        <button className="primary-button" onClick={() => setEditing('new')}>
          <Plus size={17} /> Nueva promoción
        </button>
        <CouponLookup />
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Promoción</th>
                <th>Tipo</th>
                <th>Vigencia</th>
                <th>Registrados</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((promotion) => (
                <tr key={promotion.id}>
                  <td data-label="Promoción">
                    <strong>{promotion.title}</strong>
                    {promotion.type === 'cupon' && <span>{promotion.discount_percent}% de descuento</span>}
                    {promotion.winner && <span>Ganador: {promotion.winner.name}</span>}
                  </td>
                  <td data-label="Tipo">{TYPE_LABEL[promotion.type]}</td>
                  <td data-label="Vigencia">
                    {promotion.starts_at ? formatDate(promotion.starts_at) : 'Ya'} → {promotion.ends_at ? formatDate(promotion.ends_at) : 'sin fin'}
                  </td>
                  <td data-label="Registrados">{promotion.entries_count}</td>
                  <td data-label="Estado">
                    <Badge label={promotion.is_active ? 'Activa' : 'Pausada'} tone={promotion.is_active ? 'success' : 'normal'} />
                  </td>
                  <td>
                    <div className="card-actions">
                      <button className="ghost-button" onClick={() => setEntriesOf(promotion)}>
                        <Users size={14} /> Participantes
                      </button>
                      <button className="ghost-button" onClick={() => setEditing(promotion)}>
                        <Pencil size={14} />
                      </button>
                      <button className="ghost-button ghost-button-danger" onClick={() => setDeleting(promotion)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6}>Todavía no hay promociones.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {editing && <PromotionFormModal promotion={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {entriesOf && <EntriesModal promotion={entriesOf} onClose={() => setEntriesOf(null)} />}
      {deleting && <DeletePromotionModal promotion={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

function CouponLookup() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<(PromotionEntry & { promotion?: { title: string; discount_percent: number | null } }) | null>(null);

  const lookup = async () => {
    try {
      const { data } = await api.get('/coupons/lookup', { params: { code } });
      setFound(data);
    } catch (error) {
      setFound(null);
      notify(errorMessage(error, 'Cupón no encontrado.'), 'error');
    }
  };

  const redeem = useMutation({
    mutationFn: async () => (await api.post(`/promotion-entries/${found?.id}/redeem`)).data,
    onSuccess: (entry) => {
      notify('Cupón canjeado.');
      setFound((current) => (current ? { ...current, redeemed_at: entry.redeemed_at } : current));
      queryClient.invalidateQueries({ queryKey: ['promotions-admin'] });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <div className="coupon-lookup">
      <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Validar cupón (CAC-XXXXXX)" />
      <button className="ghost-button" onClick={lookup} disabled={!code.trim()}>
        <Ticket size={14} /> Validar
      </button>
      {found && (
        <span className="coupon-result">
          {found.name} · {found.promotion?.discount_percent}% dto.{' '}
          {found.redeemed_at ? (
            <Badge label="Ya canjeado" tone="danger" />
          ) : (
            <button className="primary-button" onClick={() => redeem.mutate()} disabled={redeem.isPending}>
              Canjear
            </button>
          )}
        </span>
      )}
    </div>
  );
}

type PromotionForm = { type: Promotion['type']; title: string; description: string; image_url: string; discount_percent: string; coupon_prefix: string; starts_at: string; ends_at: string; is_active: boolean };

const toLocalInput = (value: string | null) => (value ? value.slice(0, 16) : '');

function PromotionFormModal({ promotion, onClose }: { promotion: Promotion | null; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch } = useForm<PromotionForm>({
    defaultValues: {
      type: promotion?.type ?? 'cupon',
      title: promotion?.title ?? '',
      description: promotion?.description ?? '',
      image_url: promotion?.image_url ?? '',
      discount_percent: promotion?.discount_percent ? String(promotion.discount_percent) : '',
      coupon_prefix: promotion?.coupon_prefix ?? '',
      starts_at: toLocalInput(promotion?.starts_at ?? null),
      ends_at: toLocalInput(promotion?.ends_at ?? null),
      is_active: promotion?.is_active ?? true,
    },
  });
  const type = watch('type');

  const mutation = useMutation({
    mutationFn: async (values: PromotionForm) => {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' ? null : value]));
      return promotion ? api.put(`/admin/promotions/${promotion.id}`, payload) : api.post('/admin/promotions', payload);
    },
    onSuccess: () => {
      notify('Promoción guardada.');
      queryClient.invalidateQueries({ queryKey: ['promotions-admin'] });
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title={promotion ? 'Editar promoción' : 'Nueva promoción'} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label>
          Tipo
          <select {...register('type')}>
            <option value="cupon">Cupón de descuento</option>
            <option value="sorteo">Sorteo</option>
            <option value="evento">Evento</option>
          </select>
        </label>
        <label>
          Título
          <input {...register('title', { required: true })} />
        </label>
        <label>
          Descripción
          <textarea rows={3} {...register('description')} />
        </label>
        <label>
          Imagen (URL, opcional)
          <input {...register('image_url')} />
        </label>
        {type === 'cupon' && (
          <>
            <label>
              Descuento (%)
              <input type="number" min={1} max={100} {...register('discount_percent', { required: true })} />
            </label>
            <label>
              Prefijo del código
              <input {...register('coupon_prefix')} maxLength={12} placeholder="CAC" />
            </label>
          </>
        )}
        <label>
          Inicio
          <input type="datetime-local" {...register('starts_at')} />
        </label>
        <label>
          Fin
          <input type="datetime-local" {...register('ends_at')} />
        </label>
        <label className="check-inline">
          <input type="checkbox" {...register('is_active')} /> Visible en la página
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

function EntriesModal({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['promotion-entries', promotion.id], queryFn: async () => (await api.get<PromotionEntry[]>(`/admin/promotions/${promotion.id}/entries`)).data });

  const draw = useMutation({
    mutationFn: async () => (await api.post<Promotion>(`/admin/promotions/${promotion.id}/draw`)).data,
    onSuccess: (updated) => {
      notify(`Ganador: ${updated.winner?.name}`);
      queryClient.invalidateQueries({ queryKey: ['promotions-admin'] });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title={`Participantes · ${promotion.title}`} onClose={onClose} wide>
      {promotion.type === 'sorteo' && !promotion.winner_entry_id && (
        <div className="toolbar">
          <button className="primary-button" disabled={draw.isPending || data.length === 0} onClick={() => draw.mutate()}>
            <Dices size={16} /> Sortear ganador
          </button>
        </div>
      )}
      {isLoading ? (
        <Loading />
      ) : (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Cupón</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Nombre">
                    {entry.name}
                    {promotion.winner_entry_id === entry.id && <Badge label="Ganador" tone="success" />}
                  </td>
                  <td data-label="Teléfono">{entry.phone}</td>
                  <td data-label="Correo">{entry.email ?? '—'}</td>
                  <td data-label="Cupón">{entry.coupon_code ? `${entry.coupon_code}${entry.redeemed_at ? ' (canjeado)' : ''}` : '—'}</td>
                  <td data-label="Registro">{formatDateTime(entry.created_at)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5}>Aún no hay participantes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </Modal>
  );
}

function DeletePromotionModal({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => api.delete(`/admin/promotions/${promotion.id}`),
    onSuccess: () => {
      notify('Promoción eliminada.');
      queryClient.invalidateQueries({ queryKey: ['promotions-admin'] });
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return <ConfirmModal title="Eliminar promoción" message={`¿Eliminar "${promotion.title}" y todos sus registros?`} pending={mutation.isPending} onConfirm={() => mutation.mutate()} onClose={onClose} />;
}

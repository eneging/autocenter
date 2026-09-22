import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../apiClient';
import { errorMessage } from '../lib/taller';
import type { Promotion } from '../types-taller';

type Registration = { message: string; coupon_code: string | null; discount_percent: number | null };

/** Sección pública: eventos, sorteos y cupones. Solo captura datos de quien completa el registro. */
export function PromotionsSection() {
  const { data = [] } = useQuery({ queryKey: ['public-promotions'], queryFn: async () => (await api.get<Promotion[]>('/promotions')).data });
  const [active, setActive] = useState<Promotion | null>(null);

  if (data.length === 0) return null;

  return (
    <section className="landing-section" id="promociones">
      <div className="landing-section-inner">
        <span className="landing-kicker">Promociones</span>
        <h2>Eventos, sorteos y descuentos</h2>
        <div className="landing-grid-3">
          {data.map((promotion) => (
            <article className="landing-card" key={promotion.id}>
              {promotion.image_url && <img src={promotion.image_url} alt={promotion.title} loading="lazy" />}
              <h3>{promotion.title}</h3>
              {promotion.type === 'cupon' && promotion.discount_percent && <strong>{promotion.discount_percent}% de descuento</strong>}
              {promotion.description && <p>{promotion.description}</p>}
              <button className="landing-card-button" onClick={() => setActive(promotion)}>
                {promotion.type === 'sorteo' ? 'Quiero participar' : promotion.type === 'cupon' ? 'Obtener mi cupón' : 'Registrarme'}
              </button>
            </article>
          ))}
        </div>
      </div>
      {active && <RegistrationDialog promotion={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function RegistrationDialog({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', accepted_terms: false });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => (await api.post<Registration>(`/promotions/${promotion.id}/register`, { ...form, email: form.email || null })).data,
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-narrow" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{promotion.title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {mutation.data ? (
          <div className="stack">
            <p>{mutation.data.message}</p>
            {mutation.data.coupon_code && (
              <div className="coupon-box">
                <small>Tu código</small>
                <strong>{mutation.data.coupon_code}</strong>
                <small>{mutation.data.discount_percent}% de descuento</small>
              </div>
            )}
            <button className="primary-button" onClick={onClose}>
              Listo
            </button>
          </div>
        ) : (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              mutation.mutate();
            }}
          >
            {error && <p className="login-error">{error}</p>}
            <label>
              Nombre completo
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label>
              Celular
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" required />
            </label>
            <label>
              Correo (opcional)
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={form.accepted_terms} onChange={(event) => setForm({ ...form, accepted_terms: event.target.checked })} required /> Acepto que usen mis datos para esta promoción
            </label>
            <button className="primary-button" disabled={mutation.isPending || !form.accepted_terms}>
              {mutation.isPending ? 'Enviando...' : 'Confirmar registro'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

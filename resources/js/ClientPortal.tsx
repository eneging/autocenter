import { AlertTriangle, Check, MapPin, MessageCircle, Phone, Star } from 'lucide-react';
import React, { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, APP_NAME, LOGO_URL } from './apiClient';
import { Badge, Loading, PanelTitle, useToast } from './components/ui';
import { money } from './lib/constants';
import { errorMessage, formatDate, formatDateTime, ORDER_STATUSES, statusTone } from './lib/taller';
import { whatsappNumber } from './lib/publicSite';
import type { OrderStatus, PublicTracking } from './types-taller';

function TrackingSteps({ status }: { status: OrderStatus }) {
  const currentIndex = ORDER_STATUSES.indexOf(status);

  return (
    <div className="tracking-steps">
      {ORDER_STATUSES.map((step, index) => {
        const state = index < currentIndex || status === 'Finalizado' ? 'done' : index === currentIndex ? 'current' : 'upcoming';
        return (
          <div className={`tracking-step is-${state}`} key={step}>
            <span className="tracking-step-dot">{state === 'done' ? <Check size={14} /> : index + 1}</span>
            <span className="tracking-step-label">{step}</span>
          </div>
        );
      })}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="tracking-detail">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function FeedbackForm({ token }: { token: string }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);

  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/tracking/${token}/comment`, { comment, rating: rating || null })).data,
    onSuccess: () => {
      notify('¡Gracias por tu comentario!');
      queryClient.invalidateQueries({ queryKey: ['tracking', token] });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="star-rating" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((value) => (
          <button type="button" key={value} className={value <= rating ? 'is-on' : ''} onClick={() => setRating(value)} aria-label={`${value} estrellas`}>
            <Star size={22} fill={value <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <label>
        Cuéntanos cómo fue tu experiencia
        <textarea rows={4} value={comment} onChange={(event) => setComment(event.target.value)} minLength={3} maxLength={1500} required />
      </label>
      <button className="primary-button" disabled={mutation.isPending || comment.trim().length < 3}>
        {mutation.isPending ? 'Enviando...' : 'Enviar comentario'}
      </button>
    </form>
  );
}

export function ClientPortalView() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tracking', token],
    queryFn: async () => (await api.get<PublicTracking>(`/tracking/${token}`)).data,
    retry: false,
    enabled: !!token,
    // El taller sube fotos y notas mientras trabaja: se actualiza solo mientras la orden sigue abierta.
    refetchInterval: (query) => (query.state.data?.order.status === 'Finalizado' ? false : 30_000),
  });

  const finished = data?.order.status === 'Finalizado';
  const wa = data?.shop.whatsapp ? whatsappNumber(data.shop.whatsapp) : null;

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-brand">
          <img src={LOGO_URL} alt={APP_NAME} />
          <span>{data?.shop.name ?? APP_NAME}</span>
        </div>
        <nav>
          <RouterLink to="/" className="ghost-button">
            Volver al inicio
          </RouterLink>
        </nav>
      </header>

      <section className="complaint-hero">
        <h1>Seguimiento de tu vehículo</h1>
        <p>Mira en tiempo real cómo avanza el servicio, con fotos y notas de nuestro técnico. No necesitas crear una cuenta.</p>
      </section>

      <section className="complaint-book-page">
        {isLoading && <Loading />}

        {isError && (
          <div className="panel complaint-book-success">
            <AlertTriangle size={40} color="var(--danger)" />
            <h2>Este enlace no es válido</h2>
            <p>El enlace de seguimiento no existe o ya no está disponible. Comunícate con el taller si necesitas ayuda.</p>
          </div>
        )}

        {data && (
          <div className="stack">
            <article className="panel tracking-vehicle">
              <div>
                <span className="code">{data.order.code}</span>
                <h2>
                  {data.vehicle ? `${data.vehicle.brand} ${data.vehicle.model}` : 'Tu vehículo'}
                  {data.vehicle && <span className="plate-chip">{data.vehicle.plate}</span>}
                </h2>
                <p>
                  {data.client_name && <>Cliente: {data.client_name} · </>}
                  Técnico: {data.order.technician ?? 'Por asignar'}
                </p>
                {data.order.service_type && <Badge label={data.order.service_type} tone="normal" />}
              </div>
              <Badge label={data.order.status} tone={statusTone(data.order.status)} />
            </article>

            <section className="panel">
              <PanelTitle title="Estado del servicio" subtitle="En qué etapa está tu vehículo ahora mismo" />
              <TrackingSteps status={data.order.status} />
              <div className="progress tracking-fine-progress">
                <span style={{ width: `${data.order.progress}%` }} />
              </div>
              <small className="tracking-fine-progress-note">{data.order.progress}% de avance</small>
            </section>

            <section className="panel">
              <PanelTitle title="Detalle" subtitle="Lo que reportaste y lo que encontró el técnico" />
              <div className="tracking-details">
                <Detail label="Problema reportado" value={data.order.problem_description} />
                <Detail label="Diagnóstico técnico" value={data.order.technical_diagnostic} />
                <Detail label="Solución" value={data.order.solution} />
                <Detail label="Tiempo estimado" value={data.order.estimated_time} />
                <Detail label="Fecha de ingreso" value={data.order.entry_date ? formatDate(data.order.entry_date) : null} />
                <Detail label="Entrega estimada" value={data.order.estimated_delivery_at ? formatDate(data.order.estimated_delivery_at) : null} />
                <Detail label="Fecha de salida" value={data.order.exit_date ? formatDate(data.order.exit_date) : null} />
              </div>
            </section>

            <section className="panel">
              <PanelTitle title="Avance del trabajo" subtitle="Fotos y notas del técnico, de lo más reciente a lo más antiguo" />
              {data.timeline.length === 0 ? (
                <p className="field-hint">Aún no hay novedades.</p>
              ) : (
                <ol className="timeline">
                  {data.timeline.map((entry) => (
                    <li key={entry.id}>
                      <span className="timeline-dot" />
                      <div className="timeline-body">
                        <time>{formatDateTime(entry.created_at)}</time>
                        {entry.annotation && <p>{entry.annotation}</p>}
                        {entry.image && (
                          <a href={entry.image} target="_blank" rel="noopener noreferrer">
                            <img src={entry.image} alt="Foto del avance" loading="lazy" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {finished && data.receipt && (
              <section className="panel receipt-panel">
                <PanelTitle title="Recibo de servicio finalizado" subtitle={`Orden ${data.order.code}${data.order.exit_date ? ` · salida ${formatDate(data.order.exit_date)}` : ''}`} />
                <table className="receipt-table">
                  <tbody>
                    <tr>
                      <td>Servicio{data.order.service_type ? ` (${data.order.service_type})` : ''}</td>
                      <td className="num">{money(data.receipt.service_budget)}</td>
                    </tr>
                    {data.receipt.parts.map((part, index) => (
                      <tr key={index}>
                        <td>
                          {part.name} × {part.quantity}
                        </td>
                        <td className="num">{money(part.subtotal)}</td>
                      </tr>
                    ))}
                    <tr className="receipt-total">
                      <td>Total</td>
                      <td className="num">{money(data.receipt.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )}

            {finished && (
              <section className="panel">
                <PanelTitle title="Tu opinión" subtitle="Ayúdanos a mejorar" />
                {data.feedback.submitted ? (
                  <div className="feedback-done">
                    <Check size={20} /> Ya recibimos tu comentario. ¡Gracias!
                    {data.feedback.rating ? <div className="star-rating is-static">{'★'.repeat(data.feedback.rating)}</div> : null}
                    {data.feedback.comment && <blockquote>{data.feedback.comment}</blockquote>}
                  </div>
                ) : (
                  token && <FeedbackForm token={token} />
                )}
              </section>
            )}

            <section className="panel tracking-shop">
              <PanelTitle title={data.shop.name ?? APP_NAME} subtitle="Contacto del taller" />
              <ul>
                {data.shop.address && (
                  <li>
                    <MapPin size={16} /> {data.shop.address}
                  </li>
                )}
                {data.shop.phone && (
                  <li>
                    <Phone size={16} /> {data.shop.phone}
                  </li>
                )}
                {wa && (
                  <li>
                    <MessageCircle size={16} />
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                      Escribir por WhatsApp
                    </a>
                  </li>
                )}
              </ul>
            </section>
          </div>
        )}
      </section>

      <footer className="landing-footer">
        <span>
          © {new Date().getFullYear()} {data?.shop.name ?? APP_NAME}
        </span>
      </footer>
    </div>
  );
}

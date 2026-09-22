import { Download, MessageSquareWarning } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, Loading, Modal, PanelTitle } from '../../components/ui';

type ComplaintBookEntry = {
  id: number;
  code: string;
  tipo: 'reclamo' | 'queja';
  bien_tipo: 'producto' | 'servicio';
  monto_reclamado: string | null;
  bien_descripcion: string;
  consumidor_nombre: string;
  consumidor_domicilio: string;
  consumidor_documento: string;
  consumidor_telefono: string | null;
  consumidor_email: string;
  es_menor: boolean;
  representante_nombre: string | null;
  detalle: string;
  pedido: string;
  respuesta_texto: string | null;
  respuesta_fecha: string | null;
  estado: 'pendiente' | 'respondido';
  plazo_respuesta: string;
  access_token: string;
  created_at: string;
};

export function ComplaintBookAdminView() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['complaint-book'],
    queryFn: async () => (await api.get<ComplaintBookEntry[]>('/complaint-book')).data,
  });
  const [selected, setSelected] = useState<ComplaintBookEntry | null>(null);

  const downloadPdf = async (entry: ComplaintBookEntry) => {
    const response = await api.get(`/complaint-book/${entry.id}/pdf`, {
      params: { token: entry.access_token },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hoja-reclamacion-${entry.code}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Loading />;

  return (
    <>
      <section className="panel settings-section settings-section-important">
        <div className="settings-section-header">
          <MessageSquareWarning size={18} />
          <PanelTitle
            title="Libro de Reclamaciones"
            subtitle="Reclamos y quejas registrados por consumidores. Plazo legal de respuesta: 15 dias habiles improrrogables."
          />
        </div>
        <div className="stack">
          {entries.map((entry) => {
            const overdue = entry.estado === 'pendiente' && new Date(entry.plazo_respuesta) < new Date();
            return (
              <article className={`list-item ${entry.estado === 'pendiente' ? 'quote-card' : 'quote-card is-accepted'}`} key={entry.id}>
                <div className="list-item-heading">
                  <strong>
                    {entry.code} · {entry.consumidor_nombre}
                  </strong>
                  <div className="badge-row" style={{ margin: 0 }}>
                    <Badge label={entry.tipo === 'queja' ? 'Queja' : 'Reclamo'} tone="normal" />
                    <Badge label={entry.estado === 'respondido' ? 'Respondido' : overdue ? 'Vencido' : 'Pendiente'} tone={entry.estado === 'respondido' ? 'success' : overdue ? 'danger' : 'normal'} />
                  </div>
                </div>
                <span>{entry.bien_descripcion}</span>
                <div className="card-actions">
                  <button className="ghost-button" onClick={() => setSelected(entry)}>
                    Ver y responder
                  </button>
                  <button className="ghost-button" onClick={() => downloadPdf(entry)}>
                    <Download size={14} /> PDF
                  </button>
                </div>
              </article>
            );
          })}
          {entries.length === 0 && <span>Aun no hay reclamos ni quejas registrados.</span>}
        </div>
      </section>

      {selected && <ComplaintDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ComplaintDetailModal({ entry, onClose }: { entry: ComplaintBookEntry; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm({ defaultValues: { respuesta_texto: entry.respuesta_texto ?? '' } });

  const respondMutation = useMutation({
    mutationFn: (respuesta_texto: string) => api.put(`/complaint-book/${entry.id}/respond`, { respuesta_texto }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint-book'] });
      onClose();
    },
  });

  return (
    <Modal title={`${entry.code} · ${entry.tipo === 'queja' ? 'Queja' : 'Reclamo'}`} onClose={onClose} wide>
      <div className="stack">
        <div>
          <span className="label-title">Consumidor</span>
          <p>
            {entry.consumidor_nombre} · {entry.consumidor_documento} · {entry.consumidor_domicilio}
            <br />
            {entry.consumidor_telefono ? `${entry.consumidor_telefono} · ` : ''}
            {entry.consumidor_email}
            {entry.es_menor && entry.representante_nombre && (
              <>
                <br />
                Representante: {entry.representante_nombre}
              </>
            )}
          </p>
        </div>
        <div>
          <span className="label-title">Bien contratado ({entry.bien_tipo})</span>
          <p>
            {entry.bien_descripcion}
            {entry.monto_reclamado ? ` · Monto reclamado: S/ ${Number(entry.monto_reclamado).toFixed(2)}` : ''}
          </p>
        </div>
        <div>
          <span className="label-title">Detalle</span>
          <p>{entry.detalle}</p>
        </div>
        <div>
          <span className="label-title">Solicitud del consumidor</span>
          <p>{entry.pedido}</p>
        </div>
        <div>
          <span className="label-title">Plazo legal de respuesta</span>
          <p>{new Date(entry.plazo_respuesta).toLocaleDateString('es-PE')}</p>
        </div>

        <form
          className="form-grid"
          onSubmit={handleSubmit((values) => respondMutation.mutate(values.respuesta_texto))}
        >
          <label>
            Respuesta al consumidor
            <textarea rows={5} {...register('respuesta_texto', { required: true })} disabled={entry.estado === 'respondido'} />
          </label>
          {entry.estado === 'respondido' ? (
            <p>Respondido el {entry.respuesta_fecha ? new Date(entry.respuesta_fecha).toLocaleDateString('es-PE') : ''}.</p>
          ) : (
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={onClose}>
                Cerrar
              </button>
              <button className="primary-button" disabled={respondMutation.isPending}>
                Enviar respuesta
              </button>
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
}

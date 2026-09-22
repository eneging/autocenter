import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, Modal } from '../../components/ui';
import { Project } from '../../types';

type CalendarEventItem = {
  id: number;
  title: string;
  starts_at: string;
  project?: Project;
};

export function CalendarView() {
  const { data = [] } = useQuery({ queryKey: ['calendar-events'], queryFn: async () => (await api.get<CalendarEventItem[]>('/calendar-events')).data });
  const [selected, setSelected] = useState<CalendarEventItem | null>(null);

  return (
    <section className="panel calendar-panel">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        locale={esLocale}
        firstDay={1}
        buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Dia' }}
        events={data.map((event) => ({ id: String(event.id), title: event.title, date: event.starts_at, extendedProps: { event } }))}
        eventClick={(info) => setSelected(info.event.extendedProps.event as CalendarEventItem)}
        height="auto"
      />
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)} narrow>
          <p>
            <strong>Fecha:</strong> {new Date(selected.starts_at).toLocaleString('es-PE')}
          </p>
          {selected.project ? (
            <>
              <p>
                <strong>Proyecto:</strong> {selected.project.code} - {selected.project.name}
              </p>
              <p>
                <strong>Cliente:</strong> {selected.project.client.name}
              </p>
              <div className="badge-row">
                <Badge label={selected.project.status} tone={selected.project.status === 'Entregado' ? 'success' : 'normal'} />
                <Badge label={`${selected.project.progress}%`} tone="normal" />
              </div>
              <small>Entrega estimada: {selected.project.estimated_delivery_at}</small>
            </>
          ) : (
            <p>Este evento no tiene un proyecto asociado.</p>
          )}
        </Modal>
      )}
    </section>
  );
}

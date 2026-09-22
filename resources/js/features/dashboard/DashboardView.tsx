import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { IncomeExpenseChart } from '../../components/charts';
import { Loading, Metric, PanelTitle } from '../../components/ui';
import { money } from '../../lib/constants';
import { Dashboard, Project } from '../../types';

export function DashboardView() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get<Dashboard>('/dashboard')).data });

  if (isLoading || !data) return <Loading />;

  return (
    <>
      <div className="metric-grid">
        <Metric label="Total proyectos" value={data.metrics.totalProjects} />
        <Metric label="Activos" value={data.metrics.activeProjects} />
        <Metric label="Terminados" value={data.metrics.finishedProjects} />
        <Metric label="Retrasados" value={data.metrics.delayedProjects} danger />
        <Metric label="Cotizaciones" value={data.metrics.pendingQuotations} />
        <Metric label="Trabajadores" value={data.metrics.activeWorkers} />
        <Metric label="Ingresos del mes" value={money(data.metrics.monthIncome)} />
        <Metric label="Egresos del mes" value={money(data.metrics.monthExpenses)} />
      </div>
      <div className="content-grid">
        <section className="panel panel-wide">
          <PanelTitle title="Ingresos y egresos" subtitle="Lectura ejecutiva de los ultimos 6 meses" />
          <IncomeExpenseChart data={data.chart} />
        </section>
        <section className="panel">
          <PanelTitle title="Atender primero" subtitle="Ordenado por prioridad inteligente" />
          <div className="stack">
            {data.priorityList.map((project) => (
              <PriorityItem project={project} key={project.id} />
            ))}
          </div>
        </section>
      </div>
      <div className="content-grid">
        <section className="panel">
          <PanelTitle title="Proximos vencimientos" subtitle="Entregas que requieren seguimiento" />
          <Timeline projects={data.upcomingDeadlines} />
        </section>
        <section className="panel">
          <PanelTitle title="Actividad reciente" subtitle="Cambios y movimientos del equipo" />
          <div className="stack">
            {data.recentActivity.map((item) => (
              <article className="list-item" key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function PriorityItem({ project }: { project: Project }) {
  return (
    <article className="list-item">
      <strong>{project.name}</strong>
      <span>{project.client.name} · {project.priority} · {project.status}</span>
    </article>
  );
}

function Timeline({ projects }: { projects: Project[] }) {
  return (
    <div className="stack">
      {projects.map((project) => (
        <article className="list-item" key={project.id}>
          <strong>{project.estimated_delivery_at} · {project.name}</strong>
          <span>{project.client.name} · {project.responsible?.name ?? 'Sin responsable'}</span>
        </article>
      ))}
    </div>
  );
}

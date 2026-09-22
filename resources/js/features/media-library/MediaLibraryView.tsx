import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Loading, PanelTitle } from '../../components/ui';
import { MediaLightbox, MediaThumb } from '../../components/ProjectMedia';
import { ProjectMedia } from '../../types';

export function MediaLibraryView() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [lightboxItem, setLightboxItem] = useState<ProjectMedia | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ['content-library'],
    queryFn: async () => (await api.get<ProjectMedia[]>('/content-library')).data,
  });

  const filtered = data.filter((item) => {
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const haystack = `${item.project?.code ?? ''} ${item.project?.name ?? ''}`.toLowerCase();
    return matchesType && haystack.includes(search.toLowerCase());
  });

  if (isLoading) return <Loading />;

  return (
    <section className="panel">
      <PanelTitle title="Galeria de fotos y videos" subtitle="Todo lo que se subio desde los proyectos, en un solo lugar" />
      <div className="embed-row" style={{ marginBottom: 16 }}>
        <input placeholder="Buscar por proyecto..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | 'image' | 'video')}>
          <option value="all">Todo</option>
          <option value="image">Fotos</option>
          <option value="video">Videos</option>
        </select>
      </div>

      {filtered.length === 0 && <p>No hay contenido que coincida con la busqueda.</p>}

      <div className="media-library-grid">
        {filtered.map((item) => (
          <article className="media-card" key={item.id}>
            <button type="button" className="media-tile-open media-tile" onClick={() => setLightboxItem(item)}>
              <MediaThumb item={item} />
            </button>
            <strong>{item.project ? `${item.project.code} - ${item.project.name}` : 'Proyecto'}</strong>
            <span>{new Date(item.created_at).toLocaleDateString('es-PE')}</span>
            <a className="ghost-button" href={item.drive_view_link} target="_blank" rel="noopener noreferrer">
              Ver en Google Drive
            </a>
          </article>
        ))}
      </div>
      {lightboxItem && <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}
    </section>
  );
}

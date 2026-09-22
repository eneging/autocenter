import {
  Building2,
  Calculator,
  Handshake,
  Images,
  Info,
  LayoutGrid,
  Layers,
  Link2,
  Pencil,
  Phone,
  Plug,
  Plus,
  Quote,
  Share2,
  Trash2,
  Upload,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../../apiClient';
import { Badge, ConfirmModal, Loading, Modal, PanelTitle, useToast } from '../../components/ui';

function uploadErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
}
import type { LucideIcon } from 'lucide-react';

type ListFieldConfig = { key: string; label: string; type: 'text' | 'textarea' | 'image' | 'number' | 'video'; hint?: string };

type SiteSettingsPayload = {
  id: number;
  company_name: string | null;
  company_ruc: string | null;
  tagline: string | null;
  project_role: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_images: string[] | null;
  about_text: string | null;
  about_video_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  contact_whatsapp: string | null;
  social_embeds: { platform: string; url: string }[] | null;
  community_platform: string | null;
  community_join_method: string | null;
  community_qr_url: string | null;
  bank_bcp_account: string | null;
  bank_cci_account: string | null;
  yape_number: string | null;
  yape_holder_name: string | null;
  manager_name: string | null;
  manager_title: string | null;
};

const SITE_TABS: { key: 'general' | 'services' | 'catalog' | 'testimonials' | 'gallery' | 'partners' | 'videos' | 'integrations'; label: string; icon: LucideIcon; accent: 'green' | 'gold' }[] = [
  { key: 'general', label: 'General', icon: Building2, accent: 'green' },
  { key: 'services', label: 'Servicios', icon: Layers, accent: 'gold' },
  { key: 'catalog', label: 'Catalogo y precios', icon: Calculator, accent: 'green' },
  { key: 'testimonials', label: 'Testimonios', icon: Quote, accent: 'green' },
  { key: 'gallery', label: 'Galeria', icon: Images, accent: 'gold' },
  { key: 'partners', label: 'Marcas y aliados', icon: Handshake, accent: 'green' },
  { key: 'videos', label: 'Videos', icon: Video, accent: 'green' },
  { key: 'integrations', label: 'Integraciones', icon: Plug, accent: 'gold' },
];

export function SiteAdminView() {
  const [tab, setTab] = useState<'general' | 'services' | 'catalog' | 'testimonials' | 'gallery' | 'partners' | 'videos' | 'integrations'>('general');

  return (
    <>
      <div className="site-tabs">
        {SITE_TABS.map(({ key, label, icon: Icon, accent }) => (
          <button
            key={key}
            className={`site-tab site-tab-${accent} ${tab === key ? 'is-active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === 'general' && <SiteGeneralForm />}
      {tab === 'integrations' && <GoogleIntegrationPanel />}
      {tab === 'services' && (
        <SortableListEditor
          title="Servicios"
          icon={Layers}
          accent="gold"
          endpoint="/site-services"
          queryKey="site-services"
          itemLabel={(item) => item.title}
          fields={[
            { key: 'title', label: 'Titulo', type: 'text' },
            { key: 'slug', label: 'Direccion propia (opcional)', type: 'text', hint: 'Si lo dejas vacio se genera solo, a partir del titulo. Ej: mantenimiento-electrico' },
            { key: 'description', label: 'Descripcion', type: 'textarea' },
            { key: 'icon_url', label: 'Imagen', type: 'image' },
            { key: 'video_url', label: 'Video (opcional)', type: 'video' },
          ]}
        />
      )}
      {tab === 'catalog' && (
        <SortableListEditor
          title="Catalogo y precios"
          icon={Calculator}
          accent="green"
          endpoint="/site-catalog"
          queryKey="site-catalog"
          itemLabel={(item) => `${item.category} · ${item.title}`}
          fields={[
            { key: 'category', label: 'Categoría (ej: Eléctrico, Mantenimiento, Frenos)', type: 'text' },
            { key: 'title', label: 'Nombre del item', type: 'text' },
            { key: 'unit_label', label: 'Unidad (ej: servicio, hora, litro)', type: 'text' },
            { key: 'price', label: 'Precio por unidad, en soles', type: 'number' },
            { key: 'description', label: 'Descripcion', type: 'textarea' },
            {
              key: 'measurement_hint',
              label: 'Indicación para el cliente (opcional)',
              type: 'textarea',
              hint: 'Se muestra cuando el cliente calcula el precio en la página de servicios. Ej: "Indica cuántas horas de trabajo estimas necesitar".',
            },
            { key: 'image_url', label: 'Imagen', type: 'image' },
          ]}
        />
      )}
      {tab === 'testimonials' && (
        <SortableListEditor
          title="Testimonios"
          icon={Quote}
          accent="green"
          endpoint="/site-testimonials"
          queryKey="site-testimonials"
          itemLabel={(item) => item.client_name}
          fields={[
            { key: 'client_name', label: 'Nombre del cliente', type: 'text' },
            { key: 'quote', label: 'Testimonio', type: 'textarea' },
            { key: 'avatar_url', label: 'Foto', type: 'image' },
          ]}
        />
      )}
      {tab === 'gallery' && (
        <SortableListEditor
          title="Galeria"
          icon={Images}
          accent="gold"
          endpoint="/site-gallery"
          queryKey="site-gallery"
          itemLabel={(item) => item.caption || 'Imagen'}
          fields={[
            { key: 'image_url', label: 'Imagen', type: 'image' },
            { key: 'caption', label: 'Descripcion', type: 'text' },
          ]}
        />
      )}
      {tab === 'partners' && (
        <SortableListEditor
          title="Marcas con las que trabajamos"
          icon={Handshake}
          accent="green"
          endpoint="/site-partners"
          queryKey="site-partners"
          itemLabel={(item) => item.name}
          fields={[
            { key: 'name', label: 'Nombre de la marca', type: 'text' },
            { key: 'logo_url', label: 'Logo', type: 'image' },
            { key: 'website_url', label: 'Pagina web (opcional)', type: 'text' },
          ]}
        />
      )}
      {tab === 'videos' && <VideosEditor />}
    </>
  );
}

function GoogleIntegrationPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['google-status'],
    queryFn: async () => (await api.get<{ connected: boolean; email: string | null }>('/google/status')).data,
  });

  return (
    <section className="panel settings-section settings-section-green">
      <div className="settings-section-header">
        <Plug size={18} />
        <PanelTitle title="Google Drive" subtitle="Aquí se guardan las fotos y videos que se suben a la biblioteca de medios" />
      </div>
      {isLoading && <Loading />}
      {!isLoading && (
        <div className="badge-row">
          <Badge label={data?.connected ? `Conectado: ${data.email}` : 'No conectado'} tone={data?.connected ? 'success' : 'normal'} />
        </div>
      )}
      <button type="button" className="primary-button" onClick={() => { window.location.href = '/api/v1/google/connect'; }}>
        {data?.connected ? 'Reconectar' : 'Conectar Google Drive'}
      </button>
    </section>
  );
}

function SortableListEditor({
  title,
  icon: Icon,
  accent,
  endpoint,
  queryKey,
  fields,
  itemLabel,
}: {
  title: string;
  icon: LucideIcon;
  accent: 'green' | 'gold';
  endpoint: string;
  queryKey: string;
  fields: ListFieldConfig[];
  itemLabel: (item: any) => string;
}) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data = [], isLoading } = useQuery({ queryKey: [queryKey], queryFn: async () => (await api.get<any[]>(endpoint)).data });
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<any>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDeletingItem(null);
      notify('Elemento eliminado correctamente');
    },
    onError: () => notify('No se pudo eliminar. Intenta de nuevo.', 'error'),
  });

  if (isLoading) return <Loading />;

  return (
    <section className={`panel settings-section settings-section-${accent}`}>
      <div className="settings-section-header">
        <Icon size={18} />
        <PanelTitle title={title} subtitle="Solo se muestra en el sitio publico cuando esta activo" />
      </div>
      <button
        className={`ghost-button ${accent === 'gold' ? 'ghost-button-accent' : ''}`}
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      >
        <Plus size={15} /> Agregar
      </button>
      <div className="stack">
        {data.map((item) => (
          <article className="list-item" key={item.id}>
            <div className="list-item-heading">
              <strong>{itemLabel(item)}</strong>
              <Badge label={item.is_active ? 'Activo' : 'Oculto'} tone={item.is_active ? 'success' : 'normal'} />
            </div>
            <div className="card-actions">
              <button
                className="ghost-button"
                onClick={() => {
                  setEditing(item);
                  setFormOpen(true);
                }}
              >
                <Pencil size={14} /> Editar
              </button>
              <button className="ghost-button ghost-button-danger" onClick={() => setDeletingItem(item)}>
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </article>
        ))}
        {data.length === 0 && <span>Sin elementos todavia.</span>}
      </div>
      {formOpen && (
        <SortableListItemModal
          endpoint={endpoint}
          queryKey={queryKey}
          fields={fields}
          item={editing}
          onClose={() => setFormOpen(false)}
        />
      )}
      {deletingItem && (
        <ConfirmModal
          title="Eliminar elemento"
          message={`Esto eliminara "${itemLabel(deletingItem)}" y dejara de mostrarse en el sitio publico.`}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deletingItem.id)}
          onClose={() => setDeletingItem(null)}
        />
      )}
    </section>
  );
}

function SortableListItemModal({
  endpoint,
  queryKey,
  fields,
  item,
  onClose,
}: {
  endpoint: string;
  queryKey: string;
  fields: ListFieldConfig[];
  item: any;
  onClose: () => void;
}) {
  const isEdit = !!item;
  const queryClient = useQueryClient();
  const notify = useToast();
  const defaultValues: Record<string, unknown> = { sort_order: item?.sort_order ?? 0, is_active: item?.is_active ?? true };
  fields.forEach((field) => {
    defaultValues[field.key] = item?.[field.key] ?? (field.type === 'number' ? 0 : '');
  });
  const { register, handleSubmit, setValue, watch } = useForm({ defaultValues });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return api.post<{ url: string }>('/site/upload', formData);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: unknown) => (isEdit ? api.put(`${endpoint}/${item.id}`, payload) : api.post(endpoint, payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ['public-site'] });
      notify(isEdit ? 'Cambios guardados correctamente' : 'Elemento agregado correctamente');
      onClose();
    },
    onError: () => notify('No se pudo guardar. Intenta de nuevo.', 'error'),
  });

  return (
    <Modal title={isEdit ? 'Editar elemento' : 'Agregar elemento'} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
        {fields.map((field) => (
          <label key={field.key}>
            {field.label}
            {field.hint && <span className="field-hint">{field.hint}</span>}
            {field.type === 'textarea' && <textarea rows={3} {...register(field.key)} />}
            {field.type === 'text' && <input {...register(field.key)} />}
            {field.type === 'number' && <input type="number" step="0.01" min={0} {...register(field.key, { valueAsNumber: true })} />}
            {field.type === 'image' && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      const res = await uploadMutation.mutateAsync(file);
                      setValue(field.key, res.data.url);
                    } catch {
                      // el mensaje de error ya se muestra abajo via uploadMutation.isError
                    } finally {
                      event.target.value = '';
                    }
                  }}
                />
                {uploadMutation.isPending && <span className="field-hint">Subiendo imagen...</span>}
                {uploadMutation.isError && (
              <span className="login-error">{uploadErrorMessage(uploadMutation.error, 'No se pudo subir la imagen. Intenta de nuevo.')}</span>
            )}
                {String(watch(field.key) ?? '') && (
                  <img src={String(watch(field.key))} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                )}
              </>
            )}
            {field.type === 'video' && (
              <VideoFieldInput value={String(watch(field.key) ?? '')} onChange={(url) => setValue(field.key, url)} />
            )}
          </label>
        ))}
        <label>
          Orden
          <input type="number" {...register('sort_order', { valueAsNumber: true })} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" {...register('is_active')} /> Activo (visible en el sitio)
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saveMutation.isPending}>
            {isEdit ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type SiteVideoItem = { id: number; video_url: string; caption: string | null; sort_order: number; is_active: boolean };
type MediaAssetItem = { id: number; url: string; resource_type: string; label: string | null; created_at: string };

function isInstagramUrl(url: string): boolean {
  return /instagram\.com/i.test(url);
}

function VideoFieldInput({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'link' | 'upload' | 'gallery'>(value && !isInstagramUrl(value) ? 'upload' : 'link');

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      return api.post<MediaAssetItem>('/site/upload-video', formData);
    },
    onSuccess: (res) => {
      onChange(res.data.url);
      queryClient.invalidateQueries({ queryKey: ['media-assets', 'video'] });
    },
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['media-assets', 'video'],
    queryFn: async () => (await api.get<MediaAssetItem[]>('/media-assets', { params: { type: 'video' } })).data,
    enabled: mode === 'gallery',
  });

  return (
    <div className="stack">
      <div className="toggle-group">
        <label className={`toggle-option ${mode === 'link' ? 'is-active' : ''}`}>
          <input type="radio" className="sr-only" checked={mode === 'link'} onChange={() => setMode('link')} />
          <Link2 size={14} /> Link
        </label>
        <label className={`toggle-option ${mode === 'upload' ? 'is-active' : ''}`}>
          <input type="radio" className="sr-only" checked={mode === 'upload'} onChange={() => setMode('upload')} />
          <Upload size={14} /> Subir
        </label>
        <label className={`toggle-option ${mode === 'gallery' ? 'is-active' : ''}`}>
          <input type="radio" className="sr-only" checked={mode === 'gallery'} onChange={() => setMode('gallery')} />
          <LayoutGrid size={14} /> Galeria
        </label>
      </div>

      {mode === 'link' && (
        <input
          placeholder="https://www.instagram.com/reel/..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {mode === 'upload' && (
        <>
          <input
            type="file"
            accept="video/*"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                await uploadMutation.mutateAsync(file);
              } catch {
                // el mensaje de error ya se muestra abajo via uploadMutation.isError
              } finally {
                event.target.value = '';
              }
            }}
          />
          {uploadMutation.isPending && <span>Subiendo video...</span>}
          {uploadMutation.isError && (
            <span className="login-error">{uploadErrorMessage(uploadMutation.error, 'No se pudo subir el video. Intenta de nuevo.')}</span>
          )}
        </>
      )}

      {mode === 'gallery' && (
        <div>
          {loadingAssets && <Loading />}
          {!loadingAssets && (
            <div className="media-grid">
              {assets.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className={`media-tile-open media-tile ${value === asset.url ? 'is-selected' : ''}`}
                  onClick={() => onChange(asset.url)}
                >
                  <video src={asset.url} muted preload="metadata" />
                </button>
              ))}
              {assets.length === 0 && <span>Todavia no subes videos a la galeria.</span>}
            </div>
          )}
        </div>
      )}

      {value && (
        <button type="button" className="ghost-button ghost-button-danger" onClick={() => onChange('')}>
          <Trash2 size={13} /> Quitar video
        </button>
      )}
    </div>
  );
}

function VideosEditor() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data = [], isLoading } = useQuery({
    queryKey: ['site-videos'],
    queryFn: async () => (await api.get<SiteVideoItem[]>('/site-videos')).data,
  });
  const [editing, setEditing] = useState<SiteVideoItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<SiteVideoItem | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/site-videos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-videos'] });
      queryClient.invalidateQueries({ queryKey: ['public-site'] });
      setDeletingItem(null);
      notify('Video eliminado correctamente');
    },
    onError: () => notify('No se pudo eliminar el video. Intenta de nuevo.', 'error'),
  });

  if (isLoading) return <Loading />;

  return (
    <section className="panel settings-section settings-section-green">
      <div className="settings-section-header">
        <Video size={18} />
        <PanelTitle
          title="Videos"
          subtitle="Pega un link de Instagram, sube tu propio archivo o reutiliza uno ya subido antes"
        />
      </div>
      <button
        className="ghost-button"
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      >
        <Plus size={15} /> Agregar
      </button>
      <div className="stack">
        {data.map((item) => (
          <article className="list-item" key={item.id}>
            <div className="list-item-heading">
              <strong>{item.caption || (isInstagramUrl(item.video_url) ? 'Reel de Instagram' : 'Video')}</strong>
              <Badge label={item.is_active ? 'Activo' : 'Oculto'} tone={item.is_active ? 'success' : 'normal'} />
            </div>
            <span>{item.video_url}</span>
            <div className="card-actions">
              <button
                className="ghost-button"
                onClick={() => {
                  setEditing(item);
                  setFormOpen(true);
                }}
              >
                <Pencil size={14} /> Editar
              </button>
              <button className="ghost-button ghost-button-danger" onClick={() => setDeletingItem(item)}>
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </article>
        ))}
        {data.length === 0 && <span>Sin videos todavia.</span>}
      </div>
      {formOpen && <VideoFormModal item={editing} onClose={() => setFormOpen(false)} />}
      {deletingItem && (
        <ConfirmModal
          title="Eliminar video"
          message={`Esto eliminara "${deletingItem.caption || (isInstagramUrl(deletingItem.video_url) ? 'Reel de Instagram' : 'Video')}" y dejara de mostrarse en el sitio publico.`}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deletingItem.id)}
          onClose={() => setDeletingItem(null)}
        />
      )}
    </section>
  );
}

function VideoFormModal({ item, onClose }: { item: SiteVideoItem | null; onClose: () => void }) {
  const isEdit = !!item;
  const queryClient = useQueryClient();
  const notify = useToast();
  const [mode, setMode] = useState<'link' | 'upload' | 'gallery'>(
    item && !isInstagramUrl(item.video_url) ? 'upload' : 'link',
  );
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      video_url: item?.video_url ?? '',
      caption: item?.caption ?? '',
      sort_order: item?.sort_order ?? 0,
      is_active: item?.is_active ?? true,
    },
  });
  const videoUrl = watch('video_url');

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      return api.post<MediaAssetItem>('/site/upload-video', formData);
    },
    onSuccess: (res) => {
      setValue('video_url', res.data.url);
      queryClient.invalidateQueries({ queryKey: ['media-assets', 'video'] });
    },
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['media-assets', 'video'],
    queryFn: async () => (await api.get<MediaAssetItem[]>('/media-assets', { params: { type: 'video' } })).data,
    enabled: mode === 'gallery',
  });

  const saveMutation = useMutation({
    mutationFn: (payload: unknown) => (isEdit ? api.put(`/site-videos/${item.id}`, payload) : api.post('/site-videos', payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-videos'] });
      queryClient.invalidateQueries({ queryKey: ['public-site'] });
      notify(isEdit ? 'Video actualizado correctamente' : 'Video agregado correctamente');
      onClose();
    },
    onError: () => notify('No se pudo guardar el video. Intenta de nuevo.', 'error'),
  });

  return (
    <Modal title={isEdit ? 'Editar video' : 'Agregar video'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
        <div>
          <div className="toggle-group">
            <label className={`toggle-option ${mode === 'link' ? 'is-active' : ''}`}>
              <input type="radio" className="sr-only" checked={mode === 'link'} onChange={() => setMode('link')} />
              <Link2 size={15} /> Link de Instagram
            </label>
            <label className={`toggle-option ${mode === 'upload' ? 'is-active' : ''}`}>
              <input type="radio" className="sr-only" checked={mode === 'upload'} onChange={() => setMode('upload')} />
              <Upload size={15} /> Subir archivo
            </label>
            <label className={`toggle-option ${mode === 'gallery' ? 'is-active' : ''}`}>
              <input type="radio" className="sr-only" checked={mode === 'gallery'} onChange={() => setMode('gallery')} />
              <LayoutGrid size={15} /> Galeria
            </label>
          </div>
        </div>

        {mode === 'link' && (
          <label>
            Link del Reel o post de Instagram
            <input placeholder="https://www.instagram.com/reel/..." {...register('video_url', { required: true })} />
          </label>
        )}

        {mode === 'upload' && (
          <label>
            Subir video (MP4, MOV o WEBM, hasta 35 MB)
            <input
              type="file"
              accept="video/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await uploadMutation.mutateAsync(file);
                } catch {
                  // el mensaje de error ya se muestra abajo via uploadMutation.isError
                } finally {
                  event.target.value = '';
                }
              }}
            />
            {uploadMutation.isPending && <span>Subiendo video...</span>}
            {uploadMutation.isError && (
            <span className="login-error">{uploadErrorMessage(uploadMutation.error, 'No se pudo subir el video. Intenta de nuevo.')}</span>
          )}
          </label>
        )}

        {mode === 'gallery' && (
          <div>
            {loadingAssets && <Loading />}
            {!loadingAssets && (
              <div className="media-grid">
                {assets.map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    className={`media-tile-open media-tile ${videoUrl === asset.url ? 'is-selected' : ''}`}
                    onClick={() => setValue('video_url', asset.url)}
                  >
                    <video src={asset.url} muted preload="metadata" />
                  </button>
                ))}
                {assets.length === 0 && <span>Todavia no subes videos a la galeria.</span>}
              </div>
            )}
          </div>
        )}

        {videoUrl && !isInstagramUrl(videoUrl) && (
          <div>
            <span className="label-title">Vista previa</span>
            <video src={videoUrl} controls style={{ width: '100%', maxWidth: 260, borderRadius: 8 }} />
          </div>
        )}

        <label>
          Descripcion (opcional)
          <input {...register('caption')} />
        </label>
        <label>
          Orden
          <input type="number" {...register('sort_order', { valueAsNumber: true })} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" {...register('is_active')} /> Activo (visible en el sitio)
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saveMutation.isPending || !videoUrl}>
            {isEdit ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HeroImagesEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const slots: (string | null)[] = [0, 1, 2].map((index) => value[index] ?? null);

  const setSlot = (index: number, url: string | null) => {
    const next = [...slots];
    next[index] = url;
    onChange(next.filter((item): item is string => !!item));
  };

  return (
    <div className="hero-images-grid">
      {slots.map((url, index) => (
        <div className="hero-image-slot" key={index}>
          {url ? (
            <>
              <img src={url} alt="" />
              <div className="hero-image-slot-actions">
                <button type="button" className="ghost-button" onClick={() => setPickerSlot(index)}>
                  <Pencil size={13} /> Cambiar
                </button>
                <button type="button" className="ghost-button ghost-button-danger" onClick={() => setSlot(index, null)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="hero-image-slot-empty" onClick={() => setPickerSlot(index)}>
              <Plus size={20} />
              Imagen {index + 1}
            </button>
          )}
        </div>
      ))}
      {pickerSlot !== null && (
        <HeroImagePickerModal
          usedUrls={slots.filter((url, index): url is string => !!url && index !== pickerSlot)}
          onSelect={(url) => {
            setSlot(pickerSlot, url);
            setPickerSlot(null);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}

function HeroImagePickerModal({
  usedUrls,
  onSelect,
  onClose,
}: {
  usedUrls: string[];
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'gallery' | 'upload'>('gallery');
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return api.post<MediaAssetItem>('/site/upload-hero-image', formData);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['media-assets', 'image'] });
      onSelect(res.data.url);
    },
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['media-assets', 'image'],
    queryFn: async () => (await api.get<MediaAssetItem[]>('/media-assets', { params: { type: 'image' } })).data,
    enabled: mode === 'gallery',
  });

  return (
    <Modal title="Elegir imagen del hero" onClose={onClose} wide>
      <div className="form-grid">
        <div className="toggle-group">
          <label className={`toggle-option ${mode === 'gallery' ? 'is-active' : ''}`}>
            <input type="radio" className="sr-only" checked={mode === 'gallery'} onChange={() => setMode('gallery')} />
            <LayoutGrid size={15} /> Galeria
          </label>
          <label className={`toggle-option ${mode === 'upload' ? 'is-active' : ''}`}>
            <input type="radio" className="sr-only" checked={mode === 'upload'} onChange={() => setMode('upload')} />
            <Upload size={15} /> Subir archivo
          </label>
        </div>

        {mode === 'upload' && (
          <label>
            Subir imagen (JPG o PNG, hasta 10 MB)
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await uploadMutation.mutateAsync(file);
                } catch {
                  // el mensaje de error ya se muestra abajo via uploadMutation.isError
                } finally {
                  event.target.value = '';
                }
              }}
            />
            {uploadMutation.isPending && <span>Subiendo imagen...</span>}
            {uploadMutation.isError && (
              <span className="login-error">{uploadErrorMessage(uploadMutation.error, 'No se pudo subir la imagen. Intenta de nuevo.')}</span>
            )}
          </label>
        )}

        {mode === 'gallery' && (
          <div>
            {loadingAssets && <Loading />}
            {!loadingAssets && (
              <div className="media-grid">
                {assets.map((asset) => {
                  const disabled = usedUrls.includes(asset.url);
                  return (
                    <button
                      type="button"
                      key={asset.id}
                      disabled={disabled}
                      className={`media-tile-open media-tile ${disabled ? 'is-disabled' : ''}`}
                      title={disabled ? 'Ya esta usada en otro espacio del carrusel' : undefined}
                      onClick={() => onSelect(asset.url)}
                    >
                      <img src={asset.url} alt="" />
                    </button>
                  );
                })}
                {assets.length === 0 && <span>Todavia no subes imagenes a la galeria del hero.</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SiteGeneralForm() {
  const { data, isLoading } = useQuery({
    queryKey: ['site-settings-admin'],
    queryFn: async () => (await api.get<{ settings: SiteSettingsPayload }>('/site')).data.settings,
  });
  if (isLoading || !data) return <Loading />;
  return <SiteGeneralFormInner initial={data} />;
}

function SiteGeneralFormInner({ initial }: { initial: SiteSettingsPayload }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      company_name: initial.company_name ?? '',
      company_ruc: initial.company_ruc ?? '',
      tagline: initial.tagline ?? '',
      project_role: initial.project_role ?? '',
      hero_title: initial.hero_title ?? '',
      hero_subtitle: initial.hero_subtitle ?? '',
      hero_images: initial.hero_images ?? [],
      about_text: initial.about_text ?? '',
      about_video_url: initial.about_video_url ?? '',
      contact_phone: initial.contact_phone ?? '',
      contact_email: initial.contact_email ?? '',
      contact_address: initial.contact_address ?? '',
      contact_whatsapp: initial.contact_whatsapp ?? '',
      social_embeds: initial.social_embeds ?? [],
      community_platform: initial.community_platform ?? '',
      community_join_method: initial.community_join_method ?? '',
      community_qr_url: initial.community_qr_url ?? '',
      bank_bcp_account: initial.bank_bcp_account ?? '',
      bank_cci_account: initial.bank_cci_account ?? '',
      yape_number: initial.yape_number ?? '',
      yape_holder_name: initial.yape_holder_name ?? '',
      manager_name: initial.manager_name ?? '',
      manager_title: initial.manager_title ?? 'Gerente General',
    },
  });
  const embeds = watch('social_embeds');

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return api.post<{ url: string }>('/site/upload', formData);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: unknown) => api.put('/site-settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings-admin'] });
      queryClient.invalidateQueries({ queryKey: ['public-site'] });
      notify('Cambios guardados correctamente');
    },
    onError: () => notify('No se pudo guardar. Intenta de nuevo.', 'error'),
  });

  return (
    <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
      <section className="panel settings-section settings-section-green">
        <div className="settings-section-header">
          <Building2 size={18} />
          <PanelTitle title="Empresa" subtitle="Nombre, RUC (usado en el Libro de Reclamaciones), eslogan y texto sobre el título de la portada" />
        </div>
        <div className="form-grid">
          <label>
            Nombre de la empresa
            <input {...register('company_name')} />
          </label>
          <label>
            RUC
            <input placeholder="Ej: 20123456789" {...register('company_ruc')} />
          </label>
          <label>
            Eslogan
            <input {...register('tagline')} />
          </label>
          <label>
            Texto sobre el título de la portada
            <input placeholder="Ej: Ejecucion de obra y mobiliario" {...register('project_role')} />
          </label>
        </div>
      </section>

      <section className="panel settings-section settings-section-gold">
        <div className="settings-section-header">
          <Images size={18} />
          <PanelTitle title="Portada del sitio" subtitle="El carrusel y texto que ven tus clientes al entrar a la pagina" />
        </div>
        <div className="form-grid">
          <label>
            Titulo del hero
            <input {...register('hero_title')} />
          </label>
          <label>
            Subtitulo del hero
            <textarea rows={2} {...register('hero_subtitle')} />
          </label>
          <label>
            Imagenes del hero (carrusel, hasta 3)
            <HeroImagesEditor value={watch('hero_images') ?? []} onChange={(next) => setValue('hero_images', next)} />
          </label>
        </div>
      </section>

      <section className="panel settings-section settings-section-green">
        <div className="settings-section-header">
          <Info size={18} />
          <PanelTitle title="Quienes somos" subtitle="Texto y video que se muestran en la seccion Sobre nosotros" />
        </div>
        <div className="form-grid">
          <label>
            Descripcion
            <textarea rows={4} {...register('about_text')} />
          </label>
          <label>
            Video (opcional, se muestra junto al texto)
            <VideoFieldInput value={watch('about_video_url') ?? ''} onChange={(url) => setValue('about_video_url', url)} />
          </label>
        </div>
      </section>

      <section className="panel settings-section settings-section-gold">
        <div className="settings-section-header">
          <Phone size={18} />
          <PanelTitle title="Contacto" subtitle="Como te encuentran y te escriben tus clientes" />
        </div>
        <div className="form-grid">
          <label>
            Telefono de contacto
            <input {...register('contact_phone')} />
          </label>
          <label>
            Correo de contacto
            <input type="email" {...register('contact_email')} />
          </label>
          <label>
            Direccion
            <input {...register('contact_address')} />
          </label>
          <label>
            WhatsApp
            <input {...register('contact_whatsapp')} />
          </label>
        </div>
      </section>

      <section className="panel settings-section settings-section-green">
        <div className="settings-section-header">
          <Share2 size={18} />
          <PanelTitle title="Redes sociales" subtitle="Instagram, TikTok u otro link" />
        </div>
        <div className="stack">
          {(embeds ?? []).map((embed, index) => (
            <div className="embed-row" key={index}>
              <input placeholder="Plataforma" {...register(`social_embeds.${index}.platform` as const)} />
              <input placeholder="URL" {...register(`social_embeds.${index}.url` as const)} />
              <button
                type="button"
                className="ghost-button ghost-button-danger"
                onClick={() =>
                  setValue(
                    'social_embeds',
                    (embeds ?? []).filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ghost-button"
            onClick={() => setValue('social_embeds', [...(embeds ?? []), { platform: 'Instagram', url: '' }])}
          >
            <Plus size={14} /> Agregar red social
          </button>
        </div>
      </section>

      <section className="panel settings-section settings-section-gold">
        <div className="settings-section-header">
          <Users size={18} />
          <PanelTitle title="Comunidad" subtitle="Grupo o canal al que se unen tus clientes" />
        </div>
        <div className="form-grid">
          <label>
            Plataforma
            <input placeholder="Ej: WhatsApp" {...register('community_platform')} />
          </label>
          <label>
            Metodo de ingreso
            <input placeholder="Ej: Codigo QR" {...register('community_join_method')} />
          </label>
          <label>
            Imagen del codigo QR
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const res = await uploadMutation.mutateAsync(file);
                  setValue('community_qr_url', res.data.url);
                } catch {
                  // el mensaje de error ya se muestra abajo via uploadMutation.isError
                } finally {
                  event.target.value = '';
                }
              }}
            />
            {uploadMutation.isPending && <span className="field-hint">Subiendo imagen...</span>}
            {uploadMutation.isError && (
              <span className="login-error">{uploadErrorMessage(uploadMutation.error, 'No se pudo subir la imagen. Intenta de nuevo.')}</span>
            )}
            {watch('community_qr_url') && <img src={watch('community_qr_url')} alt="" style={{ width: 100, borderRadius: 8 }} />}
          </label>
        </div>
      </section>

      <section className="panel settings-section settings-section-important">
        <div className="settings-section-header">
          <Wallet size={18} />
          <PanelTitle title="Pagos y firma" subtitle="Datos que aparecen en la pagina de pago de las cotizaciones en PDF" />
        </div>
        <div className="form-grid">
          <label>
            Numero Yape
            <input placeholder="Ej: 913 332 393" {...register('yape_number')} />
          </label>
          <label>
            Titular de Yape
            <input {...register('yape_holder_name')} />
          </label>
          <label>
            Cuenta BCP (soles)
            <input {...register('bank_bcp_account')} />
          </label>
          <label>
            Cuenta interbancaria (CCI)
            <input {...register('bank_cci_account')} />
          </label>
          <label>
            Nombre de quien firma
            <input {...register('manager_name')} />
          </label>
          <label>
            Cargo de quien firma
            <input {...register('manager_title')} />
          </label>
        </div>
      </section>

      <div className="settings-save-bar">
        <button className="primary-button" disabled={saveMutation.isPending}>
          Guardar cambios
        </button>
      </div>
    </form>
  );
}

import { Images, Trash2 } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../apiClient';
import { useAuth } from '../auth';
import { ProjectMedia as ProjectMediaType } from '../types';
import { ConfirmModal, Loading, Modal, useToast } from './ui';

export function MediaLightbox({ item, onClose }: { item: ProjectMediaType; onClose: () => void }) {
  return (
    <Modal title={item.type === 'video' ? 'Video' : 'Foto'} onClose={onClose}>
      <div className="media-lightbox">
        {item.type === 'video' ? (
          <iframe src={`https://drive.google.com/file/d/${item.drive_file_id}/preview`} allow="autoplay" allowFullScreen />
        ) : (
          <img src={`${item.drive_thumbnail_link}=w1600`} alt={item.caption ?? ''} />
        )}
      </div>
      <a className="ghost-button" href={item.drive_view_link} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12 }}>
        Abrir en Drive
      </a>
    </Modal>
  );
}

export function MediaThumb({ item }: { item: ProjectMediaType }) {
  if (item.type === 'image' && item.drive_thumbnail_link) {
    return <img src={`${item.drive_thumbnail_link}=w400`} alt={item.caption ?? ''} />;
  }
  return <div className="media-tile-fallback">{item.type === 'video' ? 'Video' : 'Foto'}</div>;
}

export function ProjectMediaModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: number;
  projectName: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('Administrador') ?? false;
  const queryClient = useQueryClient();
  const notify = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<ProjectMediaType | null>(null);
  const [deletingItem, setDeletingItem] = useState<ProjectMediaType | null>(null);
  const queryKey = ['project-media', projectId];

  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<ProjectMediaType[]>(`/projects/${projectId}/media`)).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/projects/${projectId}/media`, formData);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/project-media/${id}`),
    onSuccess: () => {
      invalidate();
      setDeletingItem(null);
      notify('Archivo eliminado correctamente');
    },
    onError: (error) => {
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      setDeleteError(message ?? 'No se pudo eliminar el archivo. Intenta de nuevo.');
    },
  });

  const handleFiles = async (files: FileList) => {
    const list = Array.from(files);
    setUploadError(null);
    setUploadProgress({ done: 0, total: list.length });
    try {
      for (const [index, file] of list.entries()) {
        await uploadMutation.mutateAsync(file);
        setUploadProgress({ done: index + 1, total: list.length });
      }
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      setUploadError(message ?? 'No se pudo subir el archivo. Intenta de nuevo.');
    } finally {
      setUploadProgress(null);
      invalidate();
    }
  };

  return (
    <>
    <Modal title={`Fotos y videos — ${projectName}`} onClose={onClose}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <button type="button" className="ghost-button" onClick={() => inputRef.current?.click()} disabled={!!uploadProgress}>
        <Images size={14} /> {uploadProgress ? `Subiendo ${uploadProgress.done}/${uploadProgress.total}...` : 'Subir fotos o videos'}
      </button>
      {uploadError && <p className="login-error">{uploadError}</p>}
      {deleteError && <p className="login-error">{deleteError}</p>}

      {isLoading && <Loading />}
      {!isLoading && data.length === 0 && !uploadProgress && (
        <p style={{ marginTop: 14 }}>Todavia no hay contenido para este proyecto.</p>
      )}

      <div className="media-grid" style={{ marginTop: 14 }}>
        {data.map((item) => (
          <div className="media-tile" key={item.id}>
            <button type="button" className="media-tile-open" onClick={() => setLightboxItem(item)}>
              <MediaThumb item={item} />
            </button>
            {isAdmin && (
              <button
                type="button"
                className="ghost-button media-tile-delete"
                onClick={() => {
                  setDeleteError(null);
                  setDeletingItem(item);
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {lightboxItem && <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}
    </Modal>
    {deletingItem && (
      <ConfirmModal
        title="Eliminar archivo"
        message="Esto eliminara la foto o video seleccionado. Tambien se borra de tu Google Drive."
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingItem.id)}
        onClose={() => setDeletingItem(null)}
      />
    )}
    </>
  );
}

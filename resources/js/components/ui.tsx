import { X } from 'lucide-react';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { APP_NAME, LOGO_MARK_URL, LOGO_URL } from '../apiClient';

export function useOverlayClose(onClose: () => void) {
  const pressedOnOverlay = useRef(false);
  return {
    onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
      pressedOnOverlay.current = event.target === event.currentTarget;
    },
    onClick: (event: React.MouseEvent<HTMLDivElement>) => {
      if (pressedOnOverlay.current && event.target === event.currentTarget) onClose();
      pressedOnOverlay.current = false;
    },
  };
}

export function Metric({
  label,
  value,
  danger = false,
  tone,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  tone?: 'green' | 'gold';
}) {
  return (
    <article className={`metric-card ${danger ? 'danger' : ''} ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="panel-title"><h2>{title}</h2><p>{subtitle}</p></div>;
}

export function Modal({
  title,
  onClose,
  narrow = false,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  narrow?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const overlayHandlers = useOverlayClose(onClose);
  return (
    <div className="modal-overlay" {...overlayHandlers}>
      <div
        className={`modal-box ${narrow ? 'modal-box-narrow' : ''} ${wide ? 'modal-box-wide' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  danger = true,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} narrow>
      <p className="confirm-text">{message}</p>
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onClose} disabled={pending}>
          {cancelLabel}
        </button>
        <button type="button" className={danger ? 'danger-button' : 'primary-button'} onClick={onConfirm} disabled={pending}>
          {pending ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

type ToastTone = 'success' | 'error';
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-viewport">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast debe usarse dentro de ToastProvider');
  return notify;
}

export function Badge({ label, tone }: { label: string; tone: 'normal' | 'danger' | 'success' | 'warning' | 'info' }) {
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function Loading() {
  return (
    <section className="panel loading-inline">
      <img src={LOGO_URL} alt={APP_NAME} className="loading-logo" />
      <span>Cargando información de {APP_NAME}...</span>
    </section>
  );
}

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <img src={LOGO_MARK_URL} alt={APP_NAME} className="loading-logo-mark" />
    </div>
  );
}

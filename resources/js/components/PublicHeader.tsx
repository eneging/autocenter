import { APP_NAME } from '../apiClient';
import { BookText, Menu, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { LOGO_URL } from '../apiClient';

export function PublicHeader({ companyName }: { companyName?: string | null }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="landing-nav">
      <RouterLink to="/" className="landing-brand" onClick={close}>
        <img src={LOGO_URL} alt={APP_NAME} />
        <span>{companyName ?? APP_NAME}</span>
      </RouterLink>

      <nav className={`landing-nav-menu ${open ? 'is-open' : ''}`}>
        <RouterLink to="/libro-de-reclamaciones" className="ghost-button" onClick={close}>
          <BookText size={15} /> Libro de Reclamaciones
        </RouterLink>
        <RouterLink to="/app" className="ghost-button" onClick={close}>
          <User size={15} /> Ingresar
        </RouterLink>
      </nav>

      <div className="landing-nav-actions">
        <RouterLink to="/portal" className="primary-button">
          Pedir cotizacion
        </RouterLink>
        <button
          type="button"
          className="landing-nav-toggle"
          aria-label={open ? 'Cerrar menu' : 'Abrir menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && <div className="landing-nav-backdrop" onClick={close} />}
    </header>
  );
}

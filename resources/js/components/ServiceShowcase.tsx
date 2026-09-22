import { ArrowRight, X } from 'lucide-react';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { isInstagramUrl, toInstagramEmbedUrl, SiteService } from '../lib/publicSite';

export function ServiceShowcase({
  service,
  compact = false,
  onClose,
  showOpenPageLink = false,
}: {
  service: SiteService;
  compact?: boolean;
  onClose?: () => void;
  showOpenPageLink?: boolean;
}) {
  return (
    <div className={`service-showcase ${compact ? 'is-compact' : ''}`}>
      <div
        className="service-showcase-media"
        style={service.icon_url ? { backgroundImage: `url(${service.icon_url})` } : undefined}
      >
        {onClose && (
          <button type="button" className="service-showcase-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        )}
        <div className="service-showcase-media-overlay">
          <span className="landing-kicker">Servicio del taller</span>
          <h2>{service.title}</h2>
        </div>
      </div>
      <div className="service-showcase-body">
        {service.description && <p className="service-showcase-lede">{service.description}</p>}

        {service.video_url && (
          <>
            <span className="service-showcase-video-label">Miralo en video</span>
            {isInstagramUrl(service.video_url) ? (
              <iframe
                className="service-showcase-video"
                src={toInstagramEmbedUrl(service.video_url)}
                title={`Video de ${service.title}`}
                loading="lazy"
                allowFullScreen
              />
            ) : (
              <video className="service-showcase-video" src={service.video_url} controls playsInline preload="metadata" />
            )}
          </>
        )}

        <div className="service-showcase-cta">
          <RouterLink to="/portal" className="primary-button">
            Quiero cotizar este servicio <ArrowRight size={16} />
          </RouterLink>
          {showOpenPageLink && (
            <RouterLink to={`/servicios/${service.slug}`} className="ghost-button">
              Ver pagina completa
            </RouterLink>
          )}
        </div>
      </div>
    </div>
  );
}

import { APP_NAME } from './apiClient';
import { ArrowLeft, BookText } from 'lucide-react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { api } from './apiClient';
import { LoadingScreen } from './components/ui';
import { PublicHeader } from './components/PublicHeader';
import { ServiceShowcase } from './components/ServiceShowcase';
import { WhatsAppFloatButton } from './components/WhatsAppFloatButton';
import { SiteService } from './lib/publicSite';

export function ServiceDetailView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: site } = useQuery({
    queryKey: ['public-site'],
    queryFn: async () =>
      (await api.get<{ settings: { company_name: string | null; contact_whatsapp: string | null } }>('/site')).data,
  });
  const {
    data: service,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-service', slug],
    queryFn: async () => (await api.get<SiteService>(`/site/services/${slug}`)).data,
    enabled: !!slug,
    retry: false,
  });

  return (
    <div className="landing-page">
      <PublicHeader companyName={site?.settings.company_name} />

      {isLoading && <LoadingScreen />}

      {isError && (
        <section className="landing-section">
          <div className="landing-section-inner">
            <RouterLink to="/#servicios" className="landing-back-link">
              <ArrowLeft size={15} /> Volver a servicios
            </RouterLink>
            <h1>No encontramos este servicio</h1>
            <p className="landing-section-lede">Puede que el enlace este mal escrito o que el servicio ya no este disponible.</p>
            <RouterLink to="/" className="primary-button">
              Ir al inicio
            </RouterLink>
          </div>
        </section>
      )}

      {service && (
        <section className="landing-section landing-section-service">
          <div className="landing-section-inner">
            <RouterLink to="/#servicios" className="landing-back-link">
              <ArrowLeft size={15} /> Volver a servicios
            </RouterLink>
          </div>
          <div className="landing-section-inner landing-service-showcase-wrap">
            <ServiceShowcase service={service} />
          </div>
        </section>
      )}

      <footer className="landing-footer">
        <span>
          © {new Date().getFullYear()} {site?.settings.company_name ?? APP_NAME}
        </span>
        <RouterLink to="/libro-de-reclamaciones" className="landing-footer-link">
          <BookText size={14} /> Libro de Reclamaciones
        </RouterLink>
      </footer>
      <WhatsAppFloatButton phone={site?.settings.contact_whatsapp} />
    </div>
  );
}

import { APP_NAME } from './apiClient';
import { ArrowRight, BookText, Link as LinkIcon, Mail, MapPin, Phone, Quote } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { api } from './apiClient';
import { PromotionsSection } from './components/PromotionsSection';
import { PublicHeader } from './components/PublicHeader';
import { ServiceShowcase } from './components/ServiceShowcase';
import { LoadingScreen, useOverlayClose } from './components/ui';
import { WhatsAppFloatButton } from './components/WhatsAppFloatButton';
import { WorkshopDecor } from './components/WorkshopDecor';
import { cloudinaryVideoPoster, isInstagramUrl, toInstagramEmbedUrl, SiteCatalogItem, SiteService } from './lib/publicSite';

type SiteSettings = {
  company_name: string | null;
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
};

type SiteTestimonial = { id: number; client_name: string; quote: string; avatar_url: string | null };
type SitePartner = { id: number; name: string; logo_url: string; website_url: string | null };
type SiteGalleryItem = { id: number; image_url: string; caption: string | null };
type SiteVideo = { id: number; video_url: string; caption: string | null };

type SitePayload = {
  settings: SiteSettings;
  services: SiteService[];
  testimonials: SiteTestimonial[];
  gallery: SiteGalleryItem[];
  videos: SiteVideo[];
  catalog: SiteCatalogItem[];
  partners: SitePartner[];
};

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`}>
      {children}
    </div>
  );
}

function CatalogTeaser({ items }: { items: SiteCatalogItem[] }) {
  const featured = items.slice(0, 4);

  return (
    <section className="landing-section landing-catalog-teaser" id="catalogo">
      <Reveal className="landing-section-inner">
        <span className="landing-kicker">Servicios y precios</span>
        <h2>Precios referenciales de nuestros servicios</h2>
        <p className="landing-section-lede">
          Elige el servicio que necesitas y te mostramos un precio referencial al instante. El diagnóstico final lo confirma
          nuestro técnico al revisar tu vehículo.
        </p>
        <div className="landing-catalog-teaser-grid">
          {featured.map((item) => (
            <div className="landing-catalog-teaser-item" key={item.id}>
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} />
              ) : (
                <div className="landing-catalog-teaser-placeholder">{APP_NAME}</div>
              )}
              <span>{item.title}</span>
            </div>
          ))}
        </div>
        <RouterLink to="/portal" className="primary-button">
          Solicitar cotización <ArrowRight size={16} />
        </RouterLink>
      </Reveal>
    </section>
  );
}

function ServicesCarousel({ services, onSelect }: { services: SiteService[]; onSelect: (service: SiteService) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || services.length < 2) return;

    const id = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (atEnd) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: track.clientWidth * 0.8, behavior: 'smooth' });
      }
    }, 3800);

    return () => clearInterval(id);
  }, [services.length]);

  const pause = () => {
    pausedUntilRef.current = Date.now() + 6000;
  };

  return (
    <div className="landing-services-track" ref={trackRef} onPointerDown={pause} onTouchStart={pause} onMouseEnter={pause}>
      {services.map((service, index) => (
        <button
          type="button"
          className={`landing-card landing-card-button ${service.icon_url ? 'has-image' : ''}`}
          key={service.id}
          onClick={() => onSelect(service)}
        >
          {service.icon_url && <img src={service.icon_url} alt={service.title} />}
          <span className="landing-card-index">{String(index + 1).padStart(2, '0')}</span>
          <h3>{service.title}</h3>
          {service.description && <p>{service.description}</p>}
          <span className="landing-card-link">Ver mas {service.video_url ? '· incluye video' : ''}</span>
        </button>
      ))}
    </div>
  );
}

export function WelcomeView() {
  const { data, isLoading } = useQuery({ queryKey: ['public-site'], queryFn: async () => (await api.get<SitePayload>('/site')).data });
  const heroImages = data?.settings.hero_images?.filter(Boolean) ?? [];
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeService, setActiveService] = useState<SiteService | null>(null);

  useEffect(() => {
    if (heroImages.length < 2) return;
    setHeroIndex(0);
    const id = setInterval(() => setHeroIndex((current) => (current + 1) % heroImages.length), 6000);
    return () => clearInterval(id);
  }, [heroImages.join('|')]);

  return (
    <div className="landing-page">
      <PublicHeader companyName={data?.settings.company_name} />

      {isLoading || !data ? (
        <LoadingScreen />
      ) : (
        <>
          <section className="landing-hero">
            <div className="landing-hero-slides">
              {heroImages.map((url, index) => (
                <div
                  key={url}
                  className={`landing-hero-slide ${index === heroIndex ? 'is-active' : ''}`}
                  style={{ backgroundImage: `url(${url})` }}
                />
              ))}
            </div>
            <div className="landing-hero-content">
              <span className="eyebrow">{data.settings.project_role ?? 'Taller de reparación y mantenimiento automotriz'}</span>
              <h1>{data.settings.hero_title ?? 'Tu vehículo en las mejores manos'}</h1>
              <p className="landing-subtitle">
                {data.settings.hero_subtitle ?? 'Diagnóstico, reparación y mantenimiento de tu vehículo, con seguimiento en tiempo real desde tu celular.'}
              </p>
              <div className="landing-hero-actions">
                <RouterLink to="/portal" className="primary-button">
                  Solicita tu cotizacion <ArrowRight size={16} />
                </RouterLink>
                <a href="#servicios" className="ghost-button">
                  Ver servicios
                </a>
                {data.catalog.length > 0 && (
                  <a href="#catalogo" className="ghost-button">
                    Ver precios
                  </a>
                )}
              </div>
            </div>
            <div className="landing-scroll-cue">
              <span />
              Desliza
            </div>
            {heroImages.length > 1 && (
              <div className="landing-hero-dots">
                {heroImages.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    aria-label={`Ver imagen ${index + 1}`}
                    className={index === heroIndex ? 'is-active' : ''}
                    onClick={() => setHeroIndex(index)}
                  />
                ))}
              </div>
            )}
          </section>

          {data.settings.about_text && (
            <section className="landing-section landing-about">
              <WorkshopDecor />
              <Reveal
                className={`landing-section-inner ${data.settings.about_video_url ? 'landing-about-grid' : ''}`}
              >
                <div>
                  <span className="landing-kicker">Quienes somos</span>
                  <p>{data.settings.about_text}</p>
                </div>
                {data.settings.about_video_url && (
                  <div className="landing-about-video">
                    {isInstagramUrl(data.settings.about_video_url) ? (
                      <iframe
                        src={toInstagramEmbedUrl(data.settings.about_video_url)}
                        title={`Video de ${APP_NAME}`}
                        loading="lazy"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={data.settings.about_video_url}
                        poster={cloudinaryVideoPoster(data.settings.about_video_url)}
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </div>
                )}
              </Reveal>
            </section>
          )}

          {data.services.length > 0 && (
            <section className="landing-section" id="servicios">
              <WorkshopDecor />
              <Reveal className="landing-section-inner">
                <span className="landing-kicker">Servicios</span>
                <h2>Todo lo que tu vehículo necesita</h2>
                <ServicesCarousel services={data.services} onSelect={setActiveService} />
              </Reveal>
            </section>
          )}

          <PromotionsSection />

          {data.partners.length > 0 && (
            <section className="landing-section landing-partners">
              <Reveal className="landing-section-inner">
                <span className="landing-kicker">Calidad garantizada</span>
                <h2>Marcas con las que trabajamos</h2>
                <div className="landing-partners-grid">
                  {data.partners.map((partner) =>
                    partner.website_url ? (
                      <a
                        key={partner.id}
                        href={partner.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="landing-partner-logo"
                        title={partner.name}
                      >
                        <img src={partner.logo_url} alt={partner.name} />
                      </a>
                    ) : (
                      <div key={partner.id} className="landing-partner-logo" title={partner.name}>
                        <img src={partner.logo_url} alt={partner.name} />
                      </div>
                    ),
                  )}
                </div>
              </Reveal>
            </section>
          )}

          {data.catalog.length > 0 && <CatalogTeaser items={data.catalog} />}

          {data.gallery.length > 0 && (
            <section className="landing-section">
              <Reveal className="landing-section-inner">
                <span className="landing-kicker">Nuestro trabajo</span>
                <h2>Trabajos recientes</h2>
                <div className="landing-gallery">
                  {data.gallery.map((item) => (
                    <figure className="landing-gallery-item" key={item.id}>
                      <img src={item.image_url} alt={item.caption ?? APP_NAME} />
                      {item.caption && <figcaption>{item.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              </Reveal>
            </section>
          )}

          {data.videos.length > 0 && (
            <section className="landing-section landing-videos">
              <Reveal className="landing-section-inner">
                <span className="landing-kicker">Videos</span>
                <h2>Nuestro trabajo, en video</h2>
                <div className="landing-reels">
                  {data.videos.map((video) =>
                    video.video_url.includes('instagram.com') ? (
                      <figure className="landing-reel-item" key={video.id}>
                        <iframe
                          src={toInstagramEmbedUrl(video.video_url)}
                          title={video.caption ?? `Video de ${APP_NAME}`}
                          loading="lazy"
                          allowFullScreen
                        />
                        {video.caption && <figcaption>{video.caption}</figcaption>}
                      </figure>
                    ) : (
                      <figure className="landing-reel-item" key={video.id}>
                        <video src={video.video_url} controls playsInline preload="metadata" />
                        {video.caption && <figcaption>{video.caption}</figcaption>}
                      </figure>
                    ),
                  )}
                </div>
              </Reveal>
            </section>
          )}

          {data.testimonials.length > 0 && (
            <section className="landing-section landing-testimonials">
              <Reveal className="landing-section-inner">
                <span className="landing-kicker">Testimonios</span>
                <h2>Lo que dicen nuestros clientes</h2>
                <div className="landing-grid-3">
                  {data.testimonials.map((testimonial) => (
                    <article className="landing-card" key={testimonial.id}>
                      <Quote className="landing-testimonial-quote" size={22} />
                      <p>{testimonial.quote}</p>
                      <div className="landing-testimonial-author">
                        {testimonial.avatar_url && <img src={testimonial.avatar_url} alt={testimonial.client_name} />}
                        <strong>{testimonial.client_name}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </Reveal>
            </section>
          )}

          {(() => {
            const activeEmbeds = (data.settings.social_embeds ?? []).filter((embed) => embed.url && embed.url.trim() !== '');
            return (
              activeEmbeds.length > 0 && (
                <section className="landing-section">
                  <Reveal className="landing-section-inner">
                    <span className="landing-kicker">Siguenos</span>
                    <h2>Nuestro trabajo, en vivo</h2>
                    <div className="landing-grid-3">
                      {activeEmbeds.map((embed, index) => (
                        <a className="landing-card landing-social" href={embed.url} target="_blank" rel="noopener" key={index}>
                          <span>{embed.platform}</span>
                          <LinkIcon size={16} />
                        </a>
                      ))}
                    </div>
                  </Reveal>
                </section>
              )
            );
          })()}

          {data.settings.community_platform && (
            <section className="landing-section landing-community">
              <Reveal className="landing-section-inner landing-community-inner">
                <div>
                  <span className="landing-kicker">Comunidad</span>
                  <h2>Unete a nuestra comunidad de {data.settings.community_platform}</h2>
                  {data.settings.community_join_method && (
                    <p className="landing-section-lede">Metodo de ingreso: {data.settings.community_join_method}</p>
                  )}
                </div>
                {data.settings.community_qr_url && <img className="landing-qr" src={data.settings.community_qr_url} alt="Codigo QR" />}
              </Reveal>
            </section>
          )}

          <section className="landing-section landing-contact">
            <Reveal className="landing-section-inner">
              <span className="landing-kicker">Contacto</span>
              <h2>Visítanos o escríbenos</h2>
              <div className="landing-contact-grid">
                {data.settings.contact_phone && (
                  <div className="landing-contact-item">
                    <Phone size={18} />
                    <span>{data.settings.contact_phone}</span>
                  </div>
                )}
                {data.settings.contact_email && (
                  <div className="landing-contact-item">
                    <Mail size={18} />
                    <span>{data.settings.contact_email}</span>
                  </div>
                )}
                {data.settings.contact_address && (
                  <div className="landing-contact-item">
                    <MapPin size={18} />
                    <span>{data.settings.contact_address}</span>
                  </div>
                )}
              </div>
            </Reveal>
          </section>
        </>
      )}

      <footer className="landing-footer">
        <span>
          © {new Date().getFullYear()} {data?.settings.company_name ?? APP_NAME}
          {data?.settings.tagline ? ` — ${data.settings.tagline}` : ''}
        </span>
        <RouterLink to="/libro-de-reclamaciones" className="landing-footer-link">
          <BookText size={14} /> Libro de Reclamaciones
        </RouterLink>
      </footer>
      {activeService && <ServiceDetailModal service={activeService} onClose={() => setActiveService(null)} />}
      <WhatsAppFloatButton phone={data?.settings.contact_whatsapp} />
    </div>
  );
}

function ServiceDetailModal({ service, onClose }: { service: SiteService; onClose: () => void }) {
  const overlayHandlers = useOverlayClose(onClose);
  return (
    <div className="modal-overlay" {...overlayHandlers}>
      <div className="service-modal-box" onClick={(event) => event.stopPropagation()}>
        <ServiceShowcase service={service} compact onClose={onClose} showOpenPageLink />
      </div>
    </div>
  );
}

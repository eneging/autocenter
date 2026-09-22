import { APP_NAME } from './apiClient';
import axios from 'axios';
import { ImagePlus } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api, LOGO_URL } from './apiClient';
import { WhatsAppFloatButton } from './components/WhatsAppFloatButton';

type PortalFormValues = {
  name: string;
  email: string;
  password: string;
  phone: string;
  document_type: string;
  document_number: string;
  title: string;
  description: string;
  vehicle_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
};

export function QuotePortalView() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm<PortalFormValues>({
    defaultValues: { document_type: '1' },
  });
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const { data: site } = useQuery({
    queryKey: ['public-site'],
    queryFn: async () =>
      (await api.get<{ settings: { hero_images: string[] | null; contact_whatsapp: string | null } }>('/site')).data,
  });

  const onSubmit = async (values: PortalFormValues) => {
    setFieldErrors({});
    setGeneralError(null);

    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.append(key, value));
    if (file) formData.append('reference_image', file);

    try {
      await axios.get('/sanctum/csrf-cookie', { withCredentials: true });
      await api.post('/register', formData);
      navigate('/app');
    } catch (err: any) {
      if (err?.response?.status === 422) {
        setFieldErrors(err.response.data.errors ?? {});
      } else {
        setGeneralError('No pudimos enviar tu solicitud. Intenta de nuevo.');
      }
    }
  };

  return (
    <div className="portal-shell">
      <div
        className="portal-visual"
        style={site?.settings.hero_images?.[0] ? { backgroundImage: `url(${site.settings.hero_images[0]})` } : undefined}
      >
        <RouterLink to="/" className="portal-back">
          ← Volver al inicio
        </RouterLink>
        <div>
          <span className="landing-kicker">{APP_NAME}</span>
          <h1>Cuéntanos qué le pasa a tu vehículo</h1>
        </div>
      </div>

      <div className="portal-form-side">
        <div className="portal-form-inner">
          <img className="login-logo" src={LOGO_URL} alt={APP_NAME} />
          <h2>Solicita tu cotización</h2>
          <p className="landing-subtitle">Crea tu cuenta y cuéntanos qué necesita tu vehículo en un solo paso. Podrás seguir la reparación desde tu celular.</p>
          {generalError && <p className="login-error">{generalError}</p>}
          <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
            <label>
              Nombre completo
              <input {...register('name', { required: true })} />
              {fieldErrors.name && <span className="login-error">{fieldErrors.name[0]}</span>}
            </label>
            <label>
              Correo
              <input type="email" {...register('email', { required: true })} />
              {fieldErrors.email && <span className="login-error">{fieldErrors.email[0]}</span>}
            </label>
            <label>
              Contraseña
              <input type="password" {...register('password', { required: true, minLength: 6 })} />
              {fieldErrors.password && <span className="login-error">{fieldErrors.password[0]}</span>}
            </label>
            <label>
              Teléfono
              <input {...register('phone')} />
            </label>
            <label>
              Tipo de documento
              <select {...register('document_type')}>
                <option value="1">DNI</option>
                <option value="6">RUC</option>
              </select>
            </label>
            <label>
              Número de documento (opcional)
              <input placeholder="Ej: 45891230" {...register('document_number')} />
              {fieldErrors.document_number && <span className="login-error">{fieldErrors.document_number[0]}</span>}
            </label>
            <label>
              Placa del vehículo (opcional)
              <input placeholder="Ej: ABC-123" autoCapitalize="characters" {...register('vehicle_plate')} />
              {fieldErrors.vehicle_plate && <span className="login-error">{fieldErrors.vehicle_plate[0]}</span>}
            </label>
            <label>
              Marca (opcional)
              <input placeholder="Ej: Toyota" {...register('vehicle_brand')} />
            </label>
            <label>
              Modelo (opcional)
              <input placeholder="Ej: Hilux" {...register('vehicle_model')} />
            </label>
            <label>
              ¿Qué necesita tu vehículo?
              <input placeholder="Ej: Cambio de batería, revisión eléctrica" {...register('title', { required: true })} />
              {fieldErrors.title && <span className="login-error">{fieldErrors.title[0]}</span>}
            </label>
            <label>
              Describe el problema o el servicio que necesitas
              <textarea rows={4} {...register('description', { required: true })} />
              {fieldErrors.description && <span className="login-error">{fieldErrors.description[0]}</span>}
            </label>
            <label>
              Foto del problema (opcional)
              <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <button className="primary-button" disabled={formState.isSubmitting}>
              <ImagePlus size={17} /> Enviar solicitud
            </button>
          </form>
          <p className="landing-subtitle">
            ¿Ya tienes cuenta? <RouterLink to="/app">Inicia sesión</RouterLink>
          </p>
        </div>
      </div>
      <WhatsAppFloatButton phone={site?.settings.contact_whatsapp} />
    </div>
  );
}

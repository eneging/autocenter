import { APP_NAME } from './apiClient';
import axios from 'axios';
import { BookText, CheckCircle2, Clock3, Download, FileText, MessageSquareWarning, ShieldCheck, User } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { api, LOGO_URL } from './apiClient';

type ComplaintFormValues = {
  tipo: 'reclamo' | 'queja';
  bien_tipo: 'producto' | 'servicio';
  monto_reclamado: string;
  bien_descripcion: string;
  consumidor_nombre: string;
  consumidor_domicilio: string;
  consumidor_documento: string;
  consumidor_telefono: string;
  consumidor_email: string;
  es_menor: boolean;
  representante_nombre: string;
  detalle: string;
  pedido: string;
  enviar_copia_email: boolean;
  consumidor_acepta: boolean;
};

function ToggleField({
  name,
  value,
  currentValue,
  register,
  children,
}: {
  name: 'tipo' | 'bien_tipo';
  value: string;
  currentValue: string;
  register: any;
  children: React.ReactNode;
}) {
  return (
    <label className={`toggle-option ${currentValue === value ? 'is-active' : ''}`}>
      <input type="radio" value={value} className="sr-only" {...register(name, { required: true })} />
      {children}
    </label>
  );
}

export function ComplaintBookView() {
  const { register, handleSubmit, watch, formState } = useForm<ComplaintFormValues>({
    defaultValues: { tipo: 'reclamo', bien_tipo: 'servicio', enviar_copia_email: true },
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: number; code: string; access_token: string } | null>(null);
  const esMenor = watch('es_menor');
  const tipo = watch('tipo');
  const bienTipo = watch('bien_tipo');

  const onSubmit = async (values: ComplaintFormValues) => {
    setFieldErrors({});
    setGeneralError(null);
    try {
      await axios.get('/sanctum/csrf-cookie', { withCredentials: true });
      const response = await api.post('/complaint-book', {
        ...values,
        monto_reclamado: values.monto_reclamado ? Number(values.monto_reclamado) : null,
      });
      setResult(response.data);
    } catch (err: any) {
      if (err?.response?.status === 422) {
        setFieldErrors(err.response.data.errors ?? {});
      } else {
        setGeneralError('No pudimos registrar tu reclamo. Intenta de nuevo.');
      }
    }
  };

  const downloadPdf = async () => {
    if (!result) return;
    const response = await api.get(`/complaint-book/${result.id}/pdf`, {
      params: { token: result.access_token },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hoja-reclamacion-${result.code}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-brand">
          <img src={LOGO_URL} alt={APP_NAME} />
          <span>{APP_NAME}</span>
        </div>
        <nav>
          <RouterLink to="/" className="ghost-button">
            Volver al inicio
          </RouterLink>
        </nav>
      </header>

      <section className="complaint-hero">
        <BookText size={30} />
        <h1>Libro de Reclamaciones</h1>
        <p>
          Registra aqui tu reclamo o queja sobre un producto o servicio de {APP_NAME}, conforme al Codigo de
          Proteccion y Defensa del Consumidor (Ley N 29571).
        </p>
        <div className="complaint-hero-facts">
          <span>
            <ShieldCheck size={15} /> Registro gratuito
          </span>
          <span>
            <Clock3 size={15} /> Respuesta en 15 dias habiles
          </span>
          <span>
            <FileText size={15} /> Copia inmediata en PDF
          </span>
        </div>
      </section>

      <section className="complaint-book-page">
        {result ? (
          <div className="panel complaint-book-success">
            <CheckCircle2 size={44} color="var(--brand-black)" />
            <h2>{tipo === 'queja' ? 'Queja registrada' : 'Reclamo registrado'}</h2>
            <p>
              Quedo registrado con el numero <strong className="complaint-code">{result.code}</strong>. Guarda este
              numero para hacerle seguimiento. Te responderemos por escrito en un plazo maximo de 15 dias habiles.
            </p>
            <div className="complaint-book-success-actions">
              <button className="primary-button" onClick={downloadPdf}>
                <Download size={16} /> Descargar mi Hoja de Reclamacion
              </button>
              <RouterLink to="/" className="ghost-button">
                Volver al inicio
              </RouterLink>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            {generalError && <p className="login-error">{generalError}</p>}

            <section className="panel settings-section settings-section-important">
              <div className="settings-section-header">
                <MessageSquareWarning size={18} />
                <div className="panel-title">
                  <h2>Que deseas registrar</h2>
                  <p>Un reclamo se relaciona a un producto o servicio; una queja, a la atencion recibida</p>
                </div>
              </div>
              <div className="toggle-group">
                <ToggleField name="tipo" value="reclamo" currentValue={tipo} register={register}>
                  Reclamo
                </ToggleField>
                <ToggleField name="tipo" value="queja" currentValue={tipo} register={register}>
                  Queja
                </ToggleField>
              </div>
            </section>

            <section className="panel settings-section settings-section-green">
              <div className="settings-section-header">
                <User size={18} />
                <div className="panel-title">
                  <h2>Tus datos</h2>
                  <p>Informacion del consumidor reclamante</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Nombre completo
                  <input {...register('consumidor_nombre', { required: true })} />
                  {fieldErrors.consumidor_nombre && <span className="login-error">{fieldErrors.consumidor_nombre[0]}</span>}
                </label>
                <label>
                  Domicilio
                  <input {...register('consumidor_domicilio', { required: true })} />
                  {fieldErrors.consumidor_domicilio && <span className="login-error">{fieldErrors.consumidor_domicilio[0]}</span>}
                </label>
                <label>
                  DNI / CE
                  <input {...register('consumidor_documento', { required: true })} />
                  {fieldErrors.consumidor_documento && <span className="login-error">{fieldErrors.consumidor_documento[0]}</span>}
                </label>
                <label>
                  Telefono (opcional)
                  <input {...register('consumidor_telefono')} />
                </label>
                <label>
                  Correo electronico
                  <input type="email" {...register('consumidor_email', { required: true })} />
                  {fieldErrors.consumidor_email && <span className="login-error">{fieldErrors.consumidor_email[0]}</span>}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" {...register('es_menor')} /> Soy menor de edad
                </label>
                {esMenor && (
                  <label>
                    Nombre del padre, madre o representante
                    <input {...register('representante_nombre', { required: esMenor })} />
                    {fieldErrors.representante_nombre && <span className="login-error">{fieldErrors.representante_nombre[0]}</span>}
                  </label>
                )}
              </div>
            </section>

            <section className="panel settings-section settings-section-gold">
              <div className="settings-section-header">
                <FileText size={18} />
                <div className="panel-title">
                  <h2>Producto o servicio</h2>
                  <p>Sobre que bien contratado trata tu {tipo === 'queja' ? 'queja' : 'reclamo'}</p>
                </div>
              </div>
              <div className="toggle-group toggle-group-compact">
                <ToggleField name="bien_tipo" value="producto" currentValue={bienTipo} register={register}>
                  Producto
                </ToggleField>
                <ToggleField name="bien_tipo" value="servicio" currentValue={bienTipo} register={register}>
                  Servicio
                </ToggleField>
              </div>
              <div className="form-grid">
                <label>
                  Monto reclamado (opcional, en soles)
                  <input type="number" step="0.01" min="0" {...register('monto_reclamado')} />
                </label>
                <label>
                  Descripcion del producto o servicio
                  <textarea rows={2} {...register('bien_descripcion', { required: true })} />
                  {fieldErrors.bien_descripcion && <span className="login-error">{fieldErrors.bien_descripcion[0]}</span>}
                </label>
              </div>
            </section>

            <section className="panel settings-section settings-section-green">
              <div className="settings-section-header">
                <MessageSquareWarning size={18} />
                <div className="panel-title">
                  <h2>Detalle y pedido</h2>
                  <p>Cuentanos que paso y que solucion esperas</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Detalle de tu {tipo === 'queja' ? 'queja' : 'reclamo'}
                  <textarea rows={4} {...register('detalle', { required: true })} />
                  {fieldErrors.detalle && <span className="login-error">{fieldErrors.detalle[0]}</span>}
                </label>
                <label>
                  ¿Que pides como solucion?
                  <textarea rows={3} {...register('pedido', { required: true })} />
                  {fieldErrors.pedido && <span className="login-error">{fieldErrors.pedido[0]}</span>}
                </label>
              </div>
            </section>

            <section className="panel settings-section settings-section-important">
              <div className="settings-section-header">
                <ShieldCheck size={18} />
                <div className="panel-title">
                  <h2>Confirmacion</h2>
                  <p>Ultimo paso antes de registrar tu {tipo === 'queja' ? 'queja' : 'reclamo'}</p>
                </div>
              </div>
              <div className="form-grid">
                <label className="checkbox-label">
                  <input type="checkbox" {...register('enviar_copia_email')} /> Enviarme una copia de mi Hoja de
                  Reclamacion a mi correo
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" {...register('consumidor_acepta', { required: true })} /> Declaro que la
                  informacion consignada es verdadera y acepto el registro de este {tipo === 'queja' ? 'queja' : 'reclamo'},
                  en reemplazo de mi firma
                </label>
                {fieldErrors.consumidor_acepta && <span className="login-error">{fieldErrors.consumidor_acepta[0]}</span>}
              </div>
              <button className="primary-button complaint-submit" disabled={formState.isSubmitting}>
                Registrar {tipo === 'queja' ? 'queja' : 'reclamo'}
              </button>
            </section>
          </form>
        )}
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} {APP_NAME}</span>
      </footer>
    </div>
  );
}

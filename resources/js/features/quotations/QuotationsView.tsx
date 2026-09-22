import { Banknote, CheckCircle2, FileSignature, FileText, Mail, Pencil, Plus, Receipt, Search, Settings, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../../apiClient';
import { Badge, ConfirmModal, Loading, Modal, PanelTitle, useToast } from '../../components/ui';
import { money } from '../../lib/constants';
import { Client, Project, Quotation, SunatDocument } from '../../types';

export function QuotationsView() {
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: async () => (await api.get<Client[]>('/clients')).data });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get<Project[]>('/projects')).data });
  const { data: quotations = [], isLoading: loadingQuotations } = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => (await api.get<Quotation[]>('/quotations')).data,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState<Quotation | null>(null);
  const [emitting, setEmitting] = useState<Quotation | null>(null);
  const [paying, setPaying] = useState<Quotation | null>(null);
  const [emailingQuotation, setEmailingQuotation] = useState<Quotation | null>(null);
  const [emailingDocument, setEmailingDocument] = useState<{ document: SunatDocument; email: string } | null>(null);
  const [search, setSearch] = useState('');
  const [sunatSettingsOpen, setSunatSettingsOpen] = useState(false);
  const { data: sunatSettings } = useQuery({
    queryKey: ['sunat-settings'],
    queryFn: async () => (await api.get<{ env: 'sandbox' | 'production'; has_production_token: boolean }>('/sunat-settings')).data,
  });

  const downloadFile = async (path: string, filename: string) => {
    const response = await api.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = (id: number, number: string) => downloadFile(`/quotations/${id}/pdf`, `${number}.pdf`);
  const downloadContractPdf = (id: number, number: string) =>
    downloadFile(`/quotations/${id}/contract-pdf`, `${number}-CONTRATO.pdf`);

  const query = search.toLowerCase();
  const filtered = quotations.filter((quotation) => `${quotation.number} ${quotation.client.name}`.toLowerCase().includes(query));

  return (
    <>
      <div className="quotation-toolbar">
        <button className="primary-button" onClick={() => setFormOpen(true)}>
          <Plus size={17} /> Nueva cotizacion
        </button>
        <label className="search">
          <Search size={18} />
          <input placeholder="Buscar por cliente o numero..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {sunatSettings && (
          <Badge
            label={sunatSettings.env === 'production' ? 'SUNAT: Produccion (real)' : 'SUNAT: Pruebas (sandbox)'}
            tone={sunatSettings.env === 'production' ? 'danger' : 'warning'}
          />
        )}
        <button type="button" className="ghost-button" onClick={() => setSunatSettingsOpen(true)}>
          <Settings size={15} /> Configuracion SUNAT
        </button>
      </div>

      {loadingQuotations ? (
        <Loading />
      ) : (
      <div className="stack">
        {filtered.map((quotation) => {
          const accepted = quotation.sunat_documents?.find((doc) => doc.estado === 'aceptado');
          return (
            <article className={`quote-card ${accepted ? 'is-accepted' : ''}`} key={quotation.id}>
              <div>
                <strong>{quotation.number}</strong>
                <span>{quotation.client.name}</span>
              </div>
              <div>
                <strong className="quote-total-amount">{money(quotation.total)}</strong>
                <div>
                  <Badge
                    label={quotation.payment_status === 'Pendiente' ? 'Sin cobrar' : `${quotation.payment_status} — saldo ${money(quotation.balance_due)}`}
                    tone={quotation.payment_status === 'Pagado' ? 'success' : quotation.payment_status === 'Parcial' ? 'normal' : 'danger'}
                  />
                </div>
              </div>
              <div className="card-actions" style={{ gridColumn: '1 / -1' }}>
                <button className="ghost-button" onClick={() => downloadPdf(quotation.id, quotation.number)}>
                  <FileText size={15} /> Descargar PDF
                </button>
                <button className="ghost-button" onClick={() => downloadContractPdf(quotation.id, quotation.number)}>
                  <FileSignature size={15} /> Descargar contrato
                </button>
                <button className="ghost-button" onClick={() => setEmailingQuotation(quotation)}>
                  <Mail size={15} /> Enviar cotizacion
                </button>
                <button className="ghost-button ghost-button-accent" onClick={() => setPaying(quotation)}>
                  <Banknote size={15} /> Registrar pago
                </button>
                {accepted ? (
                  <>
                    <Badge label={`${accepted.serie}-${accepted.numero} · Aceptado`} tone="success" />
                    {accepted.pdf_ticket_url && (
                      <a className="ghost-button" href={accepted.pdf_ticket_url} target="_blank" rel="noopener noreferrer">
                        PDF Ticket
                      </a>
                    )}
                    {accepted.pdf_a4_url && (
                      <a className="ghost-button" href={accepted.pdf_a4_url} target="_blank" rel="noopener noreferrer">
                        PDF A4
                      </a>
                    )}
                    <button className="ghost-button" onClick={() => setEmailingDocument({ document: accepted, email: quotation.client.email })}>
                      <Mail size={15} /> Enviar comprobante
                    </button>
                  </>
                ) : (
                  <>
                    <Badge label="Sin comprobante" tone="normal" />
                    <button className="ghost-button ghost-button-accent" onClick={() => setEmitting(quotation)}>
                      <Receipt size={15} /> Emitir comprobante
                    </button>
                    <button className="ghost-button" onClick={() => setEditing(quotation)}>
                      <Pencil size={15} /> Editar
                    </button>
                    <button className="ghost-button ghost-button-danger" onClick={() => setDeleting(quotation)}>
                      <Trash2 size={15} /> Eliminar
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <section className="panel">{quotations.length === 0 ? 'Aun no hay cotizaciones.' : 'No hay cotizaciones que coincidan con tu busqueda.'}</section>
        )}
      </div>
      )}

      {formOpen && <QuotationFormModal clients={clients} projects={projects} onClose={() => setFormOpen(false)} />}
      {editing && <QuotationFormModal clients={clients} projects={projects} quotation={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteQuotationModal quotation={deleting} onClose={() => setDeleting(null)} />}
      {emitting && <EmitSunatDocumentModal quotation={emitting} onClose={() => setEmitting(null)} />}
      {sunatSettingsOpen && <SunatSettingsModal onClose={() => setSunatSettingsOpen(false)} />}
      {emailingQuotation && (
        <SendEmailModal
          title={`Enviar cotizacion ${emailingQuotation.number}`}
          defaultEmail={emailingQuotation.client.email}
          onSend={(email) => api.post(`/quotations/${emailingQuotation.id}/send-email`, { email })}
          onClose={() => setEmailingQuotation(null)}
        />
      )}
      {emailingDocument && (
        <SendEmailModal
          title={`Enviar ${emailingDocument.document.tipo === 'factura' ? 'factura' : 'boleta'} ${emailingDocument.document.serie}-${emailingDocument.document.numero}`}
          defaultEmail={emailingDocument.email}
          onSend={(email) => api.post(`/sunat-documents/${emailingDocument.document.id}/send-email`, { email })}
          onClose={() => setEmailingDocument(null)}
        />
      )}
      {paying && <PaymentsModal quotation={paying} onClose={() => setPaying(null)} />}
    </>
  );
}

type QuotationFormValues = {
  client_id: string;
  project_id: string;
  delivery_time: string;
  advance_percentage: number;
  extra_terms: string;
  includes_igv: boolean;
  items: { title: string; description: string; amount: number | '' }[];
};

const emptyItem = { title: '', description: '', amount: '' as number | '' };

function QuotationFormModal({
  clients,
  projects,
  quotation,
  onClose,
}: {
  clients: Client[];
  projects: Project[];
  quotation?: Quotation;
  onClose: () => void;
}) {
  const isEdit = !!quotation;
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<Quotation | null>(null);
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<QuotationFormValues>({
    defaultValues: quotation
      ? {
          client_id: String(quotation.client.id),
          project_id: quotation.project ? String(quotation.project.id) : '',
          delivery_time: quotation.delivery_time,
          advance_percentage: quotation.advance_percentage ?? 50,
          extra_terms: quotation.extra_terms ?? '',
          includes_igv: quotation.includes_igv ?? true,
          items: quotation.items.map((item) => ({
            title: item.title ?? '',
            description: item.description ?? '',
            amount: Number(item.unit_price),
          })),
        }
      : {
          client_id: '',
          project_id: '',
          delivery_time: '28 dias calendario',
          advance_percentage: 50,
          extra_terms: '',
          includes_igv: true,
          items: [{ ...emptyItem }],
        },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const includesIgv = watch('includes_igv');

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const igv = includesIgv ? subtotal * 0.18 : 0;
    return { subtotal, igv, total: subtotal + igv };
  }, [items, includesIgv]);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: unknown) =>
      isEdit ? api.put<Quotation>(`/quotations/${quotation!.id}`, payload) : api.post<Quotation>('/quotations', payload),
    onSuccess: (response) => {
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreated(response.data);
    },
    onError: (err) =>
      setSubmitError(
        axios.isAxiosError(err)
          ? err.response?.data?.message ?? 'No se pudo guardar la cotizacion.'
          : 'No se pudo guardar la cotizacion.',
      ),
  });

  const downloadFile = async (path: string, filename: string) => {
    const response = await api.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => created && downloadFile(`/quotations/${created.id}/pdf`, `${created.number}.pdf`);
  const downloadContractPdf = () => created && downloadFile(`/quotations/${created.id}/contract-pdf`, `${created.number}-CONTRATO.pdf`);

  if (created) {
    return (
      <Modal title={isEdit ? 'Cambios guardados' : 'Cotizacion generada'} onClose={onClose} narrow>
        <div className="confirm-icon">
          <CheckCircle2 />
        </div>
        <div className="quote-success">
          <strong>{created.number}</strong>
          <span>{created.client.name}</span>
          <span>Total: {money(created.total)}</span>
        </div>
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="ghost-button" onClick={downloadPdf}>
            <FileText size={15} /> Descargar PDF
          </button>
          <button type="button" className="ghost-button" onClick={downloadContractPdf}>
            <FileSignature size={15} /> Descargar contrato
          </button>
          <button className="primary-button" onClick={onClose}>
            Listo
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isEdit ? `Editar cotizacion — ${quotation!.number}` : 'Nueva cotizacion'} onClose={onClose} wide>
      <form
        className="form-grid"
        onSubmit={handleSubmit((values) =>
          mutation.mutate({
            client_id: Number(values.client_id),
            project_id: values.project_id ? Number(values.project_id) : null,
            delivery_time: values.delivery_time,
            advance_percentage: values.advance_percentage,
            extra_terms: values.extra_terms || null,
            includes_igv: values.includes_igv,
            items: values.items.map((item) => ({ ...item, amount: Number(item.amount) })),
          }),
        )}
      >
        <label>
          Cliente
          <select {...register('client_id', { required: true })}>
            <option value="">Selecciona un cliente...</option>
            {clients.map((client) => (
              <option value={client.id} key={client.id}>
                {client.name}
                {client.company ? ` — ${client.company}` : ''}
              </option>
            ))}
          </select>
          {errors.client_id && <span className="field-error">Elige el cliente para esta cotizacion.</span>}
        </label>
        <label>
          Proyecto (opcional)
          <select {...register('project_id')}>
            <option value="">Sin proyecto asociado</option>
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.code} - {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tiempo de entrega
          <input placeholder="Ej: 2 días hábiles" {...register('delivery_time', { required: true })} />
        </label>
        <label>
          Adelanto (%)
          <input type="number" min={0} max={100} {...register('advance_percentage', { valueAsNumber: true })} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" {...register('includes_igv')} /> Incluir IGV (18%)
        </label>

        <div>
          <PanelTitle title="Que se va a cotizar" subtitle="Agrega cada ambiente o trabajo por separado, con su costo" />
          <div className="stack">
            {fields.map((field, index) => (
              <div className="quote-item-card" key={field.id}>
                <div className="quote-item-card-head">
                  <span className="quote-item-label">
                    <span className="quote-item-badge">{index + 1}</span> Trabajo a cotizar
                  </span>
                  {fields.length > 1 && (
                    <button type="button" className="quote-remove-button" onClick={() => remove(index)}>
                      <Trash2 size={13} /> Quitar
                    </button>
                  )}
                </div>
                <div className="form-grid">
                  <label>
                    Nombre del trabajo
                    <input placeholder="Ej: Cambio de batería" {...register(`items.${index}.title` as const, { required: true })} />
                    {errors.items?.[index]?.title && <span className="field-error">Ponle un nombre a este item.</span>}
                  </label>
                  <label>
                    Costo (S/)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...register(`items.${index}.amount` as const, { required: true, valueAsNumber: true })}
                    />
                    {errors.items?.[index]?.amount && <span className="field-error">Ingresa el costo.</span>}
                  </label>
                  <label>
                    Detalles (opcional, uno por linea)
                    <textarea
                      rows={3}
                      placeholder={'Ej:\nBatería 12V 45Ah\nMano de obra incluida'}
                      {...register(`items.${index}.description` as const)}
                    />
                  </label>
                </div>
              </div>
            ))}
            <button type="button" className="ghost-button" onClick={() => append({ ...emptyItem })}>
              <Plus size={14} /> Agregar otro item
            </button>
          </div>
        </div>

        <label>
          Condiciones extra (opcional)
          <textarea rows={2} placeholder="Ej: Incluye repuestos y mano de obra" {...register('extra_terms')} />
        </label>

        <div className="quote-totals-box">
          <div className="row">
            <span>Subtotal</span>
            <span>{money(totals.subtotal)}</span>
          </div>
          <div className="row">
            <span>IGV (18%){!includesIgv && ' — no incluido'}</span>
            <span>{money(totals.igv)}</span>
          </div>
          <div className="row total">
            <span>Total</span>
            <span>{money(totals.total)}</span>
          </div>
        </div>

        {submitError && <p className="login-error" style={{ gridColumn: '1 / -1' }}>{submitError}</p>}

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Generar cotizacion'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EmitSunatDocumentModal({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const client = quotation.client;
  const hasClientDocs = !!client.document_type && !!client.document_number;
  const tipoLabel = client.document_type === '6' ? 'Factura' : 'Boleta';
  const { data: sunatSettings } = useQuery({
    queryKey: ['sunat-settings'],
    queryFn: async () => (await api.get<{ env: 'sandbox' | 'production'; has_production_token: boolean }>('/sunat-settings')).data,
  });

  const mutation = useMutation({
    mutationFn: () => api.post<SunatDocument>(`/quotations/${quotation.id}/sunat-document`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: (err) => setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo emitir el comprobante.' : 'No se pudo emitir el comprobante.'),
  });

  const result = mutation.data?.data;

  return (
    <Modal title="Emitir comprobante" onClose={onClose} narrow>
      {sunatSettings && (
        <div className="badge-row" style={{ justifyContent: 'center', marginBottom: 12 }}>
          <Badge
            label={sunatSettings.env === 'production' ? 'Modo: PRODUCCION (comprobante real)' : 'Modo: PRUEBAS (sandbox)'}
            tone={sunatSettings.env === 'production' ? 'danger' : 'warning'}
          />
        </div>
      )}
      {!hasClientDocs && (
        <p className="confirm-text">
          El cliente <strong>{client.name}</strong> no tiene completos sus datos para facturar (tipo y numero de documento). Ve a la seccion{' '}
          <strong>Clientes</strong> y complétalo antes de emitir el comprobante.
        </p>
      )}

      {hasClientDocs && !result && (
        <>
          <p className="confirm-text">
            Vas a emitir una <strong>{tipoLabel}</strong> a nombre de <strong>{client.name}</strong> (
            {client.document_type === '6' ? 'RUC' : 'DNI'} {client.document_number}) por <strong>{money(quotation.total)}</strong>.
          </p>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions" style={{ justifyContent: 'center' }}>
            <button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Enviando a SUNAT...' : 'Confirmar y emitir'}
            </button>
          </div>
        </>
      )}

      {result && result.estado === 'aceptado' && (
        <>
          <div className="confirm-icon">
            <CheckCircle2 />
          </div>
          <p className="confirm-text">
            {tipoLabel} <strong>{result.serie}-{result.numero}</strong> aceptada por SUNAT.
          </p>
          <div className="modal-actions" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {result.pdf_ticket_url && (
              <a className="ghost-button" href={result.pdf_ticket_url} target="_blank" rel="noopener noreferrer">
                PDF Ticket
              </a>
            )}
            {result.pdf_a4_url && (
              <a className="ghost-button" href={result.pdf_a4_url} target="_blank" rel="noopener noreferrer">
                PDF A4
              </a>
            )}
            {result.xml_url && (
              <a className="ghost-button" href={result.xml_url} target="_blank" rel="noopener noreferrer">
                XML
              </a>
            )}
            {result.cdr_url && (
              <a className="ghost-button" href={result.cdr_url} target="_blank" rel="noopener noreferrer">
                CDR
              </a>
            )}
            <button className="primary-button" onClick={onClose}>
              Listo
            </button>
          </div>
        </>
      )}

      {result && result.estado !== 'aceptado' && (
        <>
          <p className="login-error">{result.mensaje ?? 'SUNAT rechazo el comprobante.'}</p>
          <div className="modal-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="ghost-button" onClick={onClose}>
              Cerrar
            </button>
            <button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Reintentar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

type SunatSettingsPayload = { env: 'sandbox' | 'production'; has_production_token: boolean };

function SunatSettingsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['sunat-settings'],
    queryFn: async () => (await api.get<SunatSettingsPayload>('/sunat-settings')).data,
  });
  const [env, setEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [token, setToken] = useState('');
  const [confirmingProduction, setConfirmingProduction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setEnv(data.env);
  }, [data?.env]);

  const saveMutation = useMutation({
    mutationFn: (payload: { env: string; token_production?: string }) => api.put<SunatSettingsPayload>('/sunat-settings', payload),
    onSuccess: (response) => {
      queryClient.setQueryData(['sunat-settings'], response.data);
      setToken('');
      setError(null);
      notify('Configuracion de SUNAT actualizada');
      onClose();
    },
    onError: (err) => setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo guardar.' : 'No se pudo guardar.'),
  });

  const doSave = () => {
    const payload: { env: string; token_production?: string } = { env };
    if (token.trim()) payload.token_production = token.trim();
    saveMutation.mutate(payload);
  };

  const handleSave = () => {
    setError(null);
    if (env === 'production' && data?.env !== 'production') {
      setConfirmingProduction(true);
      return;
    }
    doSave();
  };

  return (
    <>
      <Modal title="Configuracion de facturacion electronica" onClose={onClose}>
        {isLoading || !data ? (
          <Loading />
        ) : (
          <div className="form-grid">
            <div className="badge-row" style={{ justifyContent: 'center' }}>
              <Badge
                label={data.env === 'production' ? 'Modo actual: PRODUCCION (real)' : 'Modo actual: PRUEBAS (sandbox)'}
                tone={data.env === 'production' ? 'danger' : 'warning'}
              />
            </div>

            <div className="toggle-group">
              <label className={`toggle-option ${env === 'sandbox' ? 'is-active' : ''}`}>
                <input type="radio" className="sr-only" checked={env === 'sandbox'} onChange={() => setEnv('sandbox')} />
                Pruebas
              </label>
              <label className={`toggle-option ${env === 'production' ? 'is-active' : ''}`}>
                <input type="radio" className="sr-only" checked={env === 'production'} onChange={() => setEnv('production')} />
                Produccion
              </label>
            </div>

            {env === 'production' && (
              <>
                <p className="confirm-text" style={{ textAlign: 'left' }}>
                  En modo produccion, cada boleta o factura que emitas es un comprobante <strong>real</strong> reportado a SUNAT y no se
                  puede deshacer. Necesitas el token de produccion que te entrega tu proveedor de facturacion electronica.
                </p>
                <label>
                  Token de produccion {data.has_production_token && '(ya configurado — dejalo vacio para no cambiarlo)'}
                  <input
                    type="password"
                    placeholder={data.has_production_token ? '••••••••••••' : 'Pega aqui el token de produccion'}
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                  />
                </label>
              </>
            )}

            {error && <p className="login-error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="primary-button" onClick={handleSave} disabled={saveMutation.isPending}>
                Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>
      {confirmingProduction && (
        <ConfirmModal
          title="Activar modo produccion"
          message="Vas a activar la emision de comprobantes REALES ante SUNAT. Desde este momento, cada boleta o factura que generes se reporta de verdad y no se puede deshacer. ¿Confirmas?"
          confirmLabel="Si, activar produccion"
          pending={saveMutation.isPending}
          onConfirm={() => {
            setConfirmingProduction(false);
            doSave();
          }}
          onClose={() => setConfirmingProduction(false)}
        />
      )}
    </>
  );
}

const PAYMENT_METHODS = ['Efectivo', 'Yape', 'Transferencia', 'Deposito', 'Tarjeta', 'Otro'];

function PaymentsModal({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [active, setActive] = useState(quotation);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<{ id: number; amount: number | string } | null>(null);
  const { register, handleSubmit, reset, setValue } = useForm({
    defaultValues: { amount: '' as number | '', paid_at: new Date().toISOString().slice(0, 10), method: PAYMENT_METHODS[0], notes: '' },
  });

  const invalidateFinance = () => {
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
    queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    queryClient.invalidateQueries({ queryKey: ['finance-ledger'] });
    queryClient.invalidateQueries({ queryKey: ['finance-projects'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const registerPayment = useMutation({
    mutationFn: (payload: unknown) => api.post<Quotation>(`/quotations/${quotation.id}/payments`, payload),
    onSuccess: (response) => {
      setError(null);
      setActive(response.data);
      setShowMore(false);
      reset({ amount: '', paid_at: new Date().toISOString().slice(0, 10), method: PAYMENT_METHODS[0], notes: '' });
      invalidateFinance();
      notify('Pago registrado correctamente');
    },
    onError: (err) =>
      setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo registrar el pago.' : 'No se pudo registrar el pago.'),
  });

  const voidMutation = useMutation({
    mutationFn: (paymentId: number) => api.delete<Quotation>(`/quotation-payments/${paymentId}`),
    onSuccess: (response) => {
      setActive(response.data);
      invalidateFinance();
      setVoidingPayment(null);
      notify('Pago anulado correctamente');
    },
    onError: () => notify('No se pudo anular el pago. Intenta de nuevo.', 'error'),
  });

  return (
    <>
    <Modal title={`Pagos — ${quotation.number}`} onClose={onClose}>
      <div className="quote-totals-box">
        <div className="row">
          <span>Total cotizado</span>
          <span>{money(active.total)}</span>
        </div>
        <div className="row">
          <span>Cobrado</span>
          <span>{money(active.paid_amount)}</span>
        </div>
        <div className="row total">
          <span>Saldo pendiente</span>
          <span>{money(active.balance_due)}</span>
        </div>
      </div>

      <div className="stack" style={{ margin: '16px 0' }}>
        {(active.payments ?? []).map((payment) => (
          <article className="list-item" key={payment.id}>
            <div className="list-item-heading">
              <strong>{money(payment.amount)}</strong>
              <Badge label={payment.method} tone="normal" />
            </div>
            <span>
              {payment.paid_at.slice(0, 10)}
              {payment.notes ? ` · ${payment.notes}` : ''}
            </span>
            <div className="card-actions">
              <button
                className="ghost-button ghost-button-danger"
                onClick={() => setVoidingPayment({ id: payment.id, amount: payment.amount })}
                disabled={voidMutation.isPending}
              >
                <Trash2 size={14} /> Anular
              </button>
            </div>
          </article>
        ))}
        {(active.payments ?? []).length === 0 && <span>Aun no se ha registrado ningun pago.</span>}
      </div>

      {active.balance_due > 0.01 && (
        <form
          className="form-grid"
          onSubmit={handleSubmit((values) =>
            registerPayment.mutate({ ...values, amount: Number(values.amount) }),
          )}
        >
          <label>
            Monto (S/)
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={active.balance_due}
              placeholder="0.00"
              {...register('amount', { required: true, valueAsNumber: true })}
            />
          </label>
          <div className="card-actions" style={{ gridColumn: '1 / -1', marginTop: -8 }}>
            <button type="button" className="ghost-button" onClick={() => setValue('amount', active.balance_due)}>
              Pagar el saldo completo ({money(active.balance_due)})
            </button>
          </div>

          <button
            type="button"
            className="ghost-button"
            style={{ gridColumn: '1 / -1', justifySelf: 'start' }}
            onClick={() => setShowMore((value) => !value)}
          >
            {showMore ? 'Ocultar detalles' : 'Mas detalles (fecha, metodo, notas)'}
          </button>

          {showMore && (
            <>
              <label>
                Fecha
                <input type="date" {...register('paid_at', { required: true })} />
              </label>
              <label>
                Metodo
                <select {...register('method')}>
                  {PAYMENT_METHODS.map((method) => (
                    <option value={method} key={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notas (opcional)
                <input {...register('notes')} />
              </label>
            </>
          )}
          {error && <p className="login-error" style={{ gridColumn: '1 / -1' }}>{error}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              Cerrar
            </button>
            <button className="primary-button" disabled={registerPayment.isPending}>
              Registrar pago
            </button>
          </div>
        </form>
      )}

      {active.balance_due <= 0.01 && (
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <Badge label="Cotizacion pagada por completo" tone="success" />
        </div>
      )}
    </Modal>
    {voidingPayment && (
      <ConfirmModal
        title="Anular pago"
        message={`Esto anulara el pago de ${money(voidingPayment.amount)} y el saldo pendiente de la cotizacion aumentara. Esta accion no se puede deshacer.`}
        confirmLabel="Anular pago"
        pending={voidMutation.isPending}
        onConfirm={() => voidMutation.mutate(voidingPayment.id)}
        onClose={() => setVoidingPayment(null)}
      />
    )}
    </>
  );
}

function DeleteQuotationModal({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.delete(`/quotations/${quotation.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notify('Cotizacion eliminada correctamente');
      onClose();
    },
    onError: (err) => setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo eliminar la cotizacion.' : 'No se pudo eliminar la cotizacion.'),
  });

  return (
    <Modal title="Eliminar cotizacion" onClose={onClose} narrow>
      <p>
        ¿Seguro que quieres eliminar <strong>{quotation.number}</strong> de <strong>{quotation.client.name}</strong>? Esta accion no se
        puede deshacer.
      </p>
      {error && <p className="login-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onClose}>
          Cancelar
        </button>
        <button className="danger-button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Trash2 size={16} /> Confirmar eliminar
        </button>
      </div>
    </Modal>
  );
}

function SendEmailModal({
  title,
  defaultEmail,
  onSend,
  onClose,
}: {
  title: string;
  defaultEmail: string | null;
  onSend: (email: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await onSend(email);
      setSent(true);
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'No se pudo enviar el correo.' : 'No se pudo enviar el correo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} narrow>
      {sent ? (
        <>
          <div className="confirm-icon">
            <CheckCircle2 />
          </div>
          <p className="confirm-text">
            Enviado correctamente a <strong>{email}</strong>.
          </p>
          <div className="modal-actions" style={{ justifyContent: 'center' }}>
            <button className="primary-button" onClick={onClose}>
              Listo
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="confirm-text">Se enviara por correo, con el PDF o los links del comprobante segun corresponda.</p>
          <label>
            Correo del cliente
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@correo.com" />
          </label>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-button" onClick={handleSend} disabled={sending || !email}>
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

import { Ban, Download, FolderOpen, Plus, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { Badge, Loading, Modal, useToast } from '../../components/ui';
import { money, toIsoDate } from '../../lib/constants';
import { downloadFile, errorMessage, formatDate } from '../../lib/taller';
import type { Invoice } from '../../types-taller';

type Folder = { folder: string; count: number; voided: number };

export function InvoicesView() {
  const [folder, setFolder] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [voiding, setVoiding] = useState<Invoice | null>(null);

  const { data: folders = [] } = useQuery({ queryKey: ['invoice-folders'], queryFn: async () => (await api.get<Folder[]>('/invoices/folders')).data });
  const { data = [], isLoading } = useQuery({
    queryKey: ['invoices', folder, type, search],
    queryFn: async () => (await api.get<Invoice[]>('/invoices', { params: { folder: folder || undefined, type: type || undefined, search: search || undefined } })).data,
  });

  return (
    <>
      <div className="toolbar">
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus size={17} /> Registrar comprobante
        </button>
        <div className="toggle-group toggle-group-compact">
          {[
            ['', 'Todos'],
            ['Boleta simple', 'Boletas'],
            ['Factura', 'Facturas'],
          ].map(([value, label]) => (
            <button key={value} className={`toggle-option ${type === value ? 'is-active' : ''}`} onClick={() => setType(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número o cliente" />
        </label>
      </div>

      <div className="folder-row">
        <button className={`folder-chip ${folder === '' ? 'is-active' : ''}`} onClick={() => setFolder('')}>
          <FolderOpen size={15} /> Todas
        </button>
        {folders.map((item) => (
          <button key={item.folder} className={`folder-chip ${folder === item.folder ? 'is-active' : ''}`} onClick={() => setFolder(item.folder)}>
            <FolderOpen size={15} /> {item.folder} <small>({item.count})</small>
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Número</th>
                <th>Emisión</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((invoice) => (
                <tr key={invoice.id} className={invoice.status === 'Dado de baja' ? 'row-voided' : ''}>
                  <td data-label="Tipo">{invoice.type}</td>
                  <td data-label="Número">
                    <strong>{invoice.number}</strong>
                    <span>Carpeta {invoice.folder}</span>
                  </td>
                  <td data-label="Emisión">{formatDate(invoice.issue_date)}</td>
                  <td data-label="Cliente">{invoice.customer_name ?? '—'}</td>
                  <td data-label="Total">{invoice.total ? money(invoice.total) : '—'}</td>
                  <td data-label="Estado">
                    <Badge label={invoice.status} tone={invoice.status === 'Emitido' ? 'success' : 'danger'} />
                    {invoice.void_reason && <span>{invoice.void_reason}</span>}
                  </td>
                  <td>
                    <div className="card-actions">
                      <button className="ghost-button" onClick={() => downloadFile(`/invoices/${invoice.id}/download`, undefined, `${invoice.number}.pdf`)}>
                        <Download size={14} /> Descargar
                      </button>
                      {invoice.status === 'Emitido' && (
                        <button className="ghost-button ghost-button-danger" onClick={() => setVoiding(invoice)}>
                          <Ban size={14} /> Dar de baja
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7}>No hay comprobantes en esta vista.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {creating && <InvoiceFormModal onClose={() => setCreating(false)} />}
      {voiding && <VoidModal invoice={voiding} onClose={() => setVoiding(null)} />}
    </>
  );
}

type InvoiceForm = { type: string; number: string; issue_date: string; customer_name: string; total: string; file: FileList };

function InvoiceFormModal({ onClose }: { onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm<InvoiceForm>({ defaultValues: { type: 'Boleta simple', issue_date: toIsoDate(new Date()) } });

  const mutation = useMutation({
    mutationFn: async (values: InvoiceForm) => {
      const form = new FormData();
      form.append('type', values.type);
      form.append('number', values.number);
      form.append('issue_date', values.issue_date);
      if (values.customer_name) form.append('customer_name', values.customer_name);
      if (values.total) form.append('total', values.total);
      form.append('file', values.file[0]);
      return api.post('/invoices', form);
    },
    onSuccess: () => {
      notify('Comprobante archivado.');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-folders'] });
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title="Registrar comprobante" onClose={onClose}>
      <form className="form-grid two-columns" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label>
          Tipo
          <select {...register('type')}>
            <option>Boleta simple</option>
            <option>Factura</option>
          </select>
        </label>
        <label>
          Número
          <input {...register('number', { required: true })} placeholder="B001-000123" />
        </label>
        <label>
          Fecha de emisión
          <input type="date" {...register('issue_date', { required: true })} />
        </label>
        <label>
          Total (S/)
          <input type="number" step="0.01" min="0" {...register('total')} />
        </label>
        <label className="span-2">
          Cliente
          <input {...register('customer_name')} />
        </label>
        <label className="span-2">
          Archivo (PDF o imagen, máx. 10 MB)
          <input type="file" accept="application/pdf,image/jpeg,image/png" {...register('file', { required: true })} />
        </label>
        <div className="modal-actions span-2">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            {mutation.isPending ? 'Subiendo...' : 'Archivar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VoidModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: async () => api.post(`/invoices/${invoice.id}/void`, { reason }),
    onSuccess: () => {
      notify('Comprobante dado de baja.');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-folders'] });
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title={`Dar de baja ${invoice.number}`} onClose={onClose} narrow>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="confirm-text">El archivo se conserva, pero el comprobante queda marcado como dado de baja.</p>
        <label>
          Motivo
          <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} required />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="danger-button" disabled={mutation.isPending || !reason.trim()}>
            Dar de baja
          </button>
        </div>
      </form>
    </Modal>
  );
}

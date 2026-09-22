import { ArrowDownToLine, ArrowUpFromLine, Pencil, Plus, QrCode, ScanLine, Search, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../apiClient';
import { QrScanner } from '../../components/QrScanner';
import { Badge, ConfirmModal, Loading, Modal, useToast } from '../../components/ui';
import { money } from '../../lib/constants';
import { errorMessage, formatDateTime } from '../../lib/taller';
import type { CashOptions, InventoryItem, QrPayload } from '../../types-taller';

export function InventoryView() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);
  const [scanning, setScanning] = useState(false);
  const [moving, setMoving] = useState<InventoryItem | null>(null);
  const [qrItem, setQrItem] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['inventory', search, type, lowStock],
    queryFn: async () =>
      (await api.get<InventoryItem[]>('/inventory', { params: { search: search || undefined, type: type || undefined, low_stock: lowStock ? 1 : undefined } })).data,
  });

  return (
    <>
      <div className="toolbar">
        <button className="primary-button" onClick={() => setEditing('new')}>
          <Plus size={17} /> Nuevo ítem
        </button>
        <button className="ghost-button ghost-button-accent" onClick={() => setScanning(true)}>
          <ScanLine size={16} /> Escanear / ingresar código
        </button>
        <div className="toggle-group toggle-group-compact">
          {[
            ['', 'Todos'],
            ['Repuesto', 'Repuestos'],
            ['Herramienta', 'Herramientas'],
          ].map(([value, label]) => (
            <button key={value} className={`toggle-option ${type === value ? 'is-active' : ''}`} onClick={() => setType(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={lowStock} onChange={(event) => setLowStock(event.target.checked)} /> Solo stock bajo
        </label>
        <label className="search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o código" />
        </label>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <section className="table-panel">
          <table className="stack-on-mobile">
            <thead>
              <tr>
                <th>Código</th>
                <th>Ítem</th>
                <th>Stock</th>
                <th>Costo (sin IGV / IGV / total)</th>
                <th>Precio al cliente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td data-label="Código">{item.code ?? '—'}</td>
                  <td data-label="Ítem">
                    <strong>{item.name}</strong>
                    <span>{item.type}</span>
                  </td>
                  <td data-label="Stock">
                    <Badge label={String(item.stock)} tone={item.is_low_stock ? 'danger' : 'success'} />
                  </td>
                  <td data-label="Costo">
                    {money(item.cost_breakdown.base)} + {money(item.cost_breakdown.igv)} = <strong>{money(item.cost_breakdown.total)}</strong>
                  </td>
                  <td data-label="Precio al cliente">{money(item.price_breakdown.total)}</td>
                  <td>
                    <div className="card-actions">
                      <button className="ghost-button" onClick={() => setMoving(item)}>
                        Entrada / salida
                      </button>
                      <button className="ghost-button" onClick={() => setQrItem(item)} aria-label="Ver QR">
                        <QrCode size={14} />
                      </button>
                      <button className="ghost-button" onClick={() => setEditing(item)}>
                        <Pencil size={14} />
                      </button>
                      <button className="ghost-button ghost-button-danger" onClick={() => setDeleting(item)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6}>No hay ítems en el inventario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {editing && <ItemFormModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {scanning && <ScanModal onClose={() => setScanning(false)} />}
      {moving && <MovementModal item={moving} onClose={() => setMoving(null)} />}
      {qrItem && <ItemQrModal item={qrItem} onClose={() => setQrItem(null)} />}
      {deleting && <DeleteItemModal item={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

type ItemForm = { type: string; code: string; name: string; stock: string; min_stock: string; unit_cost: string; sale_price: string; includes_igv: boolean };

function ItemFormModal({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { data: options } = useQuery({ queryKey: ['cash-options'], queryFn: async () => (await api.get<CashOptions>('/cash-registers/options')).data });
  const { register, handleSubmit, watch } = useForm<ItemForm>({
    defaultValues: {
      type: item?.type ?? 'Repuesto',
      code: item?.code ?? '',
      name: item?.name ?? '',
      stock: item ? String(item.stock) : '0',
      min_stock: item ? String(item.min_stock) : '0',
      unit_cost: item?.unit_cost ?? '',
      sale_price: item?.sale_price ?? '',
      includes_igv: item?.includes_igv ?? false,
    },
  });

  const cost = Number(watch('unit_cost') || 0);
  const includes = watch('includes_igv');
  const rate = options?.igv_rate ?? 0.18;
  const base = includes ? cost / (1 + rate) : cost;
  const igv = includes ? cost - base : cost * rate;

  const mutation = useMutation({
    mutationFn: async (values: ItemForm) => {
      const payload: Record<string, unknown> = {
        ...values,
        code: values.code || null,
        sale_price: values.sale_price === '' ? null : values.sale_price,
      };
      if (item) delete payload.stock;
      return item ? api.put(`/inventory/${item.id}`, { ...payload, qr_data: item.qr_data }) : api.post('/inventory', payload);
    },
    onSuccess: () => {
      notify(item ? 'Ítem actualizado.' : 'Ítem creado.');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title={item ? 'Editar ítem' : 'Nuevo ítem'} onClose={onClose}>
      <form className="form-grid two-columns" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label>
          Tipo
          <select {...register('type')}>
            <option>Repuesto</option>
            <option>Herramienta</option>
          </select>
        </label>
        <label>
          Código (para búsqueda manual)
          <input {...register('code')} />
        </label>
        <label className="span-2">
          Nombre
          <input {...register('name', { required: true })} />
        </label>
        {!item && (
          <label>
            Stock inicial
            <input type="number" min={0} {...register('stock')} />
          </label>
        )}
        <label>
          Stock mínimo (alerta)
          <input type="number" min={0} {...register('min_stock')} />
        </label>
        <label>
          Costo unitario (S/)
          <input type="number" step="0.01" min="0" {...register('unit_cost', { required: true })} />
        </label>
        <label>
          Precio al cliente (S/, opcional)
          <input type="number" step="0.01" min="0" {...register('sale_price')} />
        </label>
        <label className="check-inline span-2">
          <input type="checkbox" {...register('includes_igv')} /> Los montos ya incluyen IGV
        </label>
        <p className="field-hint span-2">
          Costo sin IGV {money(base)} · IGV {Math.round(rate * 100)}% {money(igv)} · Total {money(base + igv)}
        </p>
        <div className="modal-actions span-2">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MovementModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<'Entrada' | 'Salida'>('Entrada');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');

  const { data: detail } = useQuery({ queryKey: ['inventory-item', item.id], queryFn: async () => (await api.get<InventoryItem>(`/inventory/${item.id}`)).data });

  const mutation = useMutation({
    mutationFn: async () => api.post(`/inventory/${item.id}/movements`, { type, quantity, unit_cost: type === 'Entrada' && unitCost !== '' ? unitCost : undefined, note: note || undefined }),
    onSuccess: () => {
      notify(`${type} registrada.`);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', item.id] });
      setQuantity(1);
      setNote('');
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return (
    <Modal title={`${item.name} · stock ${detail?.stock ?? item.stock}`} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="toggle-group">
          <button type="button" className={`toggle-option ${type === 'Entrada' ? 'is-active' : ''}`} onClick={() => setType('Entrada')}>
            <ArrowDownToLine size={14} /> Entrada
          </button>
          <button type="button" className={`toggle-option ${type === 'Salida' ? 'is-active' : ''}`} onClick={() => setType('Salida')}>
            <ArrowUpFromLine size={14} /> Salida
          </button>
        </div>
        <label>
          Cantidad
          <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} />
        </label>
        {type === 'Entrada' && (
          <label>
            Nuevo costo unitario (opcional)
            <input type="number" step="0.01" min="0" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder={item.unit_cost} />
          </label>
        )}
        <label>
          Nota
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={255} />
        </label>
        <button className="primary-button" disabled={mutation.isPending}>
          Registrar {type.toLowerCase()}
        </button>
      </form>

      <h3 className="form-section">Últimos movimientos</h3>
      <ul className="movement-list">
        {(detail?.movements ?? []).map((movement) => (
          <li key={movement.id}>
            <Badge label={movement.type} tone={movement.type === 'Entrada' ? 'success' : 'warning'} />
            <span>
              {movement.quantity} u. → stock {movement.stock_after}
            </span>
            <small>
              {formatDateTime(movement.created_at)} {movement.user ? `· ${movement.user.name}` : ''} {movement.note ? `· ${movement.note}` : ''}
            </small>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

type ScanResult = { found: boolean; item?: InventoryItem; qr_data?: Record<string, unknown> | null };

function ScanModal({ onClose }: { onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'Entrada' | 'Salida'>('Salida');
  const [quantity, setQuantity] = useState(1);
  const [manual, setManual] = useState('');
  const [payload, setPayload] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraOn, setCameraOn] = useState(true);

  const identify = async (text: string) => {
    setPayload(text);
    try {
      const { data } = await api.post<ScanResult>('/inventory/scan', { payload: text });
      setResult(data);
    } catch (error) {
      const response = (error as { response?: { status?: number; data?: ScanResult } }).response;
      if (response?.status === 404) setResult({ found: false, qr_data: response.data?.qr_data ?? null });
      else notify(errorMessage(error), 'error');
    }
  };

  const commit = useMutation({
    mutationFn: async () => (await api.post<ScanResult>('/inventory/scan', { payload, action, quantity, commit: true })).data,
    onSuccess: (data) => {
      notify(`${action} registrada: ${data.item?.name} (stock ${data.item?.stock}).`);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setResult(null);
      setPayload(null);
      setManual('');
      setQuantity(1);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const canCreate = result && !result.found && action === 'Entrada' && !!result.qr_data && 'name' in result.qr_data;

  return (
    <Modal title="Entrada / salida por QR o código" onClose={onClose}>
      <div className="stack">
        <div className="toggle-group">
          <button type="button" className={`toggle-option ${action === 'Entrada' ? 'is-active' : ''}`} onClick={() => setAction('Entrada')}>
            <ArrowDownToLine size={14} /> Entrada
          </button>
          <button type="button" className={`toggle-option ${action === 'Salida' ? 'is-active' : ''}`} onClick={() => setAction('Salida')}>
            <ArrowUpFromLine size={14} /> Salida
          </button>
        </div>

        {cameraOn && !result && <QrScanner onScan={identify} />}
        <button className="ghost-button" onClick={() => setCameraOn((value) => !value)}>
          {cameraOn ? 'Apagar cámara' : 'Encender cámara'}
        </button>

        <form
          className="manual-code"
          onSubmit={(event) => {
            event.preventDefault();
            if (manual.trim()) identify(manual.trim());
          }}
        >
          <input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="O escribe el código o nombre" />
          <button className="ghost-button">Buscar</button>
        </form>

        {result && (
          <section className="panel compact-panel">
            {result.found && result.item ? (
              <>
                <h3>{result.item.name}</h3>
                <p>
                  {result.item.code ?? 'Sin código'} · stock actual <strong>{result.item.stock}</strong>
                </p>
              </>
            ) : (
              <p>
                No se encontró ese ítem.
                {canCreate ? ' El QR trae todos sus datos: puedes crearlo con esta entrada.' : ' Revisa el código o créalo primero.'}
              </p>
            )}

            {(result.found || canCreate) && (
              <div className="manual-code">
                <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} aria-label="Cantidad" />
                <button className="primary-button" disabled={commit.isPending} onClick={() => commit.mutate()}>
                  {canCreate && !result.found ? 'Crear y registrar entrada' : `Registrar ${action.toLowerCase()}`}
                </button>
              </div>
            )}
            <button
              className="ghost-button"
              onClick={() => {
                setResult(null);
                setPayload(null);
              }}
            >
              Escanear otro
            </button>
          </section>
        )}
      </div>
    </Modal>
  );
}

function ItemQrModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['inventory-qr', item.id], queryFn: async () => (await api.get<QrPayload>(`/inventory/${item.id}/qr`)).data });

  return (
    <Modal title={`QR · ${item.name}`} onClose={onClose} narrow>
      {isLoading || !data ? (
        <Loading />
      ) : (
        <div className="qr-card">
          <div className="qr-svg-box" dangerouslySetInnerHTML={{ __html: data.svg }} />
          <strong>{item.name}</strong>
          <small>{item.code}</small>
          <button className="primary-button" onClick={() => window.print()}>
            Imprimir etiqueta
          </button>
        </div>
      )}
    </Modal>
  );
}

function DeleteItemModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => api.delete(`/inventory/${item.id}`),
    onSuccess: () => {
      notify('Ítem eliminado.');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  return <ConfirmModal title="Eliminar ítem" message={`¿Eliminar "${item.name}" del inventario?`} pending={mutation.isPending} onConfirm={() => mutation.mutate()} onClose={onClose} />;
}

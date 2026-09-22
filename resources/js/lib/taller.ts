import { AxiosError } from 'axios';
import { api } from '../apiClient';
import type { OrderStatus } from '../types-taller';

export const ORDER_STATUSES: OrderStatus[] = ['Pendiente', 'En Proceso', 'Finalizado'];

export const SERVICE_TYPES = ['Mantenimiento eléctrico', 'Reparación'];

export const PAYMENT_METHODS = ['Yape', 'Efectivo', 'Transferencia'] as const;

export type ReceptionChecklist = {
  exterior: Record<string, boolean>;
  tools: Record<string, boolean>;
  levels: Record<string, string>;
  damages: Record<string, { has_damage: boolean; note: string }>;
};

export type ReceptionOptions = {
  fuel_levels: string[];
  exterior_items: string[];
  tool_items: string[];
  level_items: string[];
  level_options: string[];
  damage_zones: string[];
  pickup_hours: number;
  storage_fee_per_day: number;
  liability_text: string;
};

/** Lista de recepción del vehículo (reemplaza el diagrama a mano de la hoja en papel): una sola fuente de verdad, usada también por el PDF. */
export async function getReceptionOptions(): Promise<ReceptionOptions> {
  return (await api.get<ReceptionOptions>('/reception-options')).data;
}

/** Todo presente y en buen estado por defecto: el técnico solo desmarca las excepciones. */
export function defaultReceptionChecklist(options: ReceptionOptions): ReceptionChecklist {
  return {
    exterior: Object.fromEntries(options.exterior_items.map((item) => [item, true])),
    tools: Object.fromEntries(options.tool_items.map((item) => [item, true])),
    levels: Object.fromEntries(options.level_items.map((item) => [item, options.level_options[0] ?? 'Bueno'])),
    damages: Object.fromEntries(options.damage_zones.map((zone) => [zone, { has_damage: false, note: '' }])),
  };
}

export const statusTone = (status: string): 'normal' | 'info' | 'success' | 'warning' =>
  status === 'Finalizado' ? 'success' : status === 'En Proceso' ? 'info' : 'warning';

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Extrae el mensaje de error de una respuesta de Laravel (validación 422 o abort). */
export const errorMessage = (error: unknown, fallback = 'Ocurrió un error. Inténtalo nuevamente.'): string => {
  const axiosError = error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>;
  const errors = axiosError.response?.data?.errors;
  if (errors) {
    const first = Object.values(errors)[0];
    if (first?.[0]) return first[0];
  }
  return axiosError.response?.data?.message || fallback;
};

/** Descarga un archivo autenticado (la sesión va por cookie, no se puede usar un <a href> directo con permisos). */
export async function downloadFile(url: string, params: Record<string, string> | undefined, fallbackName: string): Promise<void> {
  const response = await api.get<Blob>(url, { params, responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;

  const href = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export const trackingUrl = (token: string): string => `${window.location.origin}/seguimiento/${token}`;

export type PlateLookup = {
  plate: string;
  /** 'local' = ya está registrado en el taller; 'json.pe' = registro vehicular; null = no se encontró. */
  source: 'local' | 'json.pe' | null;
  vehicle: {
    brand?: string | null;
    model?: string | null;
    year?: string | null;
    color?: string | null;
    vin?: string | null;
    engine_number?: string | null;
    client_id?: number;
    client?: { id: number; name: string; phone?: string | null; email?: string | null; document_type?: string | null; document_number?: string | null };
  } | null;
  error: 'not_configured' | 'unavailable' | 'limit_reached' | null;
};

export type PlateLookupUsage = { month: string; limit: number; used: number; remaining: number };

/** Consulta los datos de un vehículo por placa (primero en el taller, luego en el registro vehicular). */
export async function lookupPlate(plate: string): Promise<PlateLookup> {
  return (await api.get<PlateLookup>('/vehicles/lookup', { params: { plate } })).data;
}

/** Cuántas consultas del plan gratuito de json.pe (100/mes) ya se usaron este mes. */
export async function getPlateLookupUsage(): Promise<PlateLookupUsage> {
  return (await api.get<PlateLookupUsage>('/vehicles/plate-usage')).data;
}

/** Mensaje para el usuario según el resultado de la consulta de placa. */
export function plateLookupMessage(result: PlateLookup): { text: string; tone: 'success' | 'error' } {
  if (result.source === 'local') return { text: 'Vehículo ya registrado en el taller: se completaron sus datos.', tone: 'success' };
  if (result.source === 'json.pe') return { text: 'Datos cargados desde el registro vehicular.', tone: 'success' };
  if (result.error === 'not_configured') return { text: 'La consulta automática de placas no está configurada. Completa los datos a mano.', tone: 'error' };
  if (result.error === 'limit_reached') return { text: 'Se acabaron las consultas de placas de este mes. Completa los datos a mano.', tone: 'error' };
  if (result.error === 'unavailable') return { text: 'No se pudo consultar la placa en este momento. Completa los datos a mano.', tone: 'error' };
  return { text: 'No encontramos esa placa en el registro. Completa los datos a mano.', tone: 'error' };
}

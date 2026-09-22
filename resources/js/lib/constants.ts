export const statuses = ['Pendiente', 'Diseno', 'Produccion', 'Instalacion', 'Entregado'];

export const statusDefaultProgress: Record<string, number> = {
  Pendiente: 5,
  Diseno: 20,
  Produccion: 40,
  Instalacion: 90,
  Entregado: 100,
};

export const money = (value: number | string) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value));

export type DateRangePreset = 'today' | 'week' | 'last-week' | 'month' | 'last-month';

export const toIsoDate = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const computeDateRange = (preset: DateRangePreset): { from: string; to: string } => {
  const today = new Date();
  if (preset === 'today') {
    return { from: toIsoDate(today), to: toIsoDate(today) };
  }
  if (preset === 'week' || preset === 'last-week') {
    const dayIndex = (today.getDay() + 6) % 7; // lunes = 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayIndex);
    if (preset === 'week') {
      return { from: toIsoDate(monday), to: toIsoDate(today) };
    }
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const lastSunday = new Date(monday);
    lastSunday.setDate(monday.getDate() - 1);
    return { from: toIsoDate(lastMonday), to: toIsoDate(lastSunday) };
  }
  if (preset === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toIsoDate(first), to: toIsoDate(today) };
  }
  const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: toIsoDate(firstOfLastMonth), to: toIsoDate(lastOfLastMonth) };
};

export const isOverdue = (dateStr: string) => {
  const due = new Date(dateStr);
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);
  return due < in3Days;
};

export const confirmIncompleteTasks = (currentStatus: string, tasks: { status: string }[] | undefined, newStatus: string) => {
  if (currentStatus !== 'Produccion' || newStatus !== 'Instalacion') return true;
  const total = tasks?.length ?? 0;
  const done = tasks?.filter((task) => task.status === 'Terminada').length ?? 0;
  if (total === 0 || done >= total) return true;
  return window.confirm(`Aun quedan ${total - done} tareas pendientes en este proyecto. ¿Moverlo a Instalacion igual?`);
};

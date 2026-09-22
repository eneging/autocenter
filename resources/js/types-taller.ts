export type OrderStatus = 'Pendiente' | 'En Proceso' | 'Finalizado';

export type Vehicle = {
  id: number;
  client_id: number;
  plate: string;
  brand: string;
  model: string;
  year?: string | null;
  color?: string | null;
  vin?: string | null;
  engine_number?: string | null;
  next_maintenance_at?: string | null;
  notes?: string | null;
  client?: { id: number; name: string; phone?: string | null; document_number?: string | null };
  projects_count?: number;
  projects?: { id: number; code: string; status: string; service_type?: string | null; starts_at?: string | null; exit_date?: string | null; budget?: string | null }[];
};

export type TrackingLog = {
  id: number;
  project_id: number;
  annotation: string | null;
  watermarked_image_path: string | null;
  created_at: string;
  creator?: { id: number; name: string } | null;
};

export type InventoryItem = {
  id: number;
  type: 'Repuesto' | 'Herramienta';
  code: string | null;
  name: string;
  stock: number;
  min_stock: number;
  unit_cost: string;
  sale_price: string | null;
  includes_igv: boolean;
  qr_data: string | null;
  is_low_stock: boolean;
  cost_breakdown: IgvBreakdown;
  price_breakdown: IgvBreakdown;
  movements?: InventoryMovement[];
};

export type IgvBreakdown = { base: number; igv: number; total: number };

export type InventoryMovement = {
  id: number;
  type: 'Entrada' | 'Salida';
  quantity: number;
  stock_after: number;
  note: string | null;
  created_at: string;
  user?: { id: number; name: string } | null;
};

export type PartsRequest = {
  id: number;
  project_id: number;
  inventory_item_id: number | null;
  quantity: number;
  unit_price: string;
  inventory_item?: InventoryItem | null;
};

export type OrderTotals = {
  service_budget: number;
  parts: { name: string; quantity: number; unit_price: number; subtotal: number }[];
  parts_total: number;
  total: number;
};

export type ServiceOrder = {
  id: number;
  code: string;
  name: string;
  status: OrderStatus;
  progress: number;
  priority: string;
  problem_description: string | null;
  mileage: number | null;
  fuel_level: string | null;
  reception_checklist: import('./lib/taller').ReceptionChecklist | null;
  client_requests_prior_budget: boolean;
  client_authorizes_repair_without_budget: boolean;
  client_authorizes_test_drive: boolean;
  client_accepted_terms_at: string | null;
  technical_diagnostic: string | null;
  solution: string | null;
  service_type: string | null;
  budget: string | null;
  estimated_time: string | null;
  starts_at: string | null;
  estimated_delivery_at: string | null;
  exit_date: string | null;
  notes: string | null;
  responsible_worker_id: number | null;
  client_access_token: string;
  client_comment: string | null;
  client_rating: number | null;
  client_commented_at: string | null;
  client?: { id: number; name: string; phone?: string | null; email?: string | null; document_number?: string | null };
  vehicle?: Vehicle | null;
  responsible?: { id: number; name: string } | null;
  tracking_logs?: TrackingLog[];
  parts_requests?: PartsRequest[];
  totals?: OrderTotals;
};

export type Transaction = {
  id: number;
  cash_register_id: number;
  type: 'Ingreso' | 'Gasto Fijo' | 'Gasto Variable';
  payment_method: 'Yape' | 'Efectivo' | 'Transferencia' | null;
  category: string;
  amount: string;
  is_taxable: boolean;
  igv_amount: string;
  description: string | null;
  transaction_date: string;
  project?: { id: number; code: string; name: string } | null;
  worker?: { id: number; name: string } | null;
  invoice?: { id: number; type: string; number: string | null; status: string } | null;
};

export type CashSummary = {
  income_total: number;
  income_by_method: Record<string, number>;
  fixed_expenses_total: number;
  variable_expenses_total: number;
  expenses_total: number;
  expenses_by_category: Record<string, number>;
  igv_income: number;
  igv_expenses: number;
  net_result: number;
  opening_amount: number;
  expected_cash: number;
  transactions_count: number;
};

export type CashRegister = {
  id: number;
  status: 'Abierta' | 'Cerrada';
  opened_at: string;
  closed_at: string | null;
  opening_amount: string;
  total_income: string;
  opened_by?: { id: number; name: string } | null;
  closed_by?: { id: number; name: string } | null;
  summary?: CashSummary;
  transactions?: Transaction[];
};

export type CashOptions = {
  payment_methods: string[];
  income_categories: string[];
  fixed_expense_categories: string[];
  variable_expense_categories: string[];
  igv_rate: number;
};

export type Invoice = {
  id: number;
  type: 'Boleta simple' | 'Factura';
  number: string | null;
  issue_date: string | null;
  customer_name: string | null;
  total: string | null;
  status: 'Emitido' | 'Dado de baja';
  void_reason: string | null;
  folder: string;
  uploader?: { id: number; name: string } | null;
};

export type ReportData = {
  period: 'daily' | 'weekly' | 'monthly';
  title: string;
  from: string;
  to: string;
  summary: CashSummary;
  daily: { date: string; income: number; expenses: number; net: number }[];
  transactions: { date: string; type: string; category: string; payment_method: string | null; amount: number; igv_amount: number; description: string | null; order: string | null; worker: string | null }[];
  commissions: { worker_id: number; worker_name: string; generated: number; commission: number; orders: number }[];
  orders_finished: number;
  orders_received: number;
  cash_registers: number;
};

export type PayrollAdvance = {
  id: number;
  worker_id: number;
  amount: string;
  reason: string | null;
  status: 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Pagado';
  requested_at: string;
  resolved_at: string | null;
  worker?: { id: number; name: string; role: string };
  resolved_by?: { id: number; name: string } | null;
};

export type Promotion = {
  id: number;
  type: 'evento' | 'sorteo' | 'cupon';
  title: string;
  description: string | null;
  image_url: string | null;
  discount_percent: number | null;
  coupon_prefix: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  winner_entry_id: number | null;
  entries_count?: number;
  winner?: { id: number; name: string; phone: string } | null;
};

export type PromotionEntry = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  document_number: string | null;
  coupon_code: string | null;
  redeemed_at: string | null;
  created_at: string;
};

export type PublicTracking = {
  shop: { name: string | null; ruc: string | null; phone: string | null; whatsapp: string | null; address: string | null; email: string | null };
  order: {
    code: string;
    status: OrderStatus;
    progress: number;
    service_type: string | null;
    problem_description: string | null;
    technical_diagnostic: string | null;
    solution: string | null;
    estimated_time: string | null;
    entry_date: string | null;
    estimated_delivery_at: string | null;
    exit_date: string | null;
    technician: string | null;
  };
  client_name: string | null;
  vehicle: { plate: string; brand: string; model: string; year: string | null; color: string | null } | null;
  timeline: { id: number; annotation: string | null; image: string | null; created_at: string }[];
  receipt: OrderTotals | null;
  feedback: { can_comment: boolean; submitted: boolean; comment: string | null; rating: number | null };
};

export type QrPayload = { worker?: { id: number; name: string; role: string }; item?: { id: number; code: string | null; name: string }; qr_token?: string; payload?: string; svg: string };

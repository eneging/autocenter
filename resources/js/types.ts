export type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  document: string;
  document_type?: '1' | '6' | null;
  document_number?: string | null;
  address?: string | null;
  company?: string;
  projects_count?: number;
  quotations_count?: number;
};

export type SunatDocument = {
  id: number;
  quotation_id: number;
  tipo: 'factura' | 'boleta';
  serie: string;
  numero: number;
  estado: 'aceptado' | 'rechazado' | 'error';
  mensaje: string | null;
  hash: string | null;
  xml_url: string | null;
  cdr_url: string | null;
  pdf_ticket_url: string | null;
  pdf_a4_url: string | null;
};

export type Worker = {
  id: number;
  name: string;
  role: string;
  phone?: string | null;
  hourly_rate?: string;
  is_active?: boolean;
};

export type Attendance = {
  id: number;
  worker_id: number;
  date: string;
  clock_in: string;
  break_start: string | null;
  break_end: string | null;
  clock_out: string | null;
  worker_payment_id: number | null;
  worked_hours: number | null;
  worker?: Worker;
};

export type WorkerPayment = {
  id: number;
  worker_id: number;
  project_id: number | null;
  period_start: string;
  period_end: string;
  total_hours: string;
  hourly_rate: string;
  total_amount: string;
  paid_at: string;
  notes: string | null;
  worker: Worker;
  project?: { id: number; code: string; name: string } | null;
  attendances?: Attendance[];
};

export type Project = {
  id: number;
  code: string;
  client_id: number;
  responsible_worker_id?: number | null;
  name: string;
  type: string;
  description?: string | null;
  notes?: string | null;
  complexity: string;
  priority: string;
  status: string;
  progress: number;
  estimated_delivery_at: string;
  estimated_cost: string;
  cover_image_url: string;
  client_access_token: string;
  client: Client;
  responsible?: Worker;
  tasks?: { id: number; title: string; status: string; worker_id: number | null }[];
};

export type ProjectMedia = {
  id: number;
  type: 'image' | 'video';
  drive_file_id: string;
  drive_view_link: string;
  drive_thumbnail_link: string | null;
  caption: string | null;
  created_at: string;
  project?: { id: number; code: string; name: string };
};

export type Dashboard = {
  metrics: {
    totalProjects: number;
    activeProjects: number;
    finishedProjects: number;
    delayedProjects: number;
    pendingQuotations: number;
    activeWorkers: number;
    monthIncome: number;
    monthExpenses: number;
  };
  priorityList: Project[];
  recentActivity: { id: number; title: string; description: string; created_at: string }[];
  upcomingDeadlines: Project[];
  chart: { month: string; income: number; expenses: number }[];
};

export type QuotationPayment = {
  id: number;
  quotation_id: number;
  amount: string;
  paid_at: string;
  method: string;
  notes: string | null;
};

export type Quotation = {
  id: number;
  number: string;
  status: string;
  subtotal: string;
  igv: string;
  includes_igv: boolean;
  total: string;
  delivery_time: string;
  advance_percentage: number;
  extra_terms: string | null;
  client: Client;
  project?: Project;
  items: { id: number; title: string | null; description: string | null; quantity: number; unit_price: string; subtotal: string }[];
  sunat_documents?: SunatDocument[];
  payments?: QuotationPayment[];
  paid_amount: number;
  balance_due: number;
  payment_status: 'Pendiente' | 'Parcial' | 'Pagado';
};

export type Expense = {
  id: number;
  project_id: number | null;
  category: string;
  title: string;
  amount: string;
  expense_date: string;
  method: string | null;
  receipt_url: string | null;
  notes: string | null;
  project?: { id: number; code: string; name: string } | null;
};

export type SavingsMovement = {
  id: number;
  type: 'ahorro' | 'inversion';
  direction: 'aporte' | 'retiro';
  amount: string;
  movement_date: string;
  notes: string | null;
};

export type SavingsSummary = {
  movements: SavingsMovement[];
  balances: { ahorro: number; inversion: number; total: number };
};

export type LedgerEntry = {
  id: string;
  type: 'ingreso' | 'egreso';
  date: string;
  category: string;
  description: string;
  amount: number;
  method: string | null;
  project?: { id: number; code: string; name: string } | null;
};

export type FinanceSummary = {
  range: { from: string; to: string };
  totals: {
    income_total: number;
    labor_total: number;
    expenses_total: number;
    outflow_total: number;
    balance: number;
  };
  expenses_by_category: { category: string; total: number }[];
  monthly: { month: string; income: number; expenses: number }[];
  receivables: Quotation[];
};

export type ProjectProfitability = {
  project: { id: number; code: string; name: string; status: string };
  quoted_total: number;
  income: number;
  labor: number;
  expenses: number;
  profit: number;
};

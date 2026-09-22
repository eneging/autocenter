import { APP_NAME } from '../apiClient';
import {
  Boxes,
  Car,
  FileSpreadsheet,
  HandCoins,
  QrCode,
  Receipt,
  Ticket,
  Wrench,
  CalendarDays,
  Clock,
  FileText,
  Globe,
  ImagePlus,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Moon,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { LOGO_URL } from '../apiClient';
import { LoadingScreen, PanelTitle } from '../components/ui';
import { AttendanceAdminView } from '../features/attendance/AttendanceAdminView';
import { AttendanceQrView } from '../features/attendance/AttendanceQrView';
import { CashRegisterView } from '../features/cash-register/CashRegisterView';
import { InventoryView } from '../features/inventory/InventoryView';
import { InvoicesView } from '../features/invoices/InvoicesView';
import { AdvancesAdminView } from '../features/payroll-advances/AdvancesAdminView';
import { MyAdvancesView } from '../features/payroll-advances/MyAdvancesView';
import { PromotionsAdminView } from '../features/promotions/PromotionsAdminView';
import { ReportsView } from '../features/reports/ReportsView';
import { ServiceOrdersView } from '../features/service-orders/ServiceOrdersView';
import { VehiclesView } from '../features/vehicles/VehiclesView';
import { CalendarView } from '../features/calendar/CalendarView';
import { ClientsView } from '../features/clients/ClientsView';
import { ComplaintBookAdminView } from '../features/complaint-book/ComplaintBookAdminView';
import { DashboardView } from '../features/dashboard/DashboardView';
import { FinanceView } from '../features/finance/FinanceView';
import { MediaLibraryView } from '../features/media-library/MediaLibraryView';
import { MyAttendanceView } from '../features/my-attendance/MyAttendanceView';
import { ClientVehiclesView } from '../features/my-projects/ClientVehiclesView';
import { QuotationsView } from '../features/quotations/QuotationsView';
import { QuoteRequestsView } from '../features/quote-requests/QuoteRequestsView';
import { SiteAdminView } from '../features/site-admin/SiteAdminView';
import { UsersView } from '../features/users/UsersView';

const adminNav = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'orders', label: 'Órdenes de servicio', icon: Wrench },
  { key: 'vehicles', label: 'Vehículos', icon: Car },
  { key: 'clients', label: 'Clientes', icon: Users },
  { key: 'inventory', label: 'Inventario', icon: Boxes },
  { key: 'cash', label: 'Caja', icon: Wallet },
  { key: 'invoices', label: 'Comprobantes', icon: Receipt },
  { key: 'reports', label: 'Reportes', icon: FileSpreadsheet },
  { key: 'quotations', label: 'Cotizaciones', icon: FileText },
  { key: 'finance', label: 'Finanzas', icon: Wallet },
  { key: 'calendar', label: 'Calendario', icon: CalendarDays },
  { key: 'quote-requests', label: 'Solicitudes de cotizacion', icon: ImagePlus },
  { key: 'attendance', label: 'Asistencia y planilla', icon: Clock },
  { key: 'attendance-qr', label: 'QR de asistencia', icon: QrCode },
  { key: 'advances', label: 'Adelantos de sueldo', icon: HandCoins },
  { key: 'promotions', label: 'Promociones', icon: Ticket },
  { key: 'complaint-book', label: 'Libro de Reclamaciones', icon: MessageSquareWarning },
  { key: 'users', label: 'Usuarios', icon: UserCog },
  { key: 'site', label: 'Sitio web', icon: Globe },
];

const workerNav = [
  { key: 'my-orders', label: 'Mis órdenes', icon: Wrench },
  { key: 'my-attendance', label: 'Mi asistencia', icon: Clock },
  { key: 'my-advances', label: 'Mis adelantos', icon: HandCoins },
];
const clientNav = [{ key: 'my-vehicles', label: 'Mis vehículos', icon: Car }];
const cmNav = [{ key: 'media-library', label: 'Biblioteca', icon: Images }];

const viewForRole = (isAdmin: boolean, isCliente: boolean, isCM: boolean) =>
  isAdmin ? 'dashboard' : isCliente ? 'my-vehicles' : isCM ? 'media-library' : 'my-orders';

export function AdminApp() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles.includes('Administrador') ?? false;
  const isCliente = user?.roles.includes('Cliente') ?? false;
  const isCM = user?.roles.includes('Community Manager') ?? false;
  const nav = isAdmin ? adminNav : isCliente ? clientNav : isCM ? cmNav : workerNav;
  // `view` arranca en null porque en el primer render `user` todavia es null (la sesion
  // recien se esta verificando) y no hay forma de saber el rol real todavia. Si arrancara
  // con un valor por defecto (ej. 'my-tasks'), ese componente alcanza a montarse y disparar
  // sus llamadas a la API antes de que el efecto de abajo corrija `view` con el rol correcto,
  // generando pedidos con permisos equivocados (401/403) para roles como Administrador.
  const [view, setView] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [attendanceTab, setAttendanceTab] = useState<'records' | 'payroll'>('records');

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    if (user) {
      setView(viewForRole(isAdmin, isCliente, isCM));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginView />;
  if (!view) return <LoadingScreen />;

  const goTo = (key: string) => {
    if (key === 'attendance') setAttendanceTab('records');
    setView(key);
    setMobileNavOpen(false);
  };

  const goToPayroll = () => {
    setAttendanceTab('payroll');
    setView('attendance');
    setMobileNavOpen(false);
  };

  return (
    <div className="app-shell">
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="brand">
          <img className="brand-mark" src={LOGO_URL} alt={APP_NAME} />
          <div>
            <strong>{APP_NAME}</strong>
            <span>Panel de gestión</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button className={`nav-item ${view === item.key ? 'active' : ''}`} key={item.key} onClick={() => goTo(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="theme-toggle" onClick={() => setDark((value) => !value)}>
          <Moon size={17} />
          <span>Modo {dark ? 'claro' : 'oscuro'}</span>
        </button>
        <button
          className="theme-toggle"
          onClick={async () => {
            await logout();
            navigate('/');
          }}
        >
          <LogOut size={17} />
          <span>Cerrar sesion ({user.name})</span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <div>
            <p className="eyebrow">Gestion integral</p>
            <h1>{nav.find((item) => item.key === view)?.label ?? 'Dashboard'}</h1>
          </div>
        </header>

        {view === 'dashboard' && isAdmin && <DashboardView />}
        {view === 'orders' && isAdmin && <ServiceOrdersView mode="admin" />}
        {view === 'vehicles' && isAdmin && <VehiclesView />}
        {view === 'inventory' && isAdmin && <InventoryView />}
        {view === 'cash' && isAdmin && <CashRegisterView />}
        {view === 'invoices' && isAdmin && <InvoicesView />}
        {view === 'reports' && isAdmin && <ReportsView />}
        {view === 'attendance-qr' && isAdmin && <AttendanceQrView />}
        {view === 'advances' && isAdmin && <AdvancesAdminView />}
        {view === 'promotions' && isAdmin && <PromotionsAdminView />}
        {view === 'clients' && isAdmin && <ClientsView />}
        {view === 'quotations' && isAdmin && <QuotationsView />}
        {view === 'finance' && isAdmin && <FinanceView onGoToPayroll={goToPayroll} />}
        {view === 'calendar' && isAdmin && <CalendarView />}
        {view === 'quote-requests' && isAdmin && <QuoteRequestsView />}
        {view === 'attendance' && isAdmin && <AttendanceAdminView initialTab={attendanceTab} />}
        {view === 'complaint-book' && isAdmin && <ComplaintBookAdminView />}
        {view === 'users' && isAdmin && <UsersView />}
        {view === 'site' && isAdmin && <SiteAdminView />}
        {view === 'my-orders' && <ServiceOrdersView mode="technician" />}
        {view === 'my-advances' && <MyAdvancesView />}
        {view === 'my-attendance' && <MyAttendanceView />}
        {view === 'my-vehicles' && <ClientVehiclesView />}
        {view === 'media-library' && isCM && <MediaLibraryView />}
      </main>
    </div>
  );
}

function LoginView() {
  const { login, error } = useAuth();
  const { register, handleSubmit, formState } = useForm({ defaultValues: { email: '', password: '' } });

  return (
    <div className="login-shell">
      <section className="panel login-card">
        <img className="login-logo" src={LOGO_URL} alt={APP_NAME} />
        <PanelTitle title={APP_NAME} subtitle="Inicia sesion para continuar" />
        {error && <p className="login-error">{error}</p>}
        <form
          className="form-grid"
          onSubmit={handleSubmit(async (values) => {
            try {
              await login(values.email, values.password);
            } catch {
              // el mensaje de error ya se muestra desde el contexto de auth
            }
          })}
        >
          <label>
            Correo
            <input type="email" autoComplete="username" placeholder="correo@ejemplo.com" {...register('email', { required: true })} />
          </label>
          <label>
            Contrasena
            <input type="password" {...register('password', { required: true })} />
          </label>
          <button className="primary-button" disabled={formState.isSubmitting}>
            Ingresar
          </button>
        </form>
      </section>
    </div>
  );
}


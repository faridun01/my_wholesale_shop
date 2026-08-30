import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Loader2, Menu, X, Warehouse } from 'lucide-react';
import { clsx } from 'clsx';
import Sidebar from './components/layout/Sidebar';
import InstallPwaBanner from './components/pwa/InstallPwaBanner';
import { getCurrentUser, isAdminUser, isCustomerUser } from './utils/userAccess';
import { clearAuthSession, getStoredUser, hasStoredSession, setAuthSession } from './utils/authStorage';
import { getSessionUser } from './api/auth.api';

const LoginView = React.lazy(() => import('./views/LoginView'));
const DashboardView = React.lazy(() => import('./views/DashboardView'));
const ProductsView = React.lazy(() => import('./views/ProductsView'));
const SalesView = React.lazy(() => import('./views/SalesView'));
const CustomerView = React.lazy(() => import('./views/CustomerView'));
const CustomerDebtsView = React.lazy(() => import('./views/CustomerDebtsView'));
const SettingsView = React.lazy(() => import('./views/SettingsView'));
const CatalogView = React.lazy(() => import('./views/CatalogView'));
const ReportsView = React.lazy(() => import('./views/ReportsView'));
const ExpensesView = React.lazy(() => import('./views/ExpensesView'));
const RemindersView = React.lazy(() => import('./views/RemindersView'));
const HistoryView = React.lazy(() => import('./views/HistoryView'));
const POSView = React.lazy(() => import('./views/POSView'));
const CustomerOrdersView = React.lazy(() => import('./views/CustomerOrdersView'));

const RouteLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600">
      <Loader2 size={18} className="animate-spin text-slate-400" />
      <span>Загрузка страницы...</span>
    </div>
  </div>
);

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  return hasStoredSession() ? <>{children}</> : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getCurrentUser();
  return isAdminUser(user) ? <>{children}</> : <Navigate to="/pos" replace />;
};

const StaffRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getCurrentUser();
  return isCustomerUser(user) ? <Navigate to="/catalog" replace /> : <>{children}</>;
};

const RootRoute = () => {
  const user = getCurrentUser();
  if (isCustomerUser(user)) {
    return <Navigate to="/catalog" replace />;
  }
  return isAdminUser(user) ? <DashboardView /> : <Navigate to="/pos" replace />;
};

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  React.useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 text-white">
              <Warehouse size={18} />
            </div>
            <span className="text-[15px] font-semibold leading-none tracking-tight text-slate-900">Оптовая торговля</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={clsx(
              'rounded-lg border p-2.5 transition-colors',
              isSidebarOpen ? 'border-accent-100 bg-accent-50 text-accent-600' : 'border-slate-200 bg-white text-slate-700',
            )}
            aria-label={isSidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-0">
          <div className="min-h-full">
            <React.Suspense fallback={<RouteLoading />}>
              <Outlet />
            </React.Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [isBootstrappingSession, setIsBootstrappingSession] = React.useState(() => Boolean(getStoredUser()));

  React.useEffect(() => {
    if (localStorage.getItem('token')) {
      localStorage.removeItem('token');
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      if (!getStoredUser()) {
        if (isMounted) {
          setIsBootstrappingSession(false);
        }
        return;
      }

      try {
        const user = await getSessionUser();
        if (isMounted) {
          setAuthSession(null, user);
        }
      } catch {
        if (isMounted) {
          clearAuthSession();
        }
      } finally {
        if (isMounted) {
          setIsBootstrappingSession(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isBootstrappingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600">
          <Loader2 size={18} className="animate-spin text-slate-400" />
          <span>Проверяем сессию...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3200,
          style: {
            borderRadius: '10px',
            border: '1px solid #e2e4ea',
            background: '#ffffff',
            color: '#14161f',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(20, 22, 31, 0.08)',
          },
          success: { iconTheme: { primary: '#0f7a5c', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#e11d48', secondary: '#ffffff' } },
        }}
      />
      <InstallPwaBanner />
      <Routes>
        <Route
          path="/login"
          element={
            <React.Suspense fallback={<RouteLoading />}>
              <LoginView />
            </React.Suspense>
          }
        />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/" element={<RootRoute />} />
          <Route
            path="/products"
            element={
              <StaffRoute>
                <ProductsView />
              </StaffRoute>
            }
          />
          <Route path="/catalog" element={<CatalogView />} />
          <Route
            path="/sales"
            element={
              <StaffRoute>
                <SalesView />
              </StaffRoute>
            }
          />
          <Route path="/pos" element={<POSView />} />
          <Route
            path="/customer-orders"
            element={
              <StaffRoute>
                <CustomerOrdersView />
              </StaffRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <StaffRoute>
                <CustomerView />
              </StaffRoute>
            }
          />
          <Route
            path="/customers/debts"
            element={
              <StaffRoute>
                <CustomerDebtsView />
              </StaffRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <AdminRoute>
                <ExpensesView />
              </AdminRoute>
            }
          />
          <Route
            path="/analytics"
            element={<Navigate to="/" replace />}
          />
          <Route
            path="/reports"
            element={
              <AdminRoute>
                <ReportsView />
              </AdminRoute>
            }
          />
          <Route
            path="/reminders"
            element={
              <StaffRoute>
                <RemindersView />
              </StaffRoute>
            }
          />
          <Route
            path="/history"
            element={
              <AdminRoute>
                <HistoryView />
              </AdminRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <AdminRoute>
                <SettingsView />
              </AdminRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

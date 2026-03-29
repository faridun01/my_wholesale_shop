import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Loader2, Menu, X, Warehouse } from 'lucide-react';
import LoginView from './views/LoginView';
import Sidebar from './components/layout/Sidebar';
import { getCurrentUser, isAdminUser } from './utils/userAccess';
import { clearAuthSession, getStoredUser, hasStoredSession, setAuthSession } from './utils/authStorage';
import { getSessionUser } from './api/auth.api';

const DashboardView = React.lazy(() => import('./views/DashboardView'));
const ProductsView = React.lazy(() => import('./views/ProductsView'));
const SalesView = React.lazy(() => import('./views/SalesView'));
const CustomerView = React.lazy(() => import('./views/CustomerView'));
const SettingsView = React.lazy(() => import('./views/SettingsView'));
const CatalogView = React.lazy(() => import('./views/CatalogView'));
const ReportsView = React.lazy(() => import('./views/ReportsView'));
const ExpensesView = React.lazy(() => import('./views/ExpensesView'));
const RemindersView = React.lazy(() => import('./views/RemindersView'));
const HistoryView = React.lazy(() => import('./views/HistoryView'));
const POSView = React.lazy(() => import('./views/POSView'));

const RouteLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
      <Loader2 size={18} className="animate-spin text-slate-500" />
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

const RootRoute = () => {
  const user = getCurrentUser();
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
    <div className="flex h-screen overflow-hidden bg-shopify-bg">
      <Sidebar
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-shopify-border bg-white p-4 text-shopify-text lg:hidden">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f1df] text-shopify-green">
              <Warehouse size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold leading-none tracking-tight">Оптовая торговля</span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-xl bg-shopify-bg p-2.5 transition-all duration-300 hover:bg-[#eef1f3] active:scale-90"
          >
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-0">
          <div className="app-page-inner min-h-full">
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
      <div className="flex min-h-screen items-center justify-center bg-shopify-bg">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <Loader2 size={18} className="animate-spin text-slate-500" />
          <span>Проверяем сессию...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/" element={<RootRoute />} />
          <Route path="/products" element={<ProductsView />} />
          <Route path="/catalog" element={<CatalogView />} />
          <Route path="/sales" element={<SalesView />} />
          <Route path="/pos" element={<POSView />} />
          <Route path="/customers" element={<CustomerView />} />
          <Route path="/expenses" element={<ExpensesView />} />
          <Route
            path="/reports"
            element={
              <AdminRoute>
                <ReportsView />
              </AdminRoute>
            }
          />
          <Route path="/reminders" element={<RemindersView />} />
          <Route path="/history" element={<HistoryView />} />
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

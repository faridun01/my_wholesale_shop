import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import DashboardView from './views/DashboardView';
import ProductsView from './views/ProductsView';
import SalesView from './views/SalesView';
import CustomerView from './views/CustomerView';
import SettingsView from './views/SettingsView';
import CatalogView from './views/CatalogView';
import ReportsView from './views/ReportsView';
import RemindersView from './views/RemindersView';
import HistoryView from './views/HistoryView';
import POSView from './views/POSView';
import Sidebar from './components/layout/Sidebar';
import { Toaster } from 'react-hot-toast';
import { Menu, X, Warehouse } from 'lucide-react';
import { getCurrentUser, isAdminUser } from './utils/userAccess';
import { clearAuthSession, getAuthToken } from './utils/authStorage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = getAuthToken();
  return token ? <>{children}</> : <Navigate to="/login" />;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-shopify-bg">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white text-shopify-text p-4 flex items-center justify-between sticky top-0 z-30 border-b border-shopify-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#e3f1df] text-shopify-green">
              <Warehouse size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight leading-none">Wholesale</span>
              <span className="text-[10px] text-shopify-muted mt-0.5">Admin</span>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2.5 bg-shopify-bg hover:bg-[#eef1f3] rounded-xl transition-all duration-300 active:scale-90"
          >
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  React.useEffect(() => {
    if (localStorage.getItem('token') || localStorage.getItem('user')) {
      clearAuthSession();
    }
  }, []);

  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/register" element={<RegisterView />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardView />} />
                  <Route path="/products" element={<ProductsView />} />
                  <Route path="/catalog" element={<CatalogView />} />
                  <Route path="/sales" element={<SalesView />} />
                  <Route path="/pos" element={<POSView />} />
                  <Route path="/customers" element={<CustomerView />} />
                  <Route path="/reports" element={isAdmin ? <ReportsView /> : <Navigate to="/" />} />
                  <Route path="/reminders" element={<RemindersView />} />
                  <Route path="/history" element={<HistoryView />} />
                  <Route path="/settings" element={isAdmin ? <SettingsView /> : <Navigate to="/" />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

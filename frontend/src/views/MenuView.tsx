import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronRight,
  CreditCard,
  Download,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingBag,
  Users,
  Loader2,
} from 'lucide-react';
import client from '../api/client';
import { logout } from '../api/auth.api';
import { clearAuthSession, hasStoredSession } from '../utils/authStorage';
import { getCurrentUser, isAdminUser, isCustomerUser } from '../utils/userAccess';
import { usePWAInstall } from '../hooks/usePWAInstall';
import InstallPwaModal from '../components/pwa/InstallPwaModal';

export default function MenuView() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const isCustomer = isCustomerUser(user);

  const defaultDesktopRoute = isAdmin ? '/dashboard' : isCustomer ? '/catalog' : '/pos';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        navigate(defaultDesktopRoute, { replace: true });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [defaultDesktopRoute, navigate]);

  const [remindersCount, setRemindersCount] = useState(0);
  const { isStandalone, isInstalled, isIOS, canPromptNative, promptInstall, markAsInstalled } = usePWAInstall();
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!hasStoredSession() || isCustomer) return;

    client
      .get('/reminders')
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : [];
        setRemindersCount(items.filter((item: any) => !item.isCompleted).length);
      })
      .catch(() => {
        setRemindersCount(0);
      });
  }, [isCustomer]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore
    } finally {
      clearAuthSession();
      navigate('/login');
    }
  };

  const roleName = isAdmin ? 'Администратор' : isCustomer ? 'Клиент' : 'Продавец';

  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    return <Navigate to={defaultDesktopRoute} replace />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-3 pb-8 font-sans">
      {/* 1. Clean Profile Card */}
      <div className="mb-3.5 flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white shadow-xs">
          {user?.username ? user.username[0].toUpperCase() : 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900">{user?.username || 'Пользователь'}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">{roleName}</span>
            {user?.warehouse?.name && (
              <>
                <span className="text-slate-300">•</span>
                <span className="truncate text-slate-400">{user.warehouse.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Menu Navigation Links */}
      <div className="mb-3.5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs divide-y divide-slate-100">
        {isCustomer ? (
          <>
            <Link
              to="/catalog"
              className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <BookOpen size={18} />
                </div>
                <span className="text-sm font-bold text-slate-900">Каталог товаров</span>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </Link>

            <Link
              to="/pos"
              className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ShoppingBag size={18} />
                </div>
                <span className="text-sm font-bold text-slate-900">Оформить заказ</span>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/customers"
              className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Users size={18} />
                </div>
                <span className="text-sm font-bold text-slate-900">Клиенты</span>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </Link>

            <Link
              to="/customers/debts"
              className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <CreditCard size={18} />
                </div>
                <span className="text-sm font-bold text-slate-900">Долги клиентов</span>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </Link>

            <Link
              to="/reminders"
              className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Calendar size={18} />
                </div>
                <span className="text-sm font-bold text-slate-900">Напоминания</span>
              </div>
              <div className="flex items-center gap-1.5">
                {remindersCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                    {remindersCount}
                  </span>
                )}
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            </Link>

            {isAdmin && (
              <>
                <Link
                  to="/dashboard"
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <LayoutDashboard size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-900">Дашборд</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>

                <Link
                  to="/expenses"
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Banknote size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-900">Расходы</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>

                <Link
                  to="/reports"
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                      <BarChart3 size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-900">Отчеты</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>

                <Link
                  to="/settings"
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/70"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Settings size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-900">Настройки</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>
              </>
            )}
          </>
        )}
      </div>

      {/* 3. PWA Install (Only if not installed / not standalone) */}
      {!isStandalone && !isInstalled && (
        <div className="mb-3.5 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/50 shadow-2xs">
          <button
            type="button"
            onClick={async () => {
              if (canPromptNative) {
                const success = await promptInstall();
                if (!success) setIsPwaModalOpen(true);
              } else {
                setIsPwaModalOpen(true);
              }
            }}
            className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-indigo-100/50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Download size={18} />
              </div>
              <span className="text-sm font-bold text-indigo-950">Установить приложение</span>
            </div>
            <ChevronRight size={16} className="text-indigo-400" />
          </button>
        </div>
      )}

      {/* 4. Logout Action */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-rose-50/50 active:bg-rose-50"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              {isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            </div>
            <span className="text-sm font-bold text-rose-600">
              {isLoggingOut ? 'Выход из системы...' : 'Выйти из аккаунта'}
            </span>
          </div>
          <ChevronRight size={16} className="text-rose-300" />
        </button>
      </div>

      <InstallPwaModal
        isOpen={isPwaModalOpen && !isStandalone && !isInstalled}
        onClose={() => setIsPwaModalOpen(false)}
        isIOS={isIOS}
        canPromptNative={canPromptNative}
        onNativeInstall={promptInstall}
        onMarkAsInstalled={markAsInstalled}
      />
    </div>
  );
}

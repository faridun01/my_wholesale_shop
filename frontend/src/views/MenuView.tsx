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
  LogOut,
  Settings,
  ShoppingBag,
  Users,
  Warehouse,
  Shield,
  User,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
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
  const roleBadgeStyle = isAdmin
    ? 'bg-violet-400/20 text-violet-300 border-violet-400/30'
    : isCustomer
    ? 'bg-sky-400/20 text-sky-300 border-sky-400/30'
    : 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30';

  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    return <Navigate to={defaultDesktopRoute} replace />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-2 pb-6 font-sans">
      {/* 1. PWA Install Promo Card (If applicable) */}
      {!isStandalone && !isInstalled && (
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
          className="group relative mb-5 flex w-full items-center justify-between overflow-hidden rounded-3xl border border-indigo-200/80 bg-linear-to-r from-blue-600 via-indigo-600 to-indigo-700 p-4 text-left text-white shadow-md shadow-indigo-500/20 transition-all duration-150 active:scale-[0.99]"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs text-white shadow-inner">
              <Download size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-extrabold">Установить приложение</p>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider text-amber-950">
                  <Sparkles size={9} />
                  PWA
                </span>
              </div>
              <p className="text-xs font-medium text-indigo-100/90">Быстрый доступ с главного экрана</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-white/80 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {/* 2. Navigation Sections */}
      {isCustomer ? (
        /* Customer Mode Navigation */
        <div className="mb-5">
          <div className="mb-2 px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Навигация покупателя
            </span>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs divide-y divide-slate-100">
            <Link
              to="/catalog"
              className="group flex items-center justify-between p-3.5 sm:p-4 transition-all hover:bg-slate-50 active:bg-slate-100/70"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 transition-transform group-hover:scale-105">
                  <BookOpen size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 tracking-tight">Каталог товаров</p>
                  <p className="text-xs font-medium text-slate-400 truncate">Просмотр ассортимента и цен</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
            </Link>

            <Link
              to="/pos"
              className="group flex items-center justify-between p-3.5 sm:p-4 transition-all hover:bg-slate-50 active:bg-slate-100/70"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105">
                  <ShoppingBag size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 tracking-tight">Оформить заказ</p>
                  <p className="text-xs font-medium text-slate-400 truncate">Корзина и выбор позиций</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
            </Link>
          </div>
        </div>
      ) : (
        /* Staff / Admin Navigation */
        <>
          {/* Group: Клиенты и задачи */}
          <div className="mb-5">
            <div className="mb-2 px-1 flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Клиенты и задачи
              </span>
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs divide-y divide-slate-100">
              <Link
                to="/customers"
                className="group flex items-center justify-between p-3.5 sm:p-4 transition-all hover:bg-slate-50 active:bg-slate-100/70"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 transition-transform group-hover:scale-105">
                    <Users size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 tracking-tight">Клиенты</p>
                    <p className="text-xs font-medium text-slate-400 truncate">Список покупателей и контакты</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
              </Link>

              <Link
                to="/customers/debts"
                className="group flex items-center justify-between p-3.5 sm:p-4 transition-all hover:bg-slate-50 active:bg-slate-100/70"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20 transition-transform group-hover:scale-105">
                    <CreditCard size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 tracking-tight">Долги клиентов</p>
                    <p className="text-xs font-medium text-slate-400 truncate">Контроль задолженностей и оплат</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
              </Link>

              <Link
                to="/reminders"
                className="group flex items-center justify-between p-3.5 sm:p-4 transition-all hover:bg-slate-50 active:bg-slate-100/70"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 transition-transform group-hover:scale-105">
                    <Calendar size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 tracking-tight">Напоминания</p>
                    <p className="text-xs font-medium text-slate-400 truncate">Задачи, звонки и контроль</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {remindersCount > 0 && (
                    <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-xs">
                      {remindersCount}
                    </span>
                  )}
                  <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
                </div>
              </Link>
            </div>
          </div>

          {/* Group: Администрирование и отчеты (Admin Only) */}
          {isAdmin && (
            <div className="mb-5">
              <div className="mb-2 px-1 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  Администрирование и отчеты
                </span>
              </div>
              <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs divide-y divide-slate-100">
                <Link
                  to="/expenses"
                  className="group flex items-center justify-between p-3.5 sm:p-4 transition-all hover:bg-slate-50 active:bg-slate-100/70"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105">
                      <Banknote size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900 tracking-tight">Расходы</p>
                      <p className="text-xs font-medium text-slate-400 truncate">Учет затрат и платежи компании</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
                </Link>

                <Link
                  to="/reports"
                  className="group flex items-center justify-between p-3.5 sm:p-4 transition-all hover:bg-slate-50 active:bg-slate-100/70"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20 transition-transform group-hover:scale-105">
                      <BarChart3 size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900 tracking-tight">Отчеты и аналитика</p>
                      <p className="text-xs font-medium text-slate-400 truncate">Прибыль, продажи и рентабельность</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
                </Link>

                <Link
                  to="/settings"
                  className="group flex items-center justify-between p-3.5 sm:p-4 transition-all hover:bg-slate-50 active:bg-slate-100/70"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-slate-700 to-slate-900 text-white shadow-md shadow-slate-900/20 transition-transform group-hover:scale-105">
                      <Settings size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900 tracking-tight">Настройки</p>
                      <p className="text-xs font-medium text-slate-400 truncate">Склады, сотрудники и безопасность</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. Hero Profile Banner (Executive Identity Card - Moved down to bottom) */}
      <div className="relative mb-3.5 overflow-hidden rounded-3xl border border-slate-700/60 bg-linear-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 text-white shadow-xl">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-indigo-500/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-6 -bottom-6 h-28 w-28 rounded-full bg-blue-500/15 blur-2xl" />

        <div className="relative flex items-center gap-3.5">
          {/* Avatar with gradient & ring */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 via-indigo-600 to-blue-600 text-base font-black text-white shadow-md ring-3 ring-white/10">
            {user?.username ? user.username[0].toUpperCase() : <User size={20} />}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-500" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-black tracking-tight text-white">
                {user?.username || 'Пользователь'}
              </h3>
              <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider', roleBadgeStyle)}>
                <Shield size={10} />
                {roleName}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              {user?.warehouse?.name ? (
                <div className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200">
                  <Warehouse size={12} className="text-indigo-300 shrink-0" />
                  <span className="truncate">{user.warehouse.name}{user.warehouse.city ? ` (${user.warehouse.city})` : ''}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200">
                  <Warehouse size={12} className="text-indigo-300 shrink-0" />
                  <span>Главный склад</span>
                </div>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                В сети
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Logout Action Block */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="group flex w-full items-center justify-between rounded-3xl border border-rose-200/90 bg-rose-50/50 p-3.5 sm:p-4 text-left transition-all duration-150 hover:bg-rose-50 hover:border-rose-300 active:scale-[0.99] shadow-2xs"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20 transition-transform group-hover:scale-105">
              {isLoggingOut ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-rose-950">
                {isLoggingOut ? 'Выход из системы...' : 'Выйти из аккаунта'}
              </p>
              <p className="text-xs font-medium text-rose-600/90 truncate">Завершить текущую сессию</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-rose-400 transition-transform group-hover:translate-x-0.5 group-hover:text-rose-600" />
        </button>
      </div>

      {/* 5. Clean App Brand Footer */}
      <div className="py-2 text-center">
        <p className="text-[11px] font-bold text-slate-400 tracking-wide">
          Оптовый склад • Система управления
        </p>
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

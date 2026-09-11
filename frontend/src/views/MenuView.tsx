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
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Users,
  Warehouse,
  Shield,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import client from '../api/client';
import { logout } from '../api/auth.api';
import { clearAuthSession, hasStoredSession } from '../utils/authStorage';
import { getCurrentUser, isAdminUser, isCustomerUser } from '../utils/userAccess';
import { usePWAInstall } from '../hooks/usePWAInstall';
import InstallPwaModal from '../components/pwa/InstallPwaModal';

interface MenuItem {
  to: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  badge?: number | string | null;
  badgeColor?: string;
  iconBg: string;
  iconColor: string;
  adminOnly?: boolean;
  staffOnly?: boolean;
}

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
  const { isStandalone, isInstalled, isIOS, canPromptNative, promptInstall } = usePWAInstall();
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
      toast.success('Вы успешно вышли');
      navigate('/login');
    }
  };

  const roleName = isAdmin ? 'Администратор' : isCustomer ? 'Клиент' : 'Продавец';
  const roleBadgeStyle = isAdmin
    ? 'bg-violet-100 text-violet-700 border-violet-200'
    : isCustomer
    ? 'bg-sky-100 text-sky-700 border-sky-200'
    : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    return <Navigate to={defaultDesktopRoute} replace />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-3 pb-4 font-sans">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Меню</h1>
      </div>

      {/* Primary Section: Dashboard (Admin Only) */}
      {isAdmin && (
        <div className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Аналитика</h2>
          <Link
            to="/dashboard"
            className="group flex items-center justify-between rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 via-indigo-50/50 to-white p-4 transition-all hover:border-violet-300 hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/25 transition-transform group-hover:scale-105">
                <LayoutDashboard size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900">Дашборд</span>
                  <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Главное
                  </span>
                </div>
                <p className="text-xs text-slate-600">Сводка продаж, выручка, прибыль и склад</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-violet-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}

      {/* Customer Mode Sections */}
      {isCustomer ? (
        <div className="mb-5 space-y-2">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Навигация</h2>
          <Link
            to="/catalog"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <BookOpen size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Каталог товаров</p>
                <p className="text-xs text-slate-500">Просмотр ассортимента и цен</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </Link>
          <Link
            to="/pos"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <ShoppingBag size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Оформить заказ</p>
                <p className="text-xs text-slate-500">Корзина и выбор товаров</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </Link>
        </div>
      ) : (
        /* Staff / Admin Sections */
        <>
          {/* Section: Operations & Relationships */}
          <div className="mb-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Отношения и финансы</h2>
            <div className="space-y-2">
              <Link
                to="/customers"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Клиенты</p>
                    <p className="text-xs text-slate-500">Список покупателей и контакты</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </Link>

              <Link
                to="/customers/debts"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Долги клиентов</p>
                    <p className="text-xs text-slate-500">Контроль задолженностей и оплат</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </Link>

              <Link
                to="/reminders"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Напоминания</p>
                    <p className="text-xs text-slate-500">Задачи и звонки</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {remindersCount > 0 && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                      {remindersCount}
                    </span>
                  )}
                  <ChevronRight size={18} className="text-slate-400" />
                </div>
              </Link>

              {isAdmin && (
                <Link
                  to="/expenses"
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:bg-slate-50 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Banknote size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Расходы</p>
                      <p className="text-xs text-slate-500">Учет затрат и платежи</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>
              )}
            </div>
          </div>

          {/* Section: Management & System (Admin) */}
          {isAdmin && (
            <div className="mb-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Система и отчеты</h2>
              <div className="space-y-2">
                <Link
                  to="/reports"
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:bg-slate-50 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Отчеты</p>
                      <p className="text-xs text-slate-500">Прибыль, продажи и рентабельность</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>

                <Link
                  to="/settings"
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:bg-slate-50 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Settings size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Настройки</p>
                      <p className="text-xs text-slate-500">Склады, сотрудники и безопасность</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* Section: App & User Session */}
      <div className="mb-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Сессия и аккаунт</h2>
        <div className="space-y-2">
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
              className="flex w-full items-center justify-between rounded-xl border border-accent-200 bg-accent-50/50 p-3.5 text-left transition-all hover:bg-accent-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-600 text-white shadow-sm shadow-accent-600/20">
                  <Download size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-accent-900">Установить приложение</p>
                  <p className="text-xs text-accent-700">Быстрый доступ с рабочего стола</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-accent-500" />
            </button>
          )}

          {/* User Profile Card (admin) placed right before logout */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-sm font-bold text-white shadow-xs">
                {user.username ? user.username[0].toUpperCase() : <User size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-slate-900">{user.username || 'Пользователь'}</p>
                  <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', roleBadgeStyle)}>
                    <Shield size={10} />
                    {roleName}
                  </span>
                </div>
                {user.warehouse?.name && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
                    <Warehouse size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">{user.warehouse.name}{user.warehouse.city ? ` (${user.warehouse.city})` : ''}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center justify-between rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 text-left text-rose-700 transition-all hover:bg-rose-50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <LogOut size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-900">Выйти из аккаунта</p>
                <p className="text-xs text-rose-600/80">Завершить текущую сессию</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-rose-400" />
          </button>
        </div>
      </div>

      <InstallPwaModal
        isOpen={isPwaModalOpen && !isStandalone && !isInstalled}
        onClose={() => setIsPwaModalOpen(false)}
        isIOS={isIOS}
        canPromptNative={canPromptNative}
        onNativeInstall={promptInstall}
      />
    </div>
  );
}

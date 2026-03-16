import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth.api';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Loader2,
  Lock,
  ShieldCheck,
  User,
  Warehouse,
  Sparkles,
  BadgeCheck,
  Boxes,
} from 'lucide-react';
import { motion } from 'motion/react';
import { setAuthSession } from '../utils/authStorage';

const highlights = [
  {
    icon: Building2,
    title: 'Склады под контролем',
    text: 'Остатки, перемещения, пополнения и структура товара по каждому складу в одном пространстве.',
  },
  {
    icon: BarChart3,
    title: 'Продажи без хаоса',
    text: 'Накладные, оплаты, возвраты и прибыль фиксируются аккуратно и без лишней ручной путаницы.',
  },
  {
    icon: ShieldCheck,
    title: 'Чёткие роли доступа',
    text: 'Администратор управляет всей системой, а сотрудники видят только то, что нужно им для работы.',
  },
];

const metrics = [
  { label: 'Склад', value: 'Под рукой', icon: Boxes },
  { label: 'Продажи', value: 'Под контролем', icon: BadgeCheck },
  { label: 'Учёт', value: 'Без перегруза', icon: Sparkles },
];

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { token, user } = await login({ username, password });
      setAuthSession(token, user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef3f8] px-4 py-6 sm:px-6 lg:flex lg:items-center lg:justify-center lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(91,141,239,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(23,143,118,0.10),transparent_26%),radial-gradient(circle_at_bottom_center,rgba(36,48,66,0.08),transparent_34%)]" />
        <div className="absolute left-[-8rem] top-[-5rem] h-72 w-72 rounded-full bg-[#7aa5ff]/20 blur-3xl" />
        <div className="absolute right-[-7rem] top-[10%] h-96 w-96 rounded-full bg-[#7ee2b8]/15 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[35%] h-80 w-80 rounded-full bg-[#243042]/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 hidden h-40 w-40 rounded-full border border-white/40 bg-white/20 blur-2xl lg:block" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative mx-auto grid w-full max-w-7xl overflow-hidden rounded-[40px] border border-white/70 bg-white/70 shadow-[0_45px_120px_-40px_rgba(15,23,42,0.35)] backdrop-blur-2xl lg:min-h-[840px] lg:grid-cols-[1.08fr_0.92fr]"
      >
        <section className="relative hidden overflow-hidden bg-[linear-gradient(155deg,#142033_0%,#1c2737_34%,#111827_100%)] text-white lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(122,165,255,0.25),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(94,201,143,0.16),transparent_26%)]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />

          <div className="relative flex h-full w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex items-center gap-4 rounded-[28px] border border-white/10 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_40px_-28px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(145deg,#7aa5ff,#5b8def)] shadow-[0_20px_45px_-20px_rgba(91,141,239,0.95)]">
                  <Warehouse size={28} />
                </div>
                <div>
                  <p className="text-[26px] font-semibold tracking-tight">Wholesale CRM</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Современная система учёта для оптового бизнеса
                  </p>
                </div>
              </div>

              <div className="mt-14 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#7aa5ff]/20 bg-[#7aa5ff]/10 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-[#c8dbff]">
                  <Sparkles size={14} />
                  Управление торговлей нового уровня
                </div>

                <h1 className="mt-7 text-[42px] font-semibold leading-[1.03] tracking-tight xl:text-[56px]">
                  Один аккуратный интерфейс для складов, продаж и работы с клиентами
                </h1>

                <p className="mt-6 max-w-xl text-[15px] leading-8 text-slate-300">
                  Работайте быстрее, контролируйте остатки точнее и держите ключевые процессы бизнеса в
                  единой системе без перегруженных таблиц и случайных ошибок.
                </p>
              </div>

              <div className="mt-10 grid gap-4 xl:grid-cols-3">
                {highlights.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * index }}
                      className="group rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_50px_-34px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.09]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#b9d0ff] transition-transform duration-300 group-hover:scale-105">
                        <Icon size={19} />
                      </div>
                      <p className="mt-4 text-[17px] font-semibold leading-6">{item.title}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{item.text}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {metrics.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  >
                    <div className="flex items-center gap-2 text-slate-400">
                      <Icon size={14} />
                      <p className="text-[11px] uppercase tracking-[0.18em]">{item.label}</p>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-white xl:text-xl">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(247,250,255,0.96)_100%)] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(122,165,255,0.10),transparent_26%)]" />

          <div className="relative w-full max-w-md">
            <div className="mb-7 text-center lg:mb-8 lg:text-left">
              <div className="mx-auto mb-5 flex h-18 w-18 h-16 w-16 items-center justify-center rounded-[24px] border border-emerald-100 bg-[linear-gradient(145deg,#effcf5,#f7fffb)] text-[#178f76] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_40px_-24px_rgba(23,143,118,0.35)] lg:mx-0">
                <Warehouse size={28} />
              </div>

              <h2 className="text-[2.3rem] font-semibold tracking-tight text-slate-900">Вход в CRM</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                Войдите в рабочее пространство и продолжите управление товарами, складами и продажами.
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-[22px] border border-rose-100 bg-[linear-gradient(180deg,#fff5f5_0%,#fff1f1_100%)] px-4 py-3 text-sm font-medium text-rose-600 shadow-[0_18px_35px_-28px_rgba(244,63,94,0.45)]"
              >
                {error}
              </motion.div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-[34px] border border-white/80 bg-white/90 p-5 shadow-[0_35px_80px_-42px_rgba(15,23,42,0.30)] backdrop-blur-xl sm:p-6"
            >
              <div className="space-y-2">
                <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Логин
                </label>
                <div className="group relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#5b8def]"
                    size={18}
                  />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,#f6f9ff_0%,#edf4ff_100%)] py-4 pl-12 pr-4 text-[15px] text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#5b8def] focus:bg-white focus:ring-4 focus:ring-[#5b8def]/10"
                    placeholder="Введите логин"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Пароль
                </label>
                <div className="group relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#5b8def]"
                    size={18}
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,#f6f9ff_0%,#edf4ff_100%)] py-4 pl-12 pr-4 text-[15px] text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#5b8def] focus:bg-white focus:ring-4 focus:ring-[#5b8def]/10"
                    placeholder="Введите пароль"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#142033_0%,#243042_55%,#1d2a3b_100%)] px-5 py-4 text-sm font-semibold text-white shadow-[0_26px_45px_-22px_rgba(20,32,51,0.72)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_28px_48px_-20px_rgba(20,32,51,0.82)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Вход...</span>
                  </>
                ) : (
                  <>
                    <span>Войти в систему</span>
                    <ArrowRight
                      size={16}
                      className="transition-transform duration-300 group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>

              <div className="rounded-[22px] border border-slate-100 bg-[linear-gradient(180deg,#fafcff_0%,#f6f9fd_100%)] px-4 py-3 text-xs leading-6 text-slate-500">
                Безопасный доступ к рабочему кабинету для администраторов и сотрудников склада.
              </div>
            </form>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
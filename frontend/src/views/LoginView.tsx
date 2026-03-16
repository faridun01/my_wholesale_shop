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
} from 'lucide-react';
import { motion } from 'motion/react';
import { setAuthSession } from '../utils/authStorage';

const highlights = [
  {
    icon: Building2,
    title: 'Склады под контролем',
    text: 'Остатки, пополнения и движение товара по каждому складу в одном интерфейсе.',
  },
  {
    icon: BarChart3,
    title: 'Продажи без ошибок',
    text: 'Накладные, оплаты, возвраты и прибыль фиксируются в системе без ручного хаоса.',
  },
  {
    icon: ShieldCheck,
    title: 'Чёткие роли доступа',
    text: 'Админ контролирует всё, а сотрудники работают только в рамках своего склада.',
  },
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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef3fb_42%,#eef8f4_100%)] px-4 py-8 sm:px-6 lg:flex lg:h-screen lg:items-center lg:justify-center lg:px-6 lg:py-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[#5b8def]/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-12 h-80 w-80 rounded-full bg-[#5ec98f]/14 blur-3xl" />
        <div className="absolute bottom-[-7rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#243042]/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mx-auto grid w-full max-w-7xl overflow-hidden rounded-[36px] border border-white/75 bg-white/90 shadow-[0_40px_120px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl lg:h-[min(840px,calc(100vh-2.5rem))] lg:grid-cols-[1fr_0.92fr]"
      >
        <section className="relative hidden overflow-hidden bg-[linear-gradient(150deg,#243042_0%,#1d2736_55%,#151c28_100%)] text-white lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(91,141,239,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(94,201,143,0.14),transparent_30%)]" />
          <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
            <div>
              <div className="inline-flex items-center gap-4 rounded-[26px] border border-white/10 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(145deg,#5b8def,#7aa5ff)] text-white shadow-[0_20px_35px_-20px_rgba(91,141,239,0.85)]">
                  <Warehouse size={24} />
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">Wholesale CRM</p>
                  <p className="mt-1 text-sm text-slate-300">Система учёта для оптового бизнеса</p>
                </div>
              </div>

              <div className="mt-10 max-w-2xl">
                <p className="text-sm uppercase tracking-[0.24em] text-[#a9c6ff]">Управление торговлей</p>
                <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight xl:text-[50px]">
                  Работайте со складами, продажами и клиентами в одном аккуратном CRM-интерфейсе
                </h1>
                <p className="mt-5 max-w-xl text-[15px] leading-8 text-slate-300">
                  Контролируйте остатки, оформляйте накладные, принимайте оплату и следите за выручкой без
                  перегруженных таблиц и разрозненных записей.
                </p>
              </div>

              <div className="mt-10 grid gap-4 xl:grid-cols-3">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-[28px] border border-white/10 bg-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#a9c6ff]">
                        <Icon size={18} />
                      </div>
                      <p className="mt-4 text-[17px] font-semibold leading-6">{item.title}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[22px] border border-white/10 bg-[#1b2432]/85 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Склад</p>
                <p className="mt-2 text-xl font-semibold text-white">Под рукой</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-[#1b2432]/85 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Продажи</p>
                <p className="mt-2 text-xl font-semibold text-white">Под контролем</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-[#1b2432]/85 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Клиенты</p>
                <p className="mt-2 text-xl font-semibold text-white">В одном месте</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,251,255,0.97)_100%)] px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
          <div className="w-full max-w-md">
            <div className="mb-7 text-center lg:mb-8 lg:text-left">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[linear-gradient(145deg,#e7f4e4,#f4fbf1)] text-[#178f76] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_38px_-22px_rgba(23,143,118,0.45)] lg:mx-0">
                <Warehouse size={28} />
              </div>
              <h2 className="text-[2.15rem] font-semibold tracking-tight text-slate-900">Вход в CRM</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                Войдите и начните работать со складами, продажами и клиентами в одном рабочем окне.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.35)] backdrop-blur xl:p-6"
            >
              <div className="space-y-2">
                <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Логин
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-[#edf4ff] py-4 pl-12 pr-4 text-[15px] text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#5b8def] focus:bg-white focus:ring-4 focus:ring-[#5b8def]/10"
                    placeholder="Введите логин"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Пароль
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-[#edf4ff] py-4 pl-12 pr-4 text-[15px] text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#5b8def] focus:bg-white focus:ring-4 focus:ring-[#5b8def]/10"
                    placeholder="Введите пароль"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#243042,#1b2533)] px-5 py-4 text-sm font-semibold text-white shadow-[0_24px_40px_-22px_rgba(36,48,66,0.75)] transition-all hover:translate-y-[-1px] hover:shadow-[0_26px_46px_-20px_rgba(36,48,66,0.85)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Вход...</span>
                  </>
                ) : (
                  <>
                    <span>Войти</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </motion.div>
    </div>
  );
}

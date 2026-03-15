import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth.api';
import { Warehouse, User, Lock, Loader2, ShieldCheck, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import { setAuthSession } from '../utils/authStorage';

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
    <div className="relative min-h-screen overflow-hidden bg-[#eef3fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#5b8def]/15 blur-3xl" />
        <div className="absolute right-[-80px] top-24 h-80 w-80 rounded-full bg-[#5ec98f]/12 blur-3xl" />
        <div className="absolute bottom-[-80px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#243042]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid w-full overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)] lg:min-h-[720px] lg:grid-cols-[1.15fr_0.85fr]"
        >
          <div className="relative hidden bg-[linear-gradient(160deg,#243042_0%,#1c2634_52%,#151d29_100%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(91,141,239,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(94,201,143,0.12),transparent_30%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5b8def] text-white shadow-lg shadow-[#5b8def]/30">
                  <Warehouse size={22} />
                </div>
                <div>
                  <p className="text-xl font-semibold tracking-tight">Wholesale CRM</p>
                  <p className="text-xs text-slate-300">Управление оптовым магазином</p>
                </div>
              </div>
            </div>

            <div className="relative mt-12 space-y-10">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#9db8df]">Вход в систему</p>
                <h1 className="mt-5 max-w-lg text-[56px] font-semibold leading-[1.02] tracking-tight">
                  Рабочее пространство для складов, продаж и клиентов
                </h1>
                <p className="mt-6 max-w-xl text-[15px] leading-8 text-slate-300">
                  Авторизуйтесь под своей учётной записью и продолжайте работу только с теми складами и данными, которые доступны вашей роли.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-white/7 p-6 backdrop-blur">
                  <ShieldCheck className="text-[#8ed7a8]" size={20} />
                  <p className="mt-4 text-base font-semibold">Безопасный доступ</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Сессия завершается после закрытия браузера, повторный вход обязателен.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-white/7 p-6 backdrop-blur">
                  <Building2 className="text-[#8fb7ff]" size={20} />
                  <p className="mt-4 text-base font-semibold">Привязка к складу</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Пользователь видит только свои склады и данные, администратор видит всё.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mt-10 text-xs uppercase tracking-[0.2em] text-slate-400">
              Wholesale • CRM • TJS
            </div>
          </div>

          <div className="flex items-center justify-center p-5 sm:p-8 lg:bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] lg:p-12">
            <div className="w-full max-w-md lg:max-w-[420px]">
              <div className="mb-8 text-center lg:mb-10 lg:text-left">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#e7f4e4] text-[#178f76] shadow-inner lg:mx-0">
                  <Warehouse size={30} />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Вход в CRM</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Введите логин и пароль сотрудника, чтобы продолжить работу.
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 rounded-[30px] lg:border lg:border-slate-200 lg:bg-white lg:p-7 lg:shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
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
                      className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] py-4 pl-12 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[#5b8def] focus:bg-white focus:ring-4 focus:ring-[#5b8def]/10"
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
                      className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] py-4 pl-12 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[#5b8def] focus:bg-white focus:ring-4 focus:ring-[#5b8def]/10"
                      placeholder="Введите пароль"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#243042] py-4 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(36,48,66,0.7)] transition-all hover:bg-[#1b2533] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Вход...</span>
                    </>
                  ) : (
                    <span>Войти</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

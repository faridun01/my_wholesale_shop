import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessionUser, login, loginWithTwoFactor } from '../api/auth.api';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Warehouse,
} from 'lucide-react';
import { motion } from 'motion/react';
import { setAuthSession } from '../utils/authStorage';

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorUsername, setTwoFactorUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await login({ username, password });
      if (result.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken);
        setTwoFactorUsername(result.user?.username || username);
        setTwoFactorCode('');
        return;
      }

      const sessionUser = await getSessionUser();
      setAuthSession(null, sessionUser || result.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await loginWithTwoFactor({
        twoFactorToken,
        code: twoFactorCode,
      });
      const sessionUser = await getSessionUser();
      setAuthSession(null, sessionUser || result.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Ошибка проверки двухфакторной аутентификации');
    } finally {
      setIsLoading(false);
    }
  };

  const resetTwoFactorStep = () => {
    setTwoFactorToken('');
    setTwoFactorCode('');
    setTwoFactorUsername('');
    setError('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f4f5fb] px-4 py-8 font-sans overflow-hidden">
      {/* Ambient background blur circles */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-indigo-200/50 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-2xl shadow-slate-900/10 lg:grid-cols-12"
      >
        {/* Left Side Banner */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-10 text-white lg:col-span-5 lg:flex">
          {/* Decorative glowing gradient orbs */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sky-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md border border-white/15 shadow-inner">
                <Warehouse size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Wholesale CRM</h1>
                <p className="text-xs text-sky-200/80 font-medium">Система управления складом</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 my-8 space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1 text-[11px] font-semibold text-sky-300 backdrop-blur-sm border border-sky-400/20">
                <Sparkles size={12} />
                <span>Оптовая торговля & Учет</span>
              </span>
              <h2 className="mt-3 text-2xl font-bold leading-snug tracking-tight text-white">
                Управление складом, продажами и финансами в одном месте
              </h2>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 backdrop-blur-sm border border-white/10 transition-colors hover:bg-white/10">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                  <Boxes size={16} />
                </div>
                <div>
                  <p className="font-semibold text-white">Складской учёт в реальном времени</p>
                  <p className="text-[11px] text-slate-400">Точный остаток товаров по складам</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 backdrop-blur-sm border border-white/10 transition-colors hover:bg-white/10">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <p className="font-semibold text-white">Учёт продаж и задолженностей</p>
                  <p className="text-[11px] text-slate-400">Прозрачный баланс по клиентам</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 backdrop-blur-sm border border-white/10 transition-colors hover:bg-white/10">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <p className="font-semibold text-white">Безопасный доступ (2FA)</p>
                  <p className="text-[11px] text-slate-400">Защита аккаунтов и разделение ролей</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 border-t border-white/10 pt-4 text-[11px] text-slate-400 flex items-center justify-between">
            <span>© {new Date().getFullYear()} Wholesale CRM</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Сервер активен
            </span>
          </div>
        </section>

        {/* Right Side Form */}
        <section className="flex flex-col justify-center p-8 sm:p-10 lg:col-span-7">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 text-center lg:text-left">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 lg:mx-0">
                <Warehouse size={22} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {twoFactorToken ? 'Подтверждение входа' : 'Вход в систему'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {twoFactorToken
                  ? 'Введите 6-значный код из приложения-аутентификатора'
                  : 'Введите логин и пароль вашей учётной записи'}
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-center gap-2.5 rounded-2xl border border-rose-200/80 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 shadow-xs"
              >
                <AlertCircle size={16} className="shrink-0 text-rose-500" />
                <span>{error}</span>
              </motion.div>
            )}

            {!twoFactorToken ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Логин
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Введите ваш логин"
                      className="w-full rounded-2xl border border-slate-200 bg-[#f4f5fb] py-3 pl-11 pr-4 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Пароль
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Введите ваш пароль"
                      className="w-full rounded-2xl border border-slate-200 bg-[#f4f5fb] py-3 pl-11 pr-11 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 px-5 text-xs font-semibold text-white shadow-md shadow-slate-900/15 transition-all hover:bg-slate-800 hover:shadow-lg active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span>Выполняется вход...</span>
                      </>
                    ) : (
                      <>
                        <span>Войти в систему</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-3.5 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Двухфакторная защита активна</span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Пользователь: <span className="font-bold text-emerald-900">{twoFactorUsername}</span>
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Код 2FA или резервный код
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={twoFactorCode}
                      onChange={(event) => setTwoFactorCode(event.target.value)}
                      placeholder="123456 или ABCDE-12345"
                      className="w-full rounded-2xl border border-slate-200 bg-[#f4f5fb] py-3 pl-11 pr-4 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 tabular-nums tracking-widest"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={resetTwoFactorStep}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 active:scale-[0.99]"
                  >
                    <ArrowLeft size={15} />
                    <span>Назад</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 px-5 text-xs font-semibold text-white shadow-md shadow-slate-900/15 transition-all hover:bg-slate-800 hover:shadow-lg active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span>Проверяем...</span>
                      </>
                    ) : (
                      <>
                        <span>Подтвердить вход</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </motion.div>
    </div>
  );
}

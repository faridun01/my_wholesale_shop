import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  disableTwoFactor,
  setupTwoFactor,
  verifyTwoFactorSetup,
} from '../../api/auth.api';
import { updateStoredUser } from '../../utils/authStorage';

type Props = {
  currentUser: {
    twoFactorEnabled?: boolean;
  };
};

export default function TwoFactorSettingsCard({ currentUser }: Props) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(currentUser.twoFactorEnabled));
  const [isLoading, setIsLoading] = useState(false);
  const [setupData, setSetupData] = useState<null | {
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
    setupToken: string;
  }>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const handleStartSetup = async () => {
    try {
      setIsLoading(true);
      const data = await setupTwoFactor();
      setSetupData(data);
      setVerificationCode('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось подготовить 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!setupData) return;

    try {
      setIsLoading(true);
      const result = await verifyTwoFactorSetup({
        setupToken: setupData.setupToken,
        code: verificationCode,
      });
      updateStoredUser(result.user);
      setTwoFactorEnabled(true);
      setSetupData(null);
      setVerificationCode('');
      toast.success('Двухфакторная защита включена');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Код подтверждения неверный');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setIsLoading(true);
      const result = await disableTwoFactor({
        currentPassword: disablePassword,
        code: disableCode,
      });
      updateStoredUser(result.user);
      setTwoFactorEnabled(false);
      setDisablePassword('');
      setDisableCode('');
      toast.success('Двухфакторная защита отключена');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось отключить 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center space-x-3 text-2xl font-black text-slate-900">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <ShieldCheck size={28} />
            </div>
            <span>Двухфакторная защита</span>
          </h3>
          <p className="mt-3 text-sm font-medium text-slate-500">
            Вход будет подтверждаться кодом из Google Authenticator или Microsoft Authenticator.
          </p>
        </div>
        <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${twoFactorEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {twoFactorEnabled ? 'Включена' : 'Выключена'}
        </span>
      </div>

      {!twoFactorEnabled && !setupData && (
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-semibold leading-7 text-slate-600">
              Нажмите кнопку ниже, затем добавьте аккаунт в приложение-аутентификатор вручную по секретному ключу.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartSetup}
            disabled={isLoading}
            className="rounded-2xl bg-emerald-500 px-8 py-4 font-black text-white shadow-xl shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:opacity-70"
          >
            Подготовить 2FA
          </button>
        </div>
      )}

      {!twoFactorEnabled && setupData && (
        <form onSubmit={handleVerifySetup} className="space-y-6">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Шаг 1</p>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">
              В приложении-аутентификаторе выберите ручное добавление аккаунта и введите этот секрет:
            </p>
            <div className="mt-4 rounded-2xl bg-white px-5 py-4 font-mono text-lg font-bold tracking-[0.18em] text-slate-900">
              {setupData.secret}
            </div>
            <p className="mt-3 break-all text-xs text-slate-500">URI: {setupData.otpauthUrl}</p>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Шаг 2</p>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">
              Сохраните резервные коды. Каждый код можно использовать только один раз.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {setupData.backupCodes.map((code) => (
                <div key={code} className="rounded-2xl bg-white px-4 py-3 font-mono text-sm font-bold text-slate-800">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black uppercase tracking-widest text-slate-700">Код подтверждения</label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                required
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-5 py-4 pl-12 font-bold outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-300/40"
                placeholder="Введите 6-значный код"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setSetupData(null)}
              className="rounded-2xl px-6 py-4 font-black text-slate-500 transition-all hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-2xl bg-emerald-500 px-8 py-4 font-black text-white shadow-xl shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:opacity-70"
            >
              Подтвердить и включить
            </button>
          </div>
        </form>
      )}

      {twoFactorEnabled && (
        <form onSubmit={handleDisable} className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-semibold leading-7 text-slate-700">
              Чтобы отключить 2FA, введите текущий пароль и код из приложения-аутентификатора. Вместо кода можно использовать один из backup codes.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black uppercase tracking-widest text-slate-700">Текущий пароль</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                required
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-5 py-4 pl-12 font-bold outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-300/40"
                placeholder="Введите текущий пароль"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black uppercase tracking-widest text-slate-700">Код 2FA или backup code</label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                required
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-5 py-4 pl-12 font-bold outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-300/40"
                placeholder="123456 или ABCDE-12345"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-2xl bg-rose-600 px-8 py-4 font-black text-white shadow-xl shadow-rose-600/20 transition-all hover:bg-rose-700 disabled:opacity-70"
          >
            Отключить 2FA
          </button>
        </form>
      )}
    </div>
  );
}

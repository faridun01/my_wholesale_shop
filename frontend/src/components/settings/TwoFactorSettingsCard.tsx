import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import {
  disableTwoFactor,
  setupTwoFactor,
  verifyTwoFactorSetup,
} from '../../api/auth.api';
import { updateStoredUser } from '../../utils/authStorage';
import { Badge, Button, Card, Input } from '../UI';

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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    let isActive = true;

    const buildQr = async () => {
      if (!setupData?.otpauthUrl) {
        setQrCodeDataUrl('');
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(setupData.otpauthUrl, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });

        if (isActive) {
          setQrCodeDataUrl(dataUrl);
        }
      } catch {
        if (isActive) {
          setQrCodeDataUrl('');
        }
      }
    };

    buildQr();

    return () => {
      isActive = false;
    };
  }, [setupData?.otpauthUrl]);

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

  const handleCopySecret = async () => {
    if (!setupData?.secret) return;

    try {
      await navigator.clipboard.writeText(setupData.secret.replace(/\s+/g, ''));
      toast.success('Секретный ключ скопирован');
    } catch {
      toast.error('Не удалось скопировать ключ');
    }
  };

  const handleOpenAuthenticator = () => {
    if (!setupData?.otpauthUrl) return;
    window.location.href = setupData.otpauthUrl;
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
    <Card
      title={
        <span className="flex items-center gap-2.5 text-section-title">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <ShieldCheck size={18} />
          </span>
          <span>Двухфакторная защита</span>
        </span>
      }
      subtitle="Вход будет подтверждаться кодом из Google Authenticator или Microsoft Authenticator."
      headerActions={<Badge variant={twoFactorEnabled ? 'success' : 'default'}>{twoFactorEnabled ? 'Включена' : 'Выключена'}</Badge>}
    >
      {!twoFactorEnabled && !setupData && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-muted p-4">
            <p className="text-sm leading-6 text-slate-600">
              Нажмите кнопку ниже, затем добавьте аккаунт в приложение-аутентификатор вручную по секретному ключу.
            </p>
          </div>
          <Button type="button" onClick={handleStartSetup} disabled={isLoading} isLoading={isLoading}>
            Подготовить 2FA
          </Button>
        </div>
      )}

      {!twoFactorEnabled && setupData && (
        <form onSubmit={handleVerifySetup} className="space-y-5">
          <div className="rounded-lg border border-accent-100 bg-accent-50 p-4 sm:p-5">
            <p className="text-eyebrow text-accent-700">Шаг 1</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Откройте Google Authenticator или Microsoft Authenticator и отсканируйте QR-код. Если сканирование недоступно, используйте секретный ключ вручную:
            </p>
            {qrCodeDataUrl && (
              <div className="mt-4 flex justify-center">
                <div className="rounded-lg border border-line bg-white p-3">
                  <img
                    src={qrCodeDataUrl}
                    alt="QR code for two-factor authentication"
                    className="h-56 w-56 rounded-md"
                  />
                </div>
              </div>
            )}
            <div className="font-tabular mt-4 break-all rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-900">
              {setupData.secret}
            </div>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <Button type="button" variant="primary" size="sm" onClick={handleOpenAuthenticator}>
                Открыть в Authenticator
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleCopySecret}>
                Копировать ключ
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Если приложение не открылось автоматически, добавьте аккаунт вручную и вставьте этот секретный ключ.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <p className="text-eyebrow text-amber-700">Шаг 2</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Сохраните резервные коды. Каждый код можно использовать только один раз.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {setupData.backupCodes.map((code) => (
                <div key={code} className="font-tabular rounded-md border border-line bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <Input
            label="Код подтверждения"
            icon={<KeyRound size={16} />}
            type="text"
            required
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            placeholder="Введите 6-значный код"
          />

          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setSetupData(null)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading} isLoading={isLoading}>
              Подтвердить и включить
            </Button>
          </div>
        </form>
      )}

      {twoFactorEnabled && (
        <form onSubmit={handleDisable} className="space-y-5">
          <div className="rounded-lg border border-line bg-surface-muted p-4">
            <p className="text-sm leading-6 text-slate-600">
              Чтобы отключить 2FA, введите текущий пароль и код из приложения-аутентификатора. Вместо кода можно использовать один из backup codes.
            </p>
          </div>

          <Input
            label="Текущий пароль"
            icon={<Lock size={16} />}
            type="password"
            required
            value={disablePassword}
            onChange={(event) => setDisablePassword(event.target.value)}
            placeholder="Введите текущий пароль"
          />

          <Input
            label="Код 2FA или backup code"
            icon={<KeyRound size={16} />}
            type="text"
            required
            value={disableCode}
            onChange={(event) => setDisableCode(event.target.value)}
            placeholder="123456 или ABCDE-12345"
          />

          <Button type="submit" variant="destructive" disabled={isLoading} isLoading={isLoading}>
            Отключить 2FA
          </Button>
        </form>
      )}
    </Card>
  );
}

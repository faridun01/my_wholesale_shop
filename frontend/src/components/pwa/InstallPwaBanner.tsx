import React, { useState } from 'react';
import { Download, X, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import InstallPwaModal from './InstallPwaModal';

export default function InstallPwaBanner() {
  const {
    isStandalone,
    isInstalled,
    isIOS,
    canPromptNative,
    isDismissed,
    promptInstall,
    dismissBanner,
  } = usePWAInstall();

  const [isModalOpen, setIsModalOpen] = useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAutoShowOnLogin = () => {
      const alreadyInstalled =
        isStandalone ||
        isInstalled ||
        (typeof window !== 'undefined' && localStorage.getItem('pwa_is_installed') === 'true');

      if (!alreadyInstalled && window.innerWidth >= 1024) {
        setTimeout(() => {
          setIsModalOpen(true);
        }, 500);
      }
    };

    window.addEventListener('app-logged-in', handleAutoShowOnLogin);
    return () => {
      window.removeEventListener('app-logged-in', handleAutoShowOnLogin);
    };
  }, [isStandalone, isInstalled]);

  // If already running inside standalone window or installed & dismissed, do not render banner
  if (isStandalone || isInstalled || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (canPromptNative) {
      const installed = await promptInstall();
      if (!installed) {
        setIsModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      {/* Floating bottom banner — sits above the mobile bottom nav, back to bottom-4 on desktop where there is no nav bar */}
      <div className="fixed bottom-[calc(4rem+0.75rem+env(safe-area-inset-bottom))] left-4 right-4 z-30 mx-auto max-w-xl lg:bottom-4">
        <div className="relative rounded-xl border border-sidebar-line bg-sidebar p-4 text-white sm:p-4.5">
          <button
            onClick={dismissBanner}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-sidebar-fg-muted transition-colors hover:bg-sidebar-raised hover:text-white"
            title="Скрыть предложение"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3.5 pr-6 sm:pr-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white">
                <Download size={20} />
              </div>

              <div className="space-y-0.5">
                <span className="text-sm font-semibold tracking-tight text-white">Установите приложение «Мой Склад»</span>
                <p className="text-xs leading-snug text-sidebar-fg">
                  Для быстрой работы на ПК или смартфоне без браузера
                </p>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button
                onClick={handleInstallClick}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent-600 sm:flex-initial sm:text-sm"
              >
                <Download size={16} />
                <span>Установить</span>
              </button>

              {!canPromptNative && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sidebar-line text-sidebar-fg transition-colors hover:bg-sidebar-raised hover:text-white"
                  title="Как установить?"
                >
                  <HelpCircle size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <InstallPwaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isIOS={isIOS}
        canPromptNative={canPromptNative}
        onNativeInstall={promptInstall}
      />
    </>
  );
}

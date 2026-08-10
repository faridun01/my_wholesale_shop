import React, { useState } from 'react';
import { Download, X, Smartphone, Monitor, Sparkles, ChevronRight, HelpCircle } from 'lucide-react';
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
      if (!isStandalone && !isInstalled) {
        // Auto-open modal/prompt after login if app is not installed
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
      {/* Floating Bottom Banner for Desktop & Mobile */}
      <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl animate-in slide-in-from-bottom-6 duration-300">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-4 sm:p-5 text-white shadow-[0_20px_50px_rgba(15,159,110,0.25)] backdrop-blur-xl">
          {/* Subtle glowing background light */}
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-teal-500/20 blur-2xl" />

          {/* Close button */}
          <button
            onClick={dismissBanner}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            title="Скрыть предложение"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 pr-6 sm:pr-0">
              <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
                <Download size={24} className="animate-bounce" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] text-slate-900 font-extrabold">
                  <Sparkles size={10} />
                </span>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-white sm:text-base">
                    Установите приложение «Мой Склад»
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  Для быстрой работы на ПК или смартфоне без использования браузера
                </p>
              </div>
            </div>

            <div className="flex w-full sm:w-auto items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 active:scale-95 transition-all"
              >
                <Download size={16} />
                <span>Установить</span>
                <ChevronRight size={14} className="opacity-80" />
              </button>

              {!canPromptNative && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
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

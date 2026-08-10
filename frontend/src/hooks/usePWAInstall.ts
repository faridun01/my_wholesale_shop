import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pwa_banner_dismissed') === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check standalone mode (already installed & opened as PWA app)
    const checkStandalone = () => {
      const isStandaloneMatch =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (navigator as any).standalone === true;

      setIsStandalone(Boolean(isStandaloneMatch));
      if (isStandaloneMatch) {
        setIsInstalled(true);
      }
    };

    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) setIsInstalled(true);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    // Check iOS browser
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS/i.test(ua) && !/FxiOS/i.test(ua);
    setIsIOS(isIosDevice || (isSafari && 'ontouchend' in document));

    // Handle beforeinstallprompt event for Chrome/Edge/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa_banner_dismissed');
    };

    const handleAppLoggedIn = () => {
      setIsDismissed(false);
      localStorage.removeItem('pwa_banner_dismissed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('app-logged-in', handleAppLoggedIn);

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('app-logged-in', handleAppLoggedIn);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          return true;
        }
      } catch (err) {
        console.error('Error prompting PWA install:', err);
      }
    }
    return false;
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  }, []);

  const resetDismissed = useCallback(() => {
    setIsDismissed(false);
    localStorage.removeItem('pwa_banner_dismissed');
  }, []);

  return {
    isStandalone,
    isInstalled,
    isIOS,
    canPromptNative: Boolean(deferredPrompt),
    isDismissed,
    promptInstall,
    dismissBanner,
    resetDismissed,
  };
}

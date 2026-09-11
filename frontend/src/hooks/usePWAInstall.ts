import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY_INSTALLED = 'pwa_is_installed';
const STORAGE_KEY_DISMISSED = 'pwa_banner_dismissed';

export const checkIsStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;

  const isStandaloneMedia =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches ||
    window.matchMedia?.('(display-mode: minimal-ui)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches;

  const isNavigatorStandalone = (window.navigator as any)?.standalone === true;
  const isAndroidApp = typeof document !== 'undefined' && document.referrer?.startsWith('android-app://');
  const isPwaUrlParam =
    typeof window.location !== 'undefined' &&
    (window.location.search?.includes('source=pwa') ||
      window.location.search?.includes('mode=pwa') ||
      window.location.search?.includes('standalone=true'));

  return Boolean(isStandaloneMedia || isNavigatorStandalone || isAndroidApp || isPwaUrlParam);
};

export const checkIsInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (checkIsStandalone()) {
    try {
      localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
    } catch (_) {}
    return true;
  }
  try {
    return localStorage.getItem(STORAGE_KEY_INSTALLED) === 'true';
  } catch (_) {
    return false;
  }
};

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => checkIsStandalone());
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsInstalled());
  const [isIOS, setIsIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator?.userAgent || '';
    const isIosDevice = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS/i.test(ua) && !/FxiOS/i.test(ua);
    return isIosDevice || (isSafari && typeof document !== 'undefined' && 'ontouchend' in document);
  });
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY_DISMISSED) === 'true';
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const recheckStatus = () => {
      const standalone = checkIsStandalone();
      setIsStandalone(standalone);

      if (standalone) {
        setIsInstalled(true);
        try {
          localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
        } catch (_) {}
      } else {
        const storedInstalled = checkIsInstalled();
        if (storedInstalled) {
          setIsInstalled(true);
        }
      }
    };

    recheckStatus();

    // Check modern Chrome / Edge getInstalledRelatedApps API
    if ('getInstalledRelatedApps' in navigator && typeof (navigator as any).getInstalledRelatedApps === 'function') {
      (navigator as any)
        .getInstalledRelatedApps()
        .then((apps: any[]) => {
          if (Array.isArray(apps) && apps.length > 0) {
            setIsInstalled(true);
            try {
              localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
            } catch (_) {}
          }
        })
        .catch(() => {});
    }

    // Media query listeners for standalone display modes
    const displayModes = [
      '(display-mode: standalone)',
      '(display-mode: window-controls-overlay)',
      '(display-mode: minimal-ui)',
      '(display-mode: fullscreen)',
    ];

    const mediaQueryLists = displayModes.map((mode) => window.matchMedia(mode));
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        setIsInstalled(true);
        try {
          localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
        } catch (_) {}
      } else {
        recheckStatus();
      }
    };

    mediaQueryLists.forEach((mql) => {
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handleMediaChange);
      }
    });

    // Handle beforeinstallprompt event for Chrome/Edge/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      try {
        localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
        localStorage.removeItem(STORAGE_KEY_DISMISSED);
      } catch (_) {}
    };

    const handleAppLoggedIn = () => {
      // If already installed or standalone, do nothing
      if (checkIsStandalone() || checkIsInstalled()) {
        return;
      }
      setIsDismissed(false);
      try {
        localStorage.removeItem(STORAGE_KEY_DISMISSED);
      } catch (_) {}
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('app-logged-in', handleAppLoggedIn);

    return () => {
      mediaQueryLists.forEach((mql) => {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', handleMediaChange);
        }
      });
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
          try {
            localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
          } catch (_) {}
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
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED, 'true');
    } catch (_) {}
  }, []);

  const resetDismissed = useCallback(() => {
    setIsDismissed(false);
    try {
      localStorage.removeItem(STORAGE_KEY_DISMISSED);
    } catch (_) {}
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

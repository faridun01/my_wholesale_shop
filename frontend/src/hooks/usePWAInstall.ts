import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY_INSTALLED = 'pwa_is_installed';
const STORAGE_KEY_STANDALONE = 'pwa_is_standalone';
const STORAGE_KEY_DISMISSED = 'pwa_banner_dismissed';

// Memory singletons so within a session it never reverts to false once detected
let hasEverBeenStandalone = false;
let hasEverBeenInstalled = false;

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name: string, value: string) => {
  if (typeof document === 'undefined') return;
  // 1-year persistent cookie accessible across the entire origin (e.g. Safari browser & WebClip)
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

export const saveInstalledState = () => {
  hasEverBeenInstalled = true;
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
  } catch (_) {}

  try {
    sessionStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
  } catch (_) {}

  writeCookie(STORAGE_KEY_INSTALLED, 'true');

  window.dispatchEvent(new CustomEvent('pwa-installed-status-changed', { detail: { installed: true } }));
};

export const saveStandaloneState = () => {
  hasEverBeenStandalone = true;
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(STORAGE_KEY_STANDALONE, 'true');
  } catch (_) {}

  saveInstalledState();
};

export const checkIsStandalone = (): boolean => {
  if (hasEverBeenStandalone) return true;
  if (typeof window === 'undefined') return false;

  // 1. Session storage latch
  try {
    if (sessionStorage.getItem(STORAGE_KEY_STANDALONE) === 'true') {
      hasEverBeenStandalone = true;
      return true;
    }
  } catch (_) {}

  // 2. CSS display-mode media queries (all standalone flavors)
  const isStandaloneMedia =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches ||
    window.matchMedia?.('(display-mode: minimal-ui)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches;

  // 3. iOS Safari WebClip standalone flag
  const isNavigatorStandalone = (window.navigator as any)?.standalone === true;

  // 4. Android TWA / WebAPK referrer
  const isAndroidApp = typeof document !== 'undefined' && document.referrer?.startsWith('android-app://');

  // 5. URL query parameters (source=pwa, mode=pwa, standalone=true)
  const isPwaUrlParam =
    typeof window.location !== 'undefined' &&
    (window.location.search?.includes('source=pwa') ||
      window.location.search?.includes('mode=pwa') ||
      window.location.search?.includes('standalone=true') ||
      window.location.hash?.includes('source=pwa'));

  if (Boolean(isStandaloneMedia || isNavigatorStandalone || isAndroidApp || isPwaUrlParam)) {
    saveStandaloneState();
    return true;
  }

  return false;
};

export const checkIsInstalled = (): boolean => {
  if (hasEverBeenInstalled) return true;
  if (typeof window === 'undefined') return false;

  // If currently running in standalone mode, it is guaranteed installed
  if (checkIsStandalone()) {
    saveInstalledState();
    return true;
  }

  // Check localStorage
  try {
    if (localStorage.getItem(STORAGE_KEY_INSTALLED) === 'true') {
      hasEverBeenInstalled = true;
      return true;
    }
  } catch (_) {}

  // Check sessionStorage
  try {
    if (sessionStorage.getItem(STORAGE_KEY_INSTALLED) === 'true') {
      hasEverBeenInstalled = true;
      return true;
    }
  } catch (_) {}

  // Check persistent cookie (bridges Safari WebClip and Safari Browser)
  if (readCookie(STORAGE_KEY_INSTALLED) === 'true') {
    hasEverBeenInstalled = true;
    try {
      localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
    } catch (_) {}
    return true;
  }

  return false;
};

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => checkIsStandalone());
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsInstalled());
  const [isIOS] = useState<boolean>(() => {
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

  const markAsInstalled = useCallback(() => {
    saveInstalledState();
    setIsInstalled(true);
    setDeferredPrompt(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const recheckStatus = () => {
      const standalone = checkIsStandalone();
      const installed = checkIsInstalled();

      if (standalone) {
        setIsStandalone(true);
        setIsInstalled(true);
      } else if (installed) {
        setIsInstalled(true);
      }
    };

    recheckStatus();

    // Check modern Chrome / Edge getInstalledRelatedApps API
    const checkRelatedApps = () => {
      if ('getInstalledRelatedApps' in navigator && typeof (navigator as any).getInstalledRelatedApps === 'function') {
        (navigator as any)
          .getInstalledRelatedApps()
          .then((apps: any[]) => {
            if (Array.isArray(apps) && apps.length > 0) {
              markAsInstalled();
            }
          })
          .catch(() => {});
      }
    };

    checkRelatedApps();

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
        saveStandaloneState();
        setIsStandalone(true);
        setIsInstalled(true);
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
      // If already standalone or installed, ignore the prompt
      if (checkIsStandalone() || checkIsInstalled()) {
        return;
      }
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      markAsInstalled();
      try {
        localStorage.removeItem(STORAGE_KEY_DISMISSED);
      } catch (_) {}
    };

    const handleAppLoggedIn = () => {
      if (checkIsStandalone() || checkIsInstalled()) {
        return;
      }
      setIsDismissed(false);
      try {
        localStorage.removeItem(STORAGE_KEY_DISMISSED);
      } catch (_) {}
    };

    const handleInstalledStatusChanged = () => {
      recheckStatus();
    };

    const handleWindowFocus = () => {
      recheckStatus();
      checkRelatedApps();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('app-logged-in', handleAppLoggedIn);
    window.addEventListener('pwa-installed-status-changed', handleInstalledStatusChanged);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    return () => {
      mediaQueryLists.forEach((mql) => {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', handleMediaChange);
        }
      });
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('app-logged-in', handleAppLoggedIn);
      window.removeEventListener('pwa-installed-status-changed', handleInstalledStatusChanged);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
    };
  }, [markAsInstalled]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          markAsInstalled();
          return true;
        }
      } catch (err) {
        console.error('Error prompting PWA install:', err);
      }
    }
    return false;
  }, [deferredPrompt, markAsInstalled]);

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
    markAsInstalled,
  };
}

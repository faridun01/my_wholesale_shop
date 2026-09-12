import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Download, LogOut, X } from 'lucide-react';
import { clsx } from 'clsx';
import { logout } from '../../api/auth.api';
import { clearAuthSession } from '../../utils/authStorage';
import { getCurrentUser } from '../../utils/userAccess';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import InstallPwaModal from '../pwa/InstallPwaModal';
import { getFilteredNavItems } from './navConfig';

type MobileMoreSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  pinnedRoutes: string[];
};

export default function MobileMoreSheet({ isOpen, onClose, pinnedRoutes }: MobileMoreSheetProps) {
  const navigate = useNavigate();
  const user = React.useMemo(() => getCurrentUser(), []);
  const { isStandalone, isInstalled, isIOS, canPromptNative, promptInstall, markAsInstalled } = usePWAInstall();
  const [isPwaModalOpen, setIsPwaModalOpen] = React.useState(false);

  const items = React.useMemo(
    // '/' (Dashboard) is intentionally excluded on mobile — it resolves through
    // RootRoute, which always sends mobile viewports to /pos, so a link to it
    // here would just bounce straight back instead of opening anything.
    () => getFilteredNavItems(user).filter((item) => !pinnedRoutes.includes(item.to) && item.to !== '/'),
    [user, pinnedRoutes],
  );

  const sections = React.useMemo(() => {
    return items.reduce<Record<string, typeof items>>((acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    }, {});
  }, [items]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Server session may already be gone — clear locally regardless.
    }
    clearAuthSession();
    onClose();
    navigate('/login');
  };

  const handleInstallClick = async () => {
    if (canPromptNative) {
      const installed = await promptInstall();
      if (!installed) setIsPwaModalOpen(true);
    } else {
      setIsPwaModalOpen(true);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 lg:hidden" onClick={onClose}>
        <div
          className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                {user.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{user.username}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{user.role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong text-slate-500"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {Object.entries(sections).map(([section, sectionItems]) => (
              <div key={section} className="mb-3">
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section}</p>
                <div className="space-y-0.5">
                  {sectionItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/customers'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        clsx(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive ? 'bg-accent-50 text-accent-700' : 'text-slate-700 hover:bg-surface-muted',
                        )
                      }
                    >
                      <item.icon size={18} strokeWidth={2} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            {!isStandalone && !isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="mb-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-accent-700 hover:bg-accent-50"
              >
                <Download size={18} className="shrink-0" />
                <span>Установить приложение</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <LogOut size={18} className="shrink-0" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </div>

      <InstallPwaModal
        isOpen={isPwaModalOpen && !isStandalone && !isInstalled}
        onClose={() => setIsPwaModalOpen(false)}
        isIOS={isIOS}
        canPromptNative={canPromptNative}
        onNativeInstall={promptInstall}
        onMarkAsInstalled={markAsInstalled}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Warehouse as WarehouseIcon, X } from 'lucide-react';
import type { StaffUser } from '../../api/staff.api';
import StaffInvoiceDetails from './StaffInvoiceDetails';
import StaffInvoicesList from './StaffInvoicesList';
import StaffPeriodPicker from './StaffPeriodPicker';
import StaffStatsPanel, { type StaffStatusFilter } from './StaffStatsPanel';
import { DEFAULT_STAFF_PERIOD_PRESET, buildStaffPeriod, type StaffPeriod } from './staffPeriod';
import useStaffSummary from './useStaffSummary';

export const STAFF_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  SELLER: 'Продавец',
  CUSTOMER: 'Клиент',
};

export const getStaffRoleLabel = (role: unknown) => STAFF_ROLE_LABELS[String(role || '').toUpperCase()] || String(role || '—');

type StaffDetailsModalProps = {
  staff: Pick<StaffUser, 'id' | 'username' | 'role'> & Partial<Pick<StaffUser, 'active' | 'warehouse'>>;
  initialPeriod?: StaffPeriod;
  /** Admin can record payments right from the card. */
  canRecordPayment: boolean;
  onClose: () => void;
  /** Called after a payment so the parent can refresh its own figures. */
  onDataChanged?: () => void;
};

export default function StaffDetailsModal({ staff, initialPeriod, canRecordPayment, onClose, onDataChanged }: StaffDetailsModalProps) {
  const [period, setPeriod] = useState<StaffPeriod>(() => initialPeriod || buildStaffPeriod(DEFAULT_STAFF_PERIOD_PRESET));
  const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>('all');
  const [openInvoiceId, setOpenInvoiceId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { summary, isLoading, hasError, reload } = useStaffSummary(staff.id, period);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openInvoiceId) setOpenInvoiceId(null);
      else onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openInvoiceId, onClose]);

  const handlePaid = () => {
    setRefreshKey((key) => key + 1);
    void reload();
    onDataChanged?.();
  };

  const warehouseName = summary?.user.warehouse?.name ?? staff.warehouse?.name;
  const isActive = summary?.user.active ?? staff.active ?? true;

  // The invoice sheet is a sibling, not a child, of the backdrop: React events
  // bubble through the component tree, so a click on its own backdrop would
  // otherwise also close this panel.
  return (
    <>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] flex justify-end bg-slate-900/50 backdrop-blur-xs"
      >
        <m.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="flex h-full w-full flex-col bg-[#f4f5fb] shadow-2xl sm:max-w-2xl sm:border-l sm:border-slate-200"
          role="dialog"
          aria-modal="true"
          aria-label={`Сотрудник ${staff.username}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-base font-black text-white">
                {staff.username[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-black text-slate-900">{staff.username}</h2>
                  {!isActive && (
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Неактивен</span>
                  )}
                </div>
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                  <span className="font-semibold">{getStaffRoleLabel(staff.role)}</span>
                  <span className="text-slate-300">•</span>
                  <WarehouseIcon size={12} className="shrink-0 text-slate-400" />
                  <span className="truncate">{warehouseName || 'Все склады'}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <StaffPeriodPicker period={period} onChange={setPeriod} />

            <StaffStatsPanel
              metrics={summary}
              loading={isLoading}
              error={hasError}
              onRetry={() => void reload()}
              profit={summary?.profit}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />

            <StaffInvoicesList
              userId={staff.id}
              period={period}
              statusFilter={statusFilter}
              refreshKey={refreshKey}
              onOpenInvoice={setOpenInvoiceId}
            />
          </div>
        </m.div>
      </m.div>

      <AnimatePresence>
        {openInvoiceId && (
          <StaffInvoiceDetails
            key={openInvoiceId}
            invoiceId={openInvoiceId}
            canRecordPayment={canRecordPayment}
            onClose={() => setOpenInvoiceId(null)}
            onPaid={handlePaid}
          />
        )}
      </AnimatePresence>
    </>
  );
}

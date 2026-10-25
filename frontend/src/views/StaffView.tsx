import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { ChevronRight, Search, UserCheck, Warehouse as WarehouseIcon } from 'lucide-react';
import { getStaffStats, type StaffStatsResponse, type StaffStatsRow } from '../api/staff.api';
import { getWarehouses } from '../api/warehouses.api';
import { formatCount, formatMoney } from '../utils/format';
import { EmptyState, PageHeader, Skeleton } from '../components/UI';
import StaffDetailsModal, { getStaffRoleLabel } from '../components/staff/StaffDetailsModal';
import StaffPeriodPicker from '../components/staff/StaffPeriodPicker';
import StaffStatsPanel, { formatPercentValue } from '../components/staff/StaffStatsPanel';
import { DEFAULT_STAFF_PERIOD_PRESET, buildStaffPeriod, type StaffPeriod } from '../components/staff/staffPeriod';

type SortKey = 'sold' | 'debt' | 'invoices' | 'collection';

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'sold', label: 'По продажам' },
  { id: 'debt', label: 'По долгу' },
  { id: 'invoices', label: 'По накладным' },
  { id: 'collection', label: 'По % сбора' },
];

const sortStaff = (rows: StaffStatsRow[], key: SortKey) => {
  const value = (row: StaffStatsRow) => {
    switch (key) {
      case 'debt':
        return row.debtAmount;
      case 'invoices':
        return row.invoicesCount;
      case 'collection':
        return row.soldAmount > 0 ? row.collectionRate : -1;
      default:
        return row.soldAmount;
    }
  };
  return [...rows].sort((a, b) => value(b) - value(a) || a.username.localeCompare(b.username, 'ru'));
};

function CollectionBar({ rate, hasSales }: { rate: number; hasSales: boolean }) {
  const percent = Math.round(Math.max(0, Math.min(1, rate)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={clsx('h-full rounded-full', percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-400' : 'bg-rose-400')}
          style={{ width: `${hasSales ? percent : 0}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] font-bold text-slate-600">{hasSales ? `${percent}%` : '—'}</span>
    </div>
  );
}

export default function StaffView() {
  const [period, setPeriod] = useState<StaffPeriod>(() => buildStaffPeriod(DEFAULT_STAFF_PERIOD_PRESET));
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<Array<{ id: number; name: string }>>([]);
  const [data, setData] = useState<StaffStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sold');
  const [selectedStaff, setSelectedStaff] = useState<StaffStatsRow | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    getWarehouses()
      .then((list) => setWarehouses(Array.isArray(list) ? list : []))
      .catch(() => setWarehouses([]));
  }, []);

  const loadStats = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setHasError(false);
    try {
      const result = await getStaffStats({
        start: period.start,
        end: period.end,
        warehouseId: warehouseId ? Number(warehouseId) : null,
      });
      if (requestId === requestIdRef.current) setData(result);
    } catch {
      if (requestId === requestIdRef.current) setHasError(true);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [period.start, period.end, warehouseId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const visibleStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = (data?.staff || []).filter((row) => !query || row.username.toLowerCase().includes(query));
    return sortStaff(rows, sortKey);
  }, [data, search, sortKey]);

  const closeStaffModal = useCallback(() => setSelectedStaff(null), []);

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="min-h-screen space-y-3.5 sm:space-y-4 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5">
        <PageHeader
          title="Сотрудники"
          description="Кто сколько оформил накладных, на какую сумму и сколько из этого оплачено"
          badges={
            data ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-500">{data.staff.length}</span>
            ) : null
          }
        />

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <StaffPeriodPicker period={period} onChange={setPeriod} />
          {warehouses.length > 1 && (
            <label className="relative block">
              <WarehouseIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                aria-label="Склад"
                className="h-[42px] w-full appearance-none rounded-2xl border border-slate-200/80 bg-white pl-8 pr-8 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-slate-400 lg:w-52"
              >
                <option value="">Все склады</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <StaffStatsPanel metrics={data?.totals || null} loading={isLoading} error={hasError} onRetry={() => void loadStats()} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск сотрудника"
              className="h-10 w-full rounded-2xl border border-slate-200/80 bg-white pl-8 pr-3 text-xs font-semibold text-slate-800 shadow-2xs outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>
          <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1 shadow-2xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSortKey(option.id)}
                className={clsx(
                  'shrink-0 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                  sortKey === option.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[104px] rounded-2xl" />
            ))}
          </div>
        ) : visibleStaff.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <EmptyState
              icon={<UserCheck size={20} />}
              title={search ? 'Никого не нашли' : 'Сотрудников пока нет'}
              description={search ? 'Измените запрос поиска.' : 'Добавьте сотрудников в Настройки → Пользователи.'}
            />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className={clsx('space-y-2 md:hidden', isLoading && 'opacity-60')}>
              {visibleStaff.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedStaff(row)}
                  className="w-full rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-2xs transition-all active:scale-[0.99] active:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">
                      {row.username[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-black text-slate-900">{row.username}</p>
                        {!row.active && <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[9px] font-bold text-slate-500">Неактивен</span>}
                      </div>
                      <p className="truncate text-[11px] text-slate-500">
                        {getStaffRoleLabel(row.role)} · {row.warehouse?.name || 'Все склады'}
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-300" />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Продано</p>
                      <p className="truncate font-mono text-xs font-black text-slate-900">{formatMoney(row.soldAmount)}</p>
                      <p className="text-[10px] text-slate-400">{formatCount(row.invoicesCount)} накл.</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Оплачено</p>
                      <p className="truncate font-mono text-xs font-black text-emerald-700">{formatMoney(row.paidAmount)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Долг</p>
                      <p className={clsx('truncate font-mono text-xs font-black', row.debtAmount > 0 ? 'text-rose-600' : 'text-slate-300')}>
                        {formatMoney(row.debtAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <CollectionBar rate={row.collectionRate} hasSales={row.soldAmount > 0} />
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div className={clsx('hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs md:block', isLoading && 'opacity-60')}>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3.5 py-2.5">Сотрудник</th>
                    <th className="px-3.5 py-2.5 text-right">Накладных</th>
                    <th className="px-3.5 py-2.5 text-right">Продано</th>
                    <th className="px-3.5 py-2.5 text-right">Оплачено</th>
                    <th className="px-3.5 py-2.5 text-right">Долг</th>
                    <th className="w-44 px-3.5 py-2.5">Собрано</th>
                    <th className="w-8 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {visibleStaff.map((row) => (
                    <tr key={row.id} onClick={() => setSelectedStaff(row)} className="cursor-pointer transition-colors hover:bg-slate-50">
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
                            {row.username[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-bold text-slate-900">{row.username}</span>
                              {!row.active && <span className="rounded bg-slate-100 px-1.5 text-[9px] font-bold text-slate-500">Неактивен</span>}
                            </div>
                            <p className="truncate text-[11px] text-slate-400">
                              {getStaffRoleLabel(row.role)} · {row.warehouse?.name || 'Все склады'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold">{formatCount(row.invoicesCount)}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">{formatMoney(row.soldAmount)}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-emerald-700">{formatMoney(row.paidAmount)}</td>
                      <td className={clsx('px-3.5 py-2.5 text-right font-mono tabular-nums', row.debtAmount > 0 ? 'font-bold text-rose-600' : 'text-slate-300')}>
                        {formatMoney(row.debtAmount)}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <CollectionBar rate={row.collectionRate} hasSales={row.soldAmount > 0} />
                      </td>
                      <td className="px-2 py-2.5 text-slate-300">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data && data.totals.invoicesCount > 0 && (
          <p className="px-1 text-[11px] text-slate-400">
            Всего собрано {formatPercentValue(data.totals.collectionRate)} от продаж. Отменённые накладные не учитываются.
          </p>
        )}
      </div>

      <AnimatePresence>
        {selectedStaff && (
          <StaffDetailsModal
            key={selectedStaff.id}
            staff={selectedStaff}
            initialPeriod={period}
            canRecordPayment
            onClose={closeStaffModal}
            onDataChanged={() => void loadStats()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

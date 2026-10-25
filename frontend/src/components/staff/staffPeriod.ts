import { toLocalDateKey } from '../../utils/format';

export type StaffPeriodPreset = 'today' | 'week' | 'month' | 'all' | 'custom';

export type StaffPeriod = {
  preset: StaffPeriodPreset;
  start?: string;
  end?: string;
};

export const STAFF_PERIOD_PRESETS: Array<{ id: StaffPeriodPreset; label: string }> = [
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Всё время' },
  { id: 'custom', label: 'Период' },
];

export const buildStaffPeriod = (preset: StaffPeriodPreset, custom?: { start?: string; end?: string }): StaffPeriod => {
  const today = new Date();
  const end = toLocalDateKey(today);

  switch (preset) {
    case 'today':
      return { preset, start: end, end };
    case 'week': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { preset, start: toLocalDateKey(start), end };
    }
    case 'month':
      return { preset, start: toLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end };
    case 'custom':
      return { preset, start: custom?.start || undefined, end: custom?.end || undefined };
    default:
      return { preset: 'all' };
  }
};

export const DEFAULT_STAFF_PERIOD_PRESET: StaffPeriodPreset = 'month';

const formatShortDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export const describeStaffPeriod = (period: StaffPeriod) => {
  if (period.preset === 'all' || (!period.start && !period.end)) return 'за всё время';
  if (period.preset === 'today') return 'за сегодня';
  if (period.start && period.end) {
    return period.start === period.end
      ? `за ${formatShortDate(period.start)}`
      : `${formatShortDate(period.start)} — ${formatShortDate(period.end)}`;
  }
  if (period.start) return `с ${formatShortDate(period.start)}`;
  return `по ${formatShortDate(period.end as string)}`;
};

import { clsx } from 'clsx';
import { CalendarDays } from 'lucide-react';
import { STAFF_PERIOD_PRESETS, buildStaffPeriod, describeStaffPeriod, type StaffPeriod } from './staffPeriod';

type StaffPeriodPickerProps = {
  period: StaffPeriod;
  onChange: (period: StaffPeriod) => void;
  className?: string;
};

export default function StaffPeriodPicker({ period, onChange, className }: StaffPeriodPickerProps) {
  const isCustom = period.preset === 'custom';

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1 shadow-2xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STAFF_PERIOD_PRESETS.map((preset) => {
          const active = period.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onChange(
                  preset.id === 'custom'
                    ? buildStaffPeriod('custom', { start: period.start, end: period.end })
                    : buildStaffPeriod(preset.id),
                )
              }
              className={clsx(
                'flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shrink-0',
                active ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {preset.id === 'custom' && <CalendarDays size={13} className={active ? 'text-white' : 'text-slate-400'} />}
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>

      {isCustom ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">С</span>
            <input
              type="date"
              value={period.start || ''}
              max={period.end || undefined}
              onChange={(e) => onChange({ ...period, start: e.target.value || undefined })}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">По</span>
            <input
              type="date"
              value={period.end || ''}
              min={period.start || undefined}
              onChange={(e) => onChange({ ...period, end: e.target.value || undefined })}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-slate-400"
            />
          </label>
        </div>
      ) : (
        <p className="px-1 text-[11px] font-medium text-slate-400">Показаны данные {describeStaffPeriod(period)}</p>
      )}
    </div>
  );
}

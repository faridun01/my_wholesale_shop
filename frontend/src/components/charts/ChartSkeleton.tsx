import React from 'react';

interface ChartSkeletonProps {
  variant?: 'area' | 'pie' | 'bar';
  heightClassName?: string;
}

export default function ChartSkeleton({
  variant = 'area',
  heightClassName = 'h-[312px]',
}: ChartSkeletonProps) {
  return (
    <div className={`${heightClassName} card p-4`}>
      <div className="animate-pulse">
        <div className="h-3.5 w-28 rounded-md bg-slate-200" />
        <div className="mt-2.5 h-3 w-40 rounded-md bg-slate-100" />
        <div className="mt-6 h-50 rounded-lg bg-surface-muted p-4">
          {variant === 'pie' ? (
            <div className="flex h-full items-center justify-center">
              <div className="relative h-32 w-32 rounded-full bg-slate-200/70">
                <div className="absolute inset-5.5 rounded-full bg-surface-muted" />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-end gap-3">
              {(variant === 'bar'
                ? ['h-16', 'h-28', 'h-20', 'h-36', 'h-24', 'h-32']
                : ['h-14', 'h-20', 'h-24', 'h-16', 'h-32', 'h-28']).map((height, index) => (
                <div key={index} className="flex-1">
                  <div className={`${height} rounded-t-md bg-slate-200/70`} />
                </div>
              ))}
            </div>
          )}
        </div>
        {variant === 'pie' && (
          <div className="mt-4 space-y-2.5">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-slate-200" />
                  <div className="h-3 w-24 rounded-md bg-slate-100" />
                </div>
                <div className="h-3 w-10 rounded-md bg-slate-100" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

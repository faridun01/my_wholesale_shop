import React from 'react';
import { clsx } from 'clsx';

export const Card = ({ title, children, className, headerActions }: { title?: string, children: React.ReactNode, className?: string, headerActions?: React.ReactNode }) => (
  <div className={clsx("bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden", className)}>
    {title && (
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
        <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
        {headerActions}
      </div>
    )}
    <div className="p-5">
      {children}
    </div>
  </div>
);

export const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'danger' }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
  };
  return (
    <span className={clsx("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", variants[variant])}>
      {children}
    </span>
  );
};

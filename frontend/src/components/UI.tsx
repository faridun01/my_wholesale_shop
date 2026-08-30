import React from 'react';
import { clsx } from 'clsx';
import { Loader2, Search, X } from 'lucide-react';

/* ==========================================================================
   1. BUTTON COMPONENT
   ========================================================================== */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}) => {
  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    destructive: 'btn-destructive',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-md min-h-[34px]',
    md: 'px-4 py-2.5 text-sm rounded-lg min-h-10',
    lg: 'px-5 py-3 text-base rounded-lg min-h-12',
  };

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={clsx(variantClasses[variant], sizeClasses[size], 'font-semibold', className)}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} className="animate-spin text-current" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
};

/* ==========================================================================
   1b. ICON BUTTON — a square, touch-friendly button for icon-only actions
   ========================================================================== */
export type IconButtonVariant = 'default' | 'ghost' | 'danger';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: 'sm' | 'md';
  label: string; // required — used as title + aria-label so icon-only buttons stay accessible
  children: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'default',
  size = 'md',
  label,
  children,
  className,
  ...props
}) => {
  const variants: Record<IconButtonVariant, string> = {
    default: 'border border-line-strong bg-white text-slate-600 hover:bg-surface-muted hover:text-slate-900',
    ghost: 'text-slate-500 hover:bg-surface-muted hover:text-slate-900',
    danger: 'border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100',
  };

  const sizes = {
    sm: 'h-9 w-9',
    md: 'h-11 w-11',
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

/* ==========================================================================
   2. BADGE / STATUS PILL
   ========================================================================== */
export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className, icon }) => {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-tight',
        variants[variant],
        className,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
};

/* ==========================================================================
   3. CARD COMPONENT — flat surface, no hover-lift/glow/glass
   ========================================================================== */
export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerActions,
  children,
  footer,
  className,
  bodyClassName,
}) => {
  return (
    <div className={clsx('card', className)}>
      {(title || headerActions) && (
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            {typeof title === 'string' ? <h3 className="text-section-title">{title}</h3> : title}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      <div className={clsx('p-4 sm:p-5', bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-line bg-surface-muted px-4 py-3 sm:px-5">{footer}</div>}
    </div>
  );
};

/* ==========================================================================
   3b. STAT TILE — dashboard / report metric card
   ========================================================================== */
export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  change?: { value: string; direction: 'up' | 'down' | 'flat' };
  icon?: React.ReactNode;
  className?: string;
}

export const StatTile: React.FC<StatTileProps> = ({ label, value, change, icon, className }) => (
  <div className={clsx('card p-4 sm:p-5', className)}>
    <div className="flex items-start justify-between gap-3">
      <p className="text-eyebrow">{label}</p>
      {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
    </div>
    <p className="font-tabular mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    {change && (
      <p
        className={clsx(
          'mt-1.5 text-xs font-semibold',
          change.direction === 'up' && 'text-emerald-600',
          change.direction === 'down' && 'text-rose-600',
          change.direction === 'flat' && 'text-slate-400',
        )}
      >
        {change.value}
      </p>
    )}
  </div>
);

/* ==========================================================================
   4. FORM CONTROLS (INPUT, TEXTAREA, SELECT, SEARCH)
   ========================================================================== */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        {icon && <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input
          ref={ref}
          className={clsx(
            'app-control w-full',
            icon && 'pl-10',
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15',
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, rows = 3, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'app-control w-full min-h-0 resize-y py-2.5',
          error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: Array<{ value: string | number; label: string; disabled?: boolean }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, children, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'app-control w-full appearance-none pr-8',
          error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15',
          className,
        )}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, onClear, className, placeholder = 'Поиск...', ...props }) => (
  <div className="relative w-full">
    <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={clsx('app-control w-full pl-10 pr-9 text-sm', className)}
      {...props}
    />
    {value && onClear && (
      <button
        type="button"
        onClick={onClear}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        <X size={16} />
      </button>
    )}
  </div>
);

/* ==========================================================================
   5. PAGE HEADER
   ========================================================================== */
export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, badges }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-page-title">{title}</h1>
        {badges && <div className="flex items-center gap-2">{badges}</div>}
      </div>
      {description && <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
  </div>
);

/* ==========================================================================
   6. EMPTY / LOADING / ERROR STATES
   ========================================================================== */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div className={clsx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
    {icon && (
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-slate-400">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Загрузка...' }) => (
  <div className="flex min-h-50 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
    <Loader2 size={22} className="animate-spin text-accent-500" />
    <span className="text-xs font-semibold text-slate-500">{message}</span>
  </div>
);

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Не удалось загрузить данные',
  description = 'Проверьте подключение и попробуйте ещё раз.',
  action,
  className,
}) => (
  <div className={clsx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
      <X size={20} />
    </div>
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/** Skeleton block for content that's loading — pairs with a real layout so pages
 * don't jump when data arrives. Use fixed heights matching the real content. */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('animate-pulse rounded-md bg-slate-200/70', className)} />
);

/* ==========================================================================
   7. MODAL / DIALOG COMPONENT
   ========================================================================== */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children, footer, maxWidth = 'md' }) => {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
      <div
        className={clsx(
          'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[85vh] sm:rounded-2xl',
          maxWidthClasses[maxWidth],
        )}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-line px-5 py-4">
          <div>
            {typeof title === 'string' ? <h3 className="text-section-title">{title}</h3> : title}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <IconButton label="Закрыть" variant="ghost" size="sm" onClick={onClose} className="-mr-1.5 -mt-1">
            <X size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-line bg-surface-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   8. TABLE SHELL — consistent desktop table chrome. Pair with a `md:hidden`
   mobile card list (see .mobile-row-card in index.css) for the responsive
   fallback; this component only renders the desktop table itself.
   ========================================================================== */
export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className, ...props }) => (
  <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
    <table className={clsx('table-shell', className)} {...props} />
  </div>
);

export const Thead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = (props) => <thead {...props} />;
export const Tbody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...props }) => (
  <tbody className={clsx('divide-y divide-line', className)} {...props} />
);
export const Tr: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className, ...props }) => (
  <tr className={clsx('table-row', className)} {...props} />
);
export const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, ...props }) => (
  <th className={clsx('table-head-row table-cell', className)} {...props} />
);
export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, ...props }) => (
  <td className={clsx('table-cell text-slate-700', className)} {...props} />
);

/* ==========================================================================
   9. TABS
   ========================================================================== */
export interface TabsProps {
  tabs: Array<{ key: string; label: string; count?: number }>;
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange, className }) => (
  <div className={clsx('flex items-center gap-1 overflow-x-auto rounded-lg bg-surface-muted p-1', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.key}
        type="button"
        onClick={() => onChange(tab.key)}
        className={clsx(
          'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
          active === tab.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800',
        )}
      >
        {tab.label}
        {typeof tab.count === 'number' && (
          <span
            className={clsx(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              active === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/70 text-slate-500',
            )}
          >
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

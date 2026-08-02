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
    sm: 'px-3 py-1.5 text-xs rounded-lg min-h-[34px]',
    md: 'px-4 py-2 text-sm rounded-xl min-h-[40px]',
    lg: 'px-5 py-2.5 text-base rounded-xl min-h-[46px]',
  };

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={clsx(
        variantClasses[variant],
        sizeClasses[size],
        'inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98]',
        className
      )}
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
   2. BADGE COMPONENT
   ========================================================================== */
export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className,
  icon,
}) => {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    info: 'bg-sky-50 text-sky-700 border-sky-200/80',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold tracking-tight uppercase',
        variants[variant],
        className
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
};

/* ==========================================================================
   3. CARD COMPONENT
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
}) => (
  <div className={clsx('card', className)}>
    {(title || headerActions) && (
      <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {typeof title === 'string' ? (
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
          ) : (
            title
          )}
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {headerActions && <div className="flex items-center gap-2 mt-2 sm:mt-0">{headerActions}</div>}
      </div>
    )}
    <div className={clsx('p-5', bodyClassName)}>{children}</div>
    {footer && <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">{footer}</div>}
  </div>
);

/* ==========================================================================
   4. FORM CONTROLS (INPUT, SELECT, SEARCH)
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
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'app-control w-full',
            icon && 'pl-10',
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

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
          error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
          className
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
  )
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
  <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-white px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {badges && <div className="flex items-center gap-2">{badges}</div>}
      </div>
      {description && <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
  </div>
);

/* ==========================================================================
   6. EMPTY STATE & LOADING STATE
   ========================================================================== */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => (
  <div className={clsx('flex flex-col items-center justify-center p-8 text-center sm:p-12', className)}>
    {icon && (
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </div>
    )}
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Загрузка...' }) => (
  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-8 text-center">
    <Loader2 size={24} className="animate-spin text-emerald-600" />
    <span className="text-xs font-semibold text-slate-500">{message}</span>
  </div>
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

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-md">
      <div
        className={clsx(
          'relative w-full rounded-3xl bg-white shadow-2xl transition-all border border-slate-100',
          maxWidthClasses[maxWidth]
        )}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
};

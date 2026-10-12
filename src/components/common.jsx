import React from 'react';
import * as Icons from 'lucide-react';

export function Icon({ name = 'Circle', size = 18, strokeWidth = 1.8, className = '' }) {
  const Component = Icons[name] || Icons.Circle;
  return <Component aria-hidden="true" size={size} strokeWidth={strokeWidth} className={className} />;
}

export function Button({ children, icon, variant = 'primary', size = 'md', className = '', type = 'button', disabled = false, onClick, title }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    soft: 'bg-primary/10 text-primary hover:bg-primary/15 dark:bg-indigo-400/15 dark:text-indigo-300',
  };
  const sizes = { sm: 'px-3 py-2 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-sm', icon: 'p-2.5' };
  return <button type={type} disabled={disabled} onClick={onClick} title={title} className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}>
    {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}{children}
  </button>;
}

export function Panel({ children, className = '', padding = 'p-5' }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900 ${padding} ${className}`}>{children}</section>;
}

export function PageHeading({ eyebrow, title, description, actions }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>{eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p>}<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>{description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}</div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </div>;
}

export function Field({ label, children, hint, error, className = '', htmlFor }) {
  return <div className={`min-w-0 ${className}`}>
    {label && <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</label>}
    {children}
    {hint && !error && <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{hint}</p>}
    {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
  </div>;
}

export const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600';
export const selectClass = inputClass;
export const textareaClass = `${inputClass} min-h-[92px] resize-y`;

export function StatusBadge({ status = 'Draft' }) {
  const key = String(status).toLowerCase();
  let style = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  if (['paid', 'accepted', 'recorded'].includes(key)) style = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  else if (['overdue', 'rejected', 'cancelled'].includes(key)) style = 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300';
  else if (['sent', 'issued', 'partially paid', 'converted to invoice'].includes(key)) style = 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
  else if (['expired'].includes(key)) style = 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{status}</span>;
}

export function EmptyState({ icon = 'FilePlus2', title, description, action, secondary }) {
  return <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
    <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary"><Icon name={icon} size={25} /></div>
    <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
    {(action || secondary) && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}{secondary}</div>}
  </div>;
}

export function Modal({ open, title, subtitle, onClose, children, wide = false }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; previous?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
        <div><h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>
        <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800" aria-label="Close dialog"><Icon name="X" size={18} /></button>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  </div>;
}

export function ToastRegion({ toasts, dismiss }) {
  return <div aria-live="polite" aria-atomic="false" className="fixed bottom-4 right-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
    {toasts.map((toast) => <div key={toast.id} className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-xl dark:bg-slate-900 ${toast.kind === 'error' ? 'border-red-200 dark:border-red-900' : toast.kind === 'success' ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className={`mt-0.5 ${toast.kind === 'error' ? 'text-red-500' : toast.kind === 'success' ? 'text-emerald-500' : 'text-primary'}`}><Icon name={toast.kind === 'error' ? 'AlertCircle' : toast.kind === 'success' ? 'CheckCircle2' : 'Info'} size={18} /></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900 dark:text-white">{toast.title}</p>{toast.message && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{toast.message}</p>}</div>
      <button onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="text-slate-400 hover:text-slate-700"><Icon name="X" size={15} /></button>
    </div>)}
  </div>;
}

export function SectionTitle({ title, description, action }) {
  return <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>{description && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}</div>{action}</div>;
}

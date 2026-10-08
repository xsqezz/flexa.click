import { cloneElement, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { ArrowUpRight, LoaderCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link className="brand" to="/" aria-label="Flexa — strona główna">
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
      <rect width="36" height="36" rx="11" fill="currentColor" />
      <path d="M11 26V11h16l-3 5H16v3h7l-3 5h-4v2z" fill="#fff" />
    </svg>
    {!compact && <span>flexa<span className="brand-dot">.</span></span>}
  </Link>
}

export function Button({ children, busy, variant = 'primary', className = '', disabled, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button button-${variant} ${className}`} disabled={disabled || busy}
    aria-busy={busy || undefined} {...props}>
    {busy && <LoaderCircle className="spin" size={17} aria-hidden="true" />}
    {children}
  </button>
}

export function Field({ label, hint, children, action }:
  { label: string; hint?: string; children: ReactElement<{ id?: string; 'aria-describedby'?: string }>; action?: ReactNode }) {
  const generatedId = useId()
  const id = children.props.id ?? generatedId
  const hintId = `${generatedId}-hint`
  const describedBy = [children.props['aria-describedby'], hint ? hintId : undefined].filter(Boolean).join(' ') || undefined
  const control = cloneElement(children, { id, 'aria-describedby': describedBy })
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    {action ? <span className="password-field">{control}{action}</span> : control}
    {hint && <small id={hintId}>{hint}</small>}
  </div>
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'success' }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><h3>{title}</h3><p>{children}</p>{action}</div>
}

export function Drawer({ title, children, onClose, variant = 'side' }: { title: string; children: ReactNode; onClose: () => void; variant?: 'side' | 'sheet' }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  return <dialog className={variant === 'sheet' ? 'drawer drawer-sheet' : 'drawer'} ref={ref} aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (variant === 'sheet' && event.target === event.currentTarget) onClose() }}>
    <header className="drawer-header"><h2 id={id}>{title}</h2>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Zamknij panel"><X size={20} /></button>
    </header><div className="drawer-body">{children}</div>
  </dialog>
}

export function Confirm({ title, children, onConfirm, onClose, busy = false, error, confirmLabel = 'Usuń wpis', cancelLabel = 'Zachowaj wpis' }:
  { title: string; children: ReactNode; onConfirm: () => void; onClose: () => void; busy?: boolean; error?: string | null; confirmLabel?: string; cancelLabel?: string }) {
  return <Drawer title={title} onClose={busy ? () => {} : onClose}>
    <p>{children}</p>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="button-row">
      <Button variant="secondary" onClick={onClose} disabled={busy}>{cancelLabel}</Button>
      <Button variant="danger" onClick={onConfirm} busy={busy}>{confirmLabel}</Button>
    </div>
  </Drawer>
}

export function SectionHeading({ title, children, to }: { title: string; children?: ReactNode; to?: string }) {
  return <div className="section-heading"><h2>{title}</h2>
    {to ? <Link className="text-link" to={to}>{children}<ArrowUpRight size={16} aria-hidden="true" /></Link> : children}
  </div>
}

export function Skeleton() {
  return <div className="loading-layout" role="status" aria-label="Ładowanie dziennika">
    <div className="skeleton skeleton-heading" /><div className="skeleton skeleton-panel" />
    <div className="skeleton skeleton-panel" /><span className="sr-only">Ładowanie danych…</span>
  </div>
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nie udało się wykonać operacji. Spróbuj ponownie.'
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, CircleAlert, X } from 'lucide-react'

export type FeedbackOptions = {
  tone?: 'success' | 'error'
  /** Przycisk w komunikacie, np. „Cofnij”. */
  action?: { label: string; onAction: () => void }
  /** Wywoływane, gdy komunikat zniknie bez użycia przycisku (czas minął, zamknięto go albo zastąpił go inny). */
  onDismiss?: () => void
}
type Toast = FeedbackOptions & { id: number; message: string }
type Feedback = (message: string, options?: FeedbackOptions) => void

const FeedbackContext = createContext<Feedback | null>(null)
const PLAIN_MS = 5000
const ACTION_MS = 8000

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const current = useRef<Toast | null>(null)
  const counter = useRef(0)
  const [paused, setPaused] = useState(false)

  const close = useCallback((acted: boolean) => {
    const active = current.current
    current.current = null
    setToast(null)
    if (active && !acted) active.onDismiss?.()
  }, [])

  const show = useCallback<Feedback>((message, options = {}) => {
    const previous = current.current
    const next = { ...options, message, id: ++counter.current }
    current.current = next
    setToast(next)
    setPaused(false)
    previous?.onDismiss?.()
  }, [])

  useEffect(() => {
    if (!toast || paused) return
    const timer = window.setTimeout(() => close(false), toast.action ? ACTION_MS : PLAIN_MS)
    return () => window.clearTimeout(timer)
  }, [toast, paused, close])

  useEffect(() => () => { current.current?.onDismiss?.() }, [])

  return <FeedbackContext.Provider value={show}>
    {children}
    {toast && <div className={`toast${toast.tone === 'error' ? ' toast-error' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {toast.tone === 'error' ? <CircleAlert size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
      <span>{toast.message}</span>
      {toast.action && <button className="toast-action" type="button" onClick={() => {
        const action = toast.action
        close(true)
        action?.onAction()
      }}>{toast.action.label}</button>}
      <button className="icon-button" aria-label="Zamknij komunikat" onClick={() => close(false)}><X size={16} /></button>
    </div>}
  </FeedbackContext.Provider>
}

export function useFeedback() {
  const feedback = useContext(FeedbackContext)
  if (!feedback) throw new Error('FeedbackProvider is missing')
  return feedback
}

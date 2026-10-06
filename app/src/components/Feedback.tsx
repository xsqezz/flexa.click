import { createContext, useContext, useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'

const FeedbackContext = createContext<((message: string) => void) | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  return <FeedbackContext.Provider value={setMessage}>
    {children}
    {message && <div className="toast" role="status">
      <Check size={18} aria-hidden="true" /><span>{message}</span>
      <button className="icon-button" aria-label="Zamknij komunikat" onClick={() => setMessage(null)}><X size={16} /></button>
    </div>}
  </FeedbackContext.Provider>
}

export function useFeedback() {
  const feedback = useContext(FeedbackContext)
  if (!feedback) throw new Error('FeedbackProvider is missing')
  return feedback
}

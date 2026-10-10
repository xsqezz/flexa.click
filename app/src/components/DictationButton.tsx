import { Mic } from 'lucide-react'

/** Round microphone for search fields; renders nothing where the browser cannot dictate. */
export function DictationButton({ supported, listening, onToggle, label = 'Wyszukaj głosem' }: { supported: boolean; listening: boolean; onToggle: () => void; label?: string }) {
  if (!supported) return null
  return <button type="button" className={`icon-button dictation${listening ? ' listening' : ''}`} aria-pressed={listening}
    aria-label={listening ? 'Słucham… stuknij, aby zakończyć' : label} onClick={onToggle}><Mic size={18} aria-hidden="true" /></button>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { listenNatively, nativeSpeechSupported } from './native'

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean
  start(): void; stop(): void
  onresult: ((event: SpeechResult) => void) | null; onend: (() => void) | null; onerror: (() => void) | null
}

function speechApi(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

/** Joins what was already typed with the spoken text, within the field's length limit. */
export function joinSpoken(base: string, spoken: string, max: number, separator = ', '): string {
  return [base.trim(), spoken].filter(Boolean).join(separator).slice(0, max)
}

/**
 * Dictation in Polish: the browser's Web Speech API, or the system voice dialog inside the Android app (1.4.0+). `supported` is false
 * elsewhere (Firefox, older app versions), so callers simply do not show the microphone. `onSpoken` gets the text so far and whether it is final.
 */
export function useDictation(onSpoken: (spoken: string, base: string, final: boolean) => void, getBase: () => string = () => '') {
  const Speech = useMemo(speechApi, [])
  const native = Speech === null && nativeSpeechSupported()
  const [listening, setListening] = useState(false)
  const recognition = useRef<Recognition | null>(null)
  const handler = useRef(onSpoken)
  useEffect(() => { handler.current = onSpoken })
  useEffect(() => () => { recognition.current?.stop() }, [])

  function stop() { recognition.current?.stop() }

  function toggle() {
    if (listening) { stop(); return }
    if (!Speech) {
      if (!native) return
      const base = getBase()
      setListening(true)
      void listenNatively().then((spoken) => { if (spoken) handler.current(spoken, base, true) }).finally(() => setListening(false))
      return
    }
    const next = new Speech()
    next.lang = 'pl-PL'; next.interimResults = true; next.continuous = false
    const base = getBase()
    next.onresult = (event) => {
      const results = Array.from(event.results)
      const spoken = results.map((result) => result[0]?.transcript ?? '').join(' ').trim()
      handler.current(spoken, base, results.length > 0 && results.every((result) => result.isFinal))
    }
    next.onend = () => setListening(false)
    next.onerror = () => setListening(false)
    recognition.current = next
    setListening(true)
    try { next.start() } catch { setListening(false) }
  }

  return { supported: Speech !== null || native, listening, toggle, stop }
}

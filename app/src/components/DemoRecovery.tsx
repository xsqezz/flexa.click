import { useState } from 'react'
import { DEMO_KEY } from '../lib/demo'
import { useJournal } from '../lib/Journal'
import { Button, Confirm, Notice, errorMessage } from './ui'

export function DemoRecovery() {
  const journal = useJournal()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function backup() {
    setError(null)
    try {
      const raw = localStorage.getItem(DEMO_KEY)
      if (raw === null) throw new Error('Nie znaleziono lokalnego zapisu do pobrania.')
      const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'flexa-demo-uszkodzony-zapis.txt'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(errorMessage(cause)) }
  }

  return <section className="panel">
    <h1>Odzyskaj dostęp do demo</h1>
    <p style={{ marginTop: 16 }}>Nie nadpisaliśmy uszkodzonego zapisu. Najpierw możesz pobrać jego surową kopię. Wyzerowanie usuwa tylko lokalne dane demonstracyjne.</p>
    <div className="button-row">
      <Button variant="secondary" onClick={backup}>Pobierz surowy zapis demo</Button>
      <Button onClick={() => { setError(null); setConfirming(true) }}>Wyzeruj demo</Button>
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {confirming && <Confirm title="Wyzerować uszkodzone demo?" confirmLabel="Wyzeruj demo" cancelLabel="Zachowaj zapis"
      error={error} onClose={() => setConfirming(false)} onConfirm={() => {
        try {
          localStorage.removeItem(DEMO_KEY)
          setConfirming(false)
          journal.refresh()
        } catch (cause) { setError(errorMessage(cause)) }
      }}>Usuniemy lokalny zapis i odtworzymy przykładowy dziennik. Dane konta w chmurze pozostaną bez zmian.</Confirm>}
  </section>
}

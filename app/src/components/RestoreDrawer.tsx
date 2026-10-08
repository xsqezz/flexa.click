import { useMemo, useState } from 'react'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { importKindLabels, planImport, type Backup, type ImportKind, type ImportPayload } from '../lib/backup'
import { dateLabel } from '../lib/dates'
import { integerFormat } from '../lib/nutrition'
import { itemsLabel, plural } from '../lib/templates'
import { useFeedback } from './Feedback'
import { Button, Drawer, Notice, errorMessage } from './ui'

const kinds: ImportKind[] = ['meals', 'workouts', 'water', 'measurements', 'customFoods', 'mealTemplates']

export function RestoreDrawer({ backup, fileName, onClose }: { backup: Backup; fileName: string; onClose: () => void }) {
  const auth = useAuth()
  const { data, execute, refresh } = useJournal()
  const feedback = useFeedback()
  const [replaceProfile, setReplaceProfile] = useState(false)
  const [restorePlan, setRestorePlan] = useState(false)
  const [running, setRunning] = useState<ImportPayload | null>(null)
  const [progress, setProgress] = useState<{ saved: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const preview = useMemo(() => data ? planImport(data, backup.journal, { replaceProfile, restorePlan }) : null,
    [data, backup, replaceProfile, restorePlan])
  if (!preview) return null
  const busy = running !== null
  const exported = backup.exportedAt ? dateLabel(backup.exportedAt.slice(0, 10)) : null

  async function start() {
    if (!preview || preview.total === 0) return
    const payload = preview.payload
    setError(null); setRunning(payload); setProgress({ saved: 0, total: preview.total })
    try {
      await execute({ type: 'journal.import', value: payload, onProgress: (saved, total) => setProgress({ saved, total }) })
      feedback(`Przywrócono ${itemsLabel(preview.total)} z kopii. Nic nie zostało usunięte.`)
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
      refresh()
    } finally { setRunning(null) }
  }

  return <Drawer title="Przywróć z kopii" onClose={busy ? () => {} : onClose}>
    <p>
      Plik {fileName}{exported ? `, kopia z ${exported}` : ''}{backup.mode ? ` (${backup.mode === 'cloud' ? 'z konta' : 'z demo'})` : ''}.
      {' '}Nic nie usuwamy — dodamy tylko wpisy, których jeszcze nie masz.
      {auth.mode === 'demo' && ' W demo trafią wyłącznie do tej przeglądarki.'}
    </p>
    <div className="restore-table-wrap">
      <table className="restore-table">
        <caption className="sr-only">Zawartość kopii w porównaniu z Twoim dziennikiem</caption>
        <thead><tr><th scope="col">Rodzaj</th><th scope="col">W pliku</th><th scope="col">Nowe</th><th scope="col">Już masz</th></tr></thead>
        <tbody>{kinds.map((kind) => {
          const count = preview.counts[kind]
          return <tr key={kind}><th scope="row">{importKindLabels[kind]}</th>
            <td>{integerFormat.format(count.inFile)}</td><td><strong>{integerFormat.format(count.added)}</strong></td><td>{integerFormat.format(count.present)}</td></tr>
        })}</tbody>
      </table>
    </div>
    {preview.measurementConflicts > 0 && <Notice>
      {plural(preview.measurementConflicts, ['pomiar', 'pomiary', 'pomiarów'])} z kopii dotyczy dni, w których masz już inny pomiar. Zostawimy Twoje obecne wartości.
    </Notice>}
    <fieldset className="restore-options" disabled={busy}>
      <legend>Dodatkowo</legend>
      <label className="checkbox-label"><input type="checkbox" checked={replaceProfile} onChange={(event) => setReplaceProfile(event.target.checked)} />
        <span>Zastąp cele i profil wartościami z kopii (imię, energia, makroskładniki, woda, aktywność, docelowa masa).</span></label>
      {preview.hasPlan && <label className="checkbox-label"><input type="checkbox" checked={restorePlan} onChange={(event) => setRestorePlan(event.target.checked)} />
        <span>Przywróć plan treningowy z kopii. Zastąpi Twój obecny plan.</span></label>}
    </fieldset>
    {preview.planNote && <Notice>{preview.planNote}</Notice>}
    {progress && <div className="restore-progress">
      <progress max={progress.total} value={progress.saved} aria-label="Postęp przywracania" />
      <output aria-live="polite">Zapisano {integerFormat.format(progress.saved)} z {integerFormat.format(progress.total)}.</output>
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    {preview.total === 0 && !busy && <Notice tone="success">Wszystkie wpisy z tej kopii już są w Twoim dzienniku.</Notice>}
    <div className="button-row">
      <Button onClick={() => { void start() }} busy={busy} disabled={preview.total === 0}>Dodaj brakujące wpisy</Button>
      <Button variant="secondary" onClick={onClose} disabled={busy}>{preview.total === 0 ? 'Zamknij' : 'Anuluj'}</Button>
    </div>
  </Drawer>
}

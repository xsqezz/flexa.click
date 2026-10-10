import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Download, FileSpreadsheet, LogOut, ShieldCheck, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { profileSchema } from '../../../shared/domain'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { DEMO_KEY } from '../lib/demo'
import { callFunction } from '../lib/functions'
import { downloadCsv, downloadJournal } from '../lib/export'
import { parseBackup, type Backup } from '../lib/backup'
import { csvExports, csvFormatHint, type CsvExportKind } from '../lib/csv'
import { useFeedback } from '../components/Feedback'
import { AndroidAppPanel } from '../components/AndroidAppPanel'
import { RestoreDrawer } from '../components/RestoreDrawer'
import { PageHeader } from '../components/Workspace'
import { Button, Confirm, Drawer, Field, Notice, errorMessage } from '../components/ui'

const MAX_BACKUP_BYTES = 25 * 1024 * 1024

export function SettingsPage() {
  const { data, execute, pending, refresh } = useJournal()
  const auth = useAuth()
  const feedback = useFeedback()
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletionBusy, setDeletionBusy] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [restoring, setRestoring] = useState<{ backup: Backup; fileName: string } | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  if (!data) throw new Error('Journal data is unavailable')
  const journal = data
  const profile = data.profile
  async function readBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setDataError(null)
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Ten plik jest za duży (ponad 25 MB). Wybierz eksport JSON z Flexy.')
      setRestoring({ backup: parseBackup(await file.text()), fileName: file.name })
    } catch (cause) { setDataError(errorMessage(cause)) }
  }
  function exportCsv(kind: CsvExportKind) {
    setDataError(null)
    try { downloadCsv(journal, kind) }
    catch (cause) { setDataError(errorMessage(cause)) }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const parsed = profileSchema.safeParse({
      ...profile, displayName: values.get('name'), weeklyMinutesGoal: Number(values.get('minutes')),
    })
    if (!parsed.success) { setError('Sprawdź imię i cel aktywności (od 0 do 10 000 minut na tydzień).'); return }
    setError(null)
    try { await execute({ type: 'profile.save', value: parsed.data }); feedback('Ustawienia konta zostały zapisane.') }
    catch (cause) { setError(errorMessage(cause)) }
  }
  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setDeletionError(null); setDeletionBusy(true)
    let deleted = false
    try {
      const response = await callFunction('account-delete', {
        confirmation: String(values.get('confirmation')), password: String(values.get('password')),
      })
      z.object({ deleted: z.literal(true) }).parse(response)
      deleted = true
      await auth.signOut()
      feedback('Konto i powiązane dane zostały usunięte.')
    } catch (cause) {
      setDeletionError(deleted ? 'Konto zostało usunięte, ale nie potwierdzono wylogowania przeglądarki. Zamknij kartę i zaloguj się ponownie, aby sprawdzić stan.'
        : errorMessage(cause))
    } finally { setDeletionBusy(false) }
  }
  return <>
    <PageHeader title="Konto i ustawienia" description="Profil, kopie danych i konto." />
    {error && <Notice tone="error">{error}</Notice>}
    <div className="settings-grid">
      <section className="panel"><h2>Profil i aktywność</h2><p>Kalorie i makroskładniki ustawisz w <Link to="/goals">Celach</Link>.</p>
        <form className="form-stack" key={JSON.stringify(profile)} onSubmit={(event) => { void save(event) }}>
          <Field label="Imię lub pseudonim"><input name="name" required maxLength={60} defaultValue={profile.displayName} /></Field>
          <Field label="Aktywność (min / tydzień)" hint="Wpisz 0, jeśli nie chcesz ustawiać celu."><input name="minutes" type="number" min="0" max="10000" step="1" required defaultValue={profile.weeklyMinutesGoal} /></Field>
          <Button type="submit" busy={pending}>Zapisz ustawienia</Button>
        </form>
      </section>
      <div>
        <section className="panel"><h2>Twoje dane są Twoje</h2><p><ShieldCheck size={17} aria-hidden="true" /> {auth.mode === 'demo' ? 'Demo jest przechowywane lokalnie. Nie ma konta ani synchronizacji.' : 'Wpisy są przypisane do Twojego konta. Baza izoluje je od innych użytkowników.'}</p>
          <div className="button-row"><Button variant="secondary" onClick={() => {
            try { downloadJournal(data, auth.mode === 'demo' ? 'demo' : 'cloud') }
            catch (cause) { setError(errorMessage(cause)) }
          }}><Download size={17} aria-hidden="true" />Eksportuj dane JSON</Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()}><Upload size={17} aria-hidden="true" />Przywróć z kopii</Button>
            <input ref={fileInput} className="sr-only" type="file" accept=".json,application/json" tabIndex={-1} aria-hidden="true"
              onChange={(event) => { void readBackup(event) }} /></div>
          <p className="source-credit">Kopia JSON zawiera cały dziennik, produkty, zestawy, cykle i plan. Przywracanie domyślnie tylko dodaje brakujące wpisy.</p>
          {dataError && <Notice tone="error">{dataError}</Notice>}
          <div className="data-csv">
            <h3><FileSpreadsheet size={17} aria-hidden="true" />Eksport do arkusza (CSV)</h3>
            <div className="button-row">{(Object.keys(csvExports) as CsvExportKind[]).map((kind) => <Button key={kind} variant="secondary" onClick={() => exportCsv(kind)}
              aria-label={`Eksportuj CSV: ${csvExports[kind].label}`}>{csvExports[kind].label}</Button>)}</div>
            <p className="source-credit">{csvFormatHint}</p>
          </div>
          <div className="button-row"><Button variant="ghost" onClick={() => { void auth.signOut().catch((cause: unknown) => setError(errorMessage(cause))) }}><LogOut size={16} aria-hidden="true" />{auth.mode === 'demo' ? 'Wyjdź z demo' : 'Wyloguj się'}</Button></div>
          <div className="danger-zone">
            <h3>{auth.mode === 'demo' ? 'Zacznij demo od nowa' : 'Usunięcie konta'}</h3>
            <p>{auth.mode === 'demo' ? 'Usuniesz wyłącznie przykładowe dane w tej przeglądarce. Dane konta nie zostaną naruszone.' : 'Nieodwracalnie usuniesz konto, cele i cykle, posiłki, własne produkty, zestawy, aktywności, wodę, pomiary i plan treningowy. Najpierw możesz zrobić eksport.'}</p>
            <div className="button-row"><Button variant="secondary" onClick={() => {
              setDeletionError(null)
              if (auth.mode === 'demo') setResetting(true)
              else setDeleting(true)
            }}>{auth.mode === 'demo' ? 'Wyzeruj demo' : 'Usuń konto i dane'}</Button></div>
          </div>
        </section>
        <AndroidAppPanel />
        <p className="source-credit">Import GPX/TCX działa lokalnie, bez zewnętrznych kont. <Link className="text-link" to="/sources">Źródła, licencje i ograniczenia</Link></p>
      </div>
    </div>
    {resetting && <Confirm title="Wyzerować demo?" confirmLabel="Wyzeruj demo" cancelLabel="Zachowaj dane" error={deletionError}
      onClose={() => setResetting(false)} onConfirm={() => {
        try { localStorage.removeItem(DEMO_KEY); refresh(); setResetting(false); feedback('Demo zaczyna się od nowa.') }
        catch (cause) { setDeletionError(errorMessage(cause)) }
      }}>Lokalne zmiany demonstracyjne zostaną usunięte i zastąpione przykładowym dziennikiem.</Confirm>}
    {deleting && <Drawer title="Usuń konto i dane" onClose={deletionBusy ? () => {} : () => setDeleting(false)}>
      <p>Ta operacja jest nieodwracalna. Podaj aktualne hasło i wpisz dokładnie USUŃ KONTO.</p>
      {deletionError && <Notice tone="error">{deletionError}</Notice>}
      <form className="form-stack" onSubmit={(event) => { void deleteAccount(event) }}>
        <Field label="Aktualne hasło"><input name="password" type="password" autoComplete="current-password" required maxLength={256} /></Field>
        <Field label="Potwierdzenie: USUŃ KONTO"><input name="confirmation" required pattern="USUŃ KONTO" autoComplete="off" /></Field>
        <Button variant="danger" type="submit" busy={deletionBusy}>Nieodwracalnie usuń konto</Button>
      </form>
    </Drawer>}
    {restoring && <RestoreDrawer backup={restoring.backup} fileName={restoring.fileName} onClose={() => setRestoring(null)} />}
  </>
}

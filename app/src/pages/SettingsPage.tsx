import { useState, type FormEvent } from 'react'
import { Download, LogOut, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { profileSchema } from '../../../shared/domain'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { DEMO_KEY } from '../lib/demo'
import { callFunction } from '../lib/functions'
import { downloadJournal } from '../lib/export'
import { useFeedback } from '../components/Feedback'
import { PageHeader } from '../components/Workspace'
import { Button, Confirm, Drawer, Field, Notice, errorMessage } from '../components/ui'

export function SettingsPage() {
  const { data, execute, pending, refresh } = useJournal()
  const auth = useAuth()
  const feedback = useFeedback()
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletionBusy, setDeletionBusy] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  if (!data) throw new Error('Journal data is unavailable')
  const profile = data.profile
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const parsed = profileSchema.safeParse({
      displayName: values.get('name'), calorieGoal: Number(values.get('calories')),
      proteinGoal: Number(values.get('protein')), carbsGoal: Number(values.get('carbs')),
      fatGoal: Number(values.get('fat')), waterGoal: Number(values.get('water')),
      weeklyMinutesGoal: Number(values.get('minutes')),
      targetWeight: String(values.get('weight') ?? '').trim() ? Number(values.get('weight')) : null,
    })
    if (!parsed.success) { setError('Sprawdź wpisane cele. Wartości muszą być dodatnie lub zero tam, gdzie cel jest opcjonalny.'); return }
    setError(null)
    try { await execute({ type: 'profile.save', value: parsed.data }); feedback('Twoje cele zostały zapisane.') }
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
    <PageHeader title="Cele i konto" description="Dopasuj dziennik do siebie. Ty wybierasz kierunek." primary="none" />
    {error && <Notice tone="error">{error}</Notice>}
    <div className="settings-grid">
      <section className="panel"><h2>Twój profil i codzienne cele</h2><p>Domyślne wartości są punktem startowym interfejsu, nie indywidualną poradą. W razie potrzeb zdrowotnych skonsultuj cele ze specjalistą.</p>
        <form className="form-stack" onSubmit={(event) => { void save(event) }}>
          <Field label="Imię lub pseudonim"><input name="name" required maxLength={60} defaultValue={profile.displayName} /></Field>
          <div className="form-grid">
            <Field label="Energia (kcal / dzień)"><input name="calories" type="number" min="500" max="10000" step="1" required defaultValue={profile.calorieGoal} /></Field>
            <Field label="Woda (ml / dzień)"><input name="water" type="number" min="500" max="6000" step="1" required defaultValue={profile.waterGoal} /></Field>
            <Field label="Białko (g)"><input name="protein" type="number" min="0" max="500" step="0.1" required defaultValue={profile.proteinGoal} /></Field>
            <Field label="Węglowodany (g)"><input name="carbs" type="number" min="0" max="1000" step="0.1" required defaultValue={profile.carbsGoal} /></Field>
            <Field label="Tłuszcze (g)"><input name="fat" type="number" min="0" max="500" step="0.1" required defaultValue={profile.fatGoal} /></Field>
            <Field label="Aktywność (min / tydzień)" hint="Wpisz 0, jeśli nie chcesz ustawiać celu."><input name="minutes" type="number" min="0" max="10000" step="1" required defaultValue={profile.weeklyMinutesGoal} /></Field>
            <Field label="Docelowa masa (kg)" hint="Opcjonalnie. Bez automatycznej prognozy ani zaleceń."><input name="weight" type="number" min="20" max="500" step="0.1" defaultValue={profile.targetWeight ?? ''} /></Field>
          </div>
          <Button type="submit" busy={pending}>Zapisz cele</Button>
        </form>
      </section>
      <div>
        <section className="panel"><h2>Twoje dane są Twoje</h2><p><ShieldCheck size={17} aria-hidden="true" /> {auth.mode === 'demo' ? 'Demo jest przechowywane lokalnie. Nie ma konta ani synchronizacji.' : 'Wpisy są przypisane do Twojego konta. Baza izoluje je od innych użytkowników.'}</p>
          <div className="button-row"><Button variant="secondary" onClick={() => {
            try { downloadJournal(data, auth.mode === 'demo' ? 'demo' : 'cloud') }
            catch (cause) { setError(errorMessage(cause)) }
          }}><Download size={17} aria-hidden="true" />Eksportuj dane JSON</Button></div>
          <p className="source-credit">Eksport zawiera pełne załadowane wpisy, produkty, pomiary i cele. Trzymaj ten plik w bezpiecznym miejscu.</p>
          <div className="button-row"><Button variant="ghost" onClick={() => { void auth.signOut().catch((cause: unknown) => setError(errorMessage(cause))) }}><LogOut size={16} aria-hidden="true" />{auth.mode === 'demo' ? 'Wyjdź z demo' : 'Wyloguj się'}</Button></div>
          <div className="danger-zone">
            <h3>{auth.mode === 'demo' ? 'Zacznij demo od nowa' : 'Usunięcie konta'}</h3>
            <p>{auth.mode === 'demo' ? 'Usuniesz wyłącznie przykładowe dane w tej przeglądarce. Dane konta nie zostaną naruszone.' : 'Nieodwracalnie usuniesz konto, posiłki, własne produkty, aktywności, wodę i pomiary. Najpierw możesz zrobić eksport.'}</p>
            <div className="button-row"><Button variant="secondary" onClick={() => {
              setDeletionError(null)
              if (auth.mode === 'demo') setResetting(true)
              else setDeleting(true)
            }}>{auth.mode === 'demo' ? 'Wyzeruj demo' : 'Usuń konto i dane'}</Button></div>
          </div>
        </section>
        <section className="panel"><h2>Integracje bez niespodzianek</h2><p>Import GPX/TCX jest niezależny od zewnętrznych kont. API Stravy wymaga osobnej akceptacji jej zasad — nie jest włączone.</p>
          <p style={{ marginTop: 12 }}>Apple Health i Health Connect wymagają aplikacji natywnej. Nie udajemy, że strona internetowa synchronizuje te dane.</p>
          <div className="button-row"><Link className="text-link" to="/sources">Źródła, licencje i ograniczenia</Link></div>
        </section>
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
  </>
}

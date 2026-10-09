import { useEffect, useId, useState, type FormEvent } from 'react'
import { BellRing, Download, RefreshCw, Settings2, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { weekdayNames, weekdayShort } from '../../../shared/training'
import { useJournal } from '../lib/Journal'
import {
  ANDROID_APK_URL, androidAppVersion, checkAppUpdate, getReminders, mealRemindersSupported, openNotificationSettings, remindersSupported, setReminders,
  type NotificationPermission, type ReminderSettings,
} from '../lib/native'
import { sessionShortName } from '../lib/training/format'
import { useFeedback } from './Feedback'
import { Button, Field, Notice, errorMessage } from './ui'

/** In the Android app: current version, a manual update check and reminders. In a browser: how to install the app. */
export function AndroidAppPanel() {
  const version = androidAppVersion()
  if (version) {
    const reminders = remindersSupported()
    return <>
      <section className="panel"><h2>Aplikacja na Androida</h2>
        <p><Smartphone size={17} aria-hidden="true" /> Korzystasz z aplikacji Flexa na Androida, wersja {version}.</p>
        <p>Aplikacja sprawdza aktualizacje przy każdym uruchomieniu i sama proponuje instalację. Zmiany w samym dzienniku widać od razu, bez instalowania.</p>
        {!reminders && <p><BellRing size={17} aria-hidden="true" /> Zaktualizuj aplikację, aby włączyć przypomnienia o treningu i wodzie.</p>}
        <div className="button-row"><Button variant="secondary" onClick={() => { checkAppUpdate() }}><RefreshCw size={17} aria-hidden="true" />Sprawdź aktualizacje</Button></div>
      </section>
      {reminders && <RemindersPanel />}
    </>
  }
  return <section className="panel"><h2>Aplikacja na Androida</h2>
    <p>Zainstaluj Flexa na telefonie jak zwykłą aplikację. Aktualizuje się sama: gdy pojawi się nowa wersja, zobaczysz propozycję instalacji.</p>
    <ol className="app-steps">
      <li>Pobierz plik APK.</li>
      <li>Gdy Android zapyta, zezwól przeglądarce na instalację z tego źródła.</li>
      <li>Otwórz pobrany plik i dotknij „Zainstaluj”.</li>
    </ol>
    <div className="button-row"><a className="button button-secondary" href={ANDROID_APK_URL} rel="noopener"><Download size={17} aria-hidden="true" />Pobierz Flexa (APK)</a></div>
    <p className="source-credit">Wymaga Androida 8.0 lub nowszego. Plik jest podpisany kluczem Flexa; odcisk certyfikatu znajdziesz na stronie <Link to="/sources">Źródła i licencje</Link>.</p>
  </section>
}

const intervals = [
  { value: 1, label: 'co godzinę' }, { value: 2, label: 'co 2 godziny' },
  { value: 3, label: 'co 3 godziny' }, { value: 4, label: 'co 4 godziny' },
] as const

const defaultMeals = { enabled: false, times: ['08:30', '13:30', '19:00'] }
const defaults: ReminderSettings = {
  training: { enabled: false, time: '18:00', weekdays: [] },
  water: { enabled: false, from: '09:00', to: '21:00', everyHours: 2 },
  meals: defaultMeals,
}

const mealSlotLabels = ['Śniadanie', 'Obiad', 'Kolacja'] as const

const sameDays = (a: readonly number[], b: readonly number[]) => a.length === b.length && [...a].sort().every((day, index) => day === [...b].sort()[index])
const settingsOf = ({ training, water, meals }: ReminderSettings): ReminderSettings => ({ training, water, meals: meals ?? defaultMeals })

/** Opt-in reminders shown as Android notifications. Settings live in the app on this phone, not in the journal. */
function RemindersPanel() {
  const { data } = useJournal()
  const feedback = useFeedback()
  const headingId = useId()
  const daysId = useId()
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [form, setForm] = useState<ReminderSettings>(defaults)
  const [stored, setStored] = useState<ReminderSettings | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const mealsAvailable = mealRemindersSupported()
  const plan = data?.training.plan ?? null
  const planDays = plan ? plan.sessions.map((session) => session.weekday).sort((a, b) => a - b) : null

  useEffect(() => {
    let active = true
    void getReminders().then((state) => {
      if (!active) return
      if (!state) { setStatus('unavailable'); return }
      const settings = settingsOf(state)
      setForm(settings); setStored(settings); setPermission(state.permission); setStatus('ready')
    })
    return () => { active = false }
  }, [attempt])

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'visible') return
      void getReminders().then((state) => { if (state) setPermission(state.permission) })
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  function update<K extends keyof ReminderSettings>(key: K, value: Partial<ReminderSettings[K]>) {
    setForm((current) => ({ ...current, [key]: { ...(current[key] ?? defaults[key]), ...value } }))
  }

  function toggleDay(day: number) {
    const days = form.training.weekdays
    update('training', { weekdays: days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort((a, b) => a - b) })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const training: ReminderSettings['training'] = plan && planDays
      ? {
          enabled: form.training.enabled, time: form.training.time, weekdays: planDays,
          sessions: plan.sessions.map((session, index) => ({
            weekday: session.weekday, name: `Dzień ${index + 1}: ${sessionShortName(session.kind)}`,
            minutes: Math.min(600, Math.max(1, Math.round(session.minutes))),
          })),
        }
      : { enabled: form.training.enabled, time: form.training.time, weekdays: form.training.weekdays }
    if (training.enabled && training.weekdays.length === 0) { setError('Wybierz co najmniej jeden dzień treningowy.'); return }
    if (form.water.enabled && form.water.from >= form.water.to) { setError('Godzina „do” musi być późniejsza niż godzina „od”.'); return }
    const meals = form.meals ?? defaultMeals
    if (mealsAvailable && meals.enabled && meals.times.some((time, index) => index > 0 && meals.times[index - 1]! >= time)) {
      setError('Godziny przypomnień o posiłkach muszą rosnąć: śniadanie, obiad, kolacja.'); return
    }
    setError(null); setBusy(true)
    try {
      const state = await setReminders({ training, water: form.water, ...(mealsAvailable ? { meals } : {}) })
      const settings = settingsOf(state)
      setStored(settings); setPermission(state.permission)
      if (!settings.training.enabled && !settings.water.enabled && !settings.meals?.enabled) feedback('Przypomnienia są wyłączone.')
      else if (state.permission === 'granted') feedback('Przypomnienia zapisane. Pojawią się jako powiadomienia Flexa.')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  const anyEnabled = Boolean(stored && (stored.training.enabled || stored.water.enabled || stored.meals?.enabled))
  const planChanged = Boolean(stored?.training.enabled && planDays && !sameDays(stored.training.weekdays, planDays))

  return <section className="panel" aria-labelledby={headingId}><h2 id={headingId}>Przypomnienia</h2>
    <p>Delikatne powiadomienia w telefonie. Włączasz je, kiedy chcesz, i w każdej chwili wyłączasz.</p>
    {status === 'loading' && <Notice>Wczytuję ustawienia przypomnień…</Notice>}
    {status === 'unavailable' && <>
      <Notice tone="error">Nie udało się odczytać przypomnień z aplikacji. Spróbuj ponownie.</Notice>
      <div className="button-row"><Button variant="secondary" onClick={() => { setStatus('loading'); setAttempt((value) => value + 1) }}>Spróbuj ponownie</Button></div>
    </>}
    {status === 'ready' && <form className="reminder-form" onSubmit={(event) => { void save(event) }} noValidate>
      <div className="reminder-group">
        <label className="checkbox-label"><input type="checkbox" checked={form.training.enabled}
          onChange={(event) => update('training', { enabled: event.target.checked })} />
          <span><strong>Przypomnienie o treningu</strong><br />W dni treningowe, o wybranej godzinie.</span></label>
        {form.training.enabled && <>
          <Field label="Godzina przypomnienia"><input type="time" step={60} required value={form.training.time}
            onChange={(event) => update('training', { time: event.target.value })} /></Field>
          {planDays ? <p className="reminder-days">Dni z Twojego planu: {planDays.map((day) => weekdayNames[day]).join(', ')}.</p>
            : <div>
              <p className="reminder-days" id={daysId}>Nie masz jeszcze planu treningowego. Wybierz dni przypomnień:</p>
              <fieldset className="weekday-picker" aria-labelledby={daysId}>
                {weekdayShort.map((label, day) => <button type="button" key={label} aria-pressed={form.training.weekdays.includes(day)}
                  aria-label={weekdayNames[day]} onClick={() => toggleDay(day)}>{label}</button>)}
              </fieldset>
            </div>}
          {planChanged && <Notice>Twój plan ma teraz inne dni treningowe. Zapisz przypomnienia, żeby pojawiały się w nowe dni.</Notice>}
        </>}
      </div>
      <div className="reminder-group">
        <label className="checkbox-label"><input type="checkbox" checked={form.water.enabled}
          onChange={(event) => update('water', { enabled: event.target.checked })} />
          <span><strong>Przypomnienie o wodzie</strong><br />Co kilka godzin w wybranych godzinach dnia.</span></label>
        {form.water.enabled && <>
          <div className="form-grid">
            <Field label="Od godziny"><input type="time" step={60} required value={form.water.from}
              onChange={(event) => update('water', { from: event.target.value })} /></Field>
            <Field label="Do godziny"><input type="time" step={60} required value={form.water.to}
              onChange={(event) => update('water', { to: event.target.value })} /></Field>
          </div>
          <Field label="Jak często"><select value={form.water.everyHours}
            onChange={(event) => update('water', { everyHours: Number(event.target.value) })}>
            {intervals.map((interval) => <option key={interval.value} value={interval.value}>{interval.label}</option>)}
          </select></Field>
        </>}
      </div>
      {mealsAvailable ? <div className="reminder-group">
        <label className="checkbox-label"><input type="checkbox" checked={form.meals?.enabled ?? false}
          onChange={(event) => update('meals', { enabled: event.target.checked })} />
          <span><strong>Przypomnienie o posiłkach</strong><br />O wybranych porach dnia, żeby zapisać jedzenie.</span></label>
        {form.meals?.enabled && <div className="form-grid">
          {mealSlotLabels.map((label, index) => <Field key={label} label={label}><input type="time" step={60} required
            value={form.meals?.times[index] ?? defaultMeals.times[index]}
            onChange={(event) => update('meals', { times: mealSlotLabels.map((_, slot) => slot === index ? event.target.value : form.meals?.times[slot] ?? defaultMeals.times[slot]!) })} /></Field>)}
        </div>}
      </div> : <p className="reminder-days"><BellRing size={17} aria-hidden="true" /> Zaktualizuj aplikację do wersji 1.2.0, aby włączyć przypomnienia o posiłkach.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {anyEnabled && permission === 'denied' && <Notice tone="error">
        <p>Android blokuje powiadomienia Flexa, więc przypomnienia się nie pojawią. Włącz je w ustawieniach telefonu: Ustawienia → Aplikacje → Flexa → Powiadomienia.</p>
        <div className="button-row"><Button type="button" variant="secondary" onClick={() => { openNotificationSettings() }}><Settings2 size={17} aria-hidden="true" />Otwórz ustawienia powiadomień</Button></div>
      </Notice>}
      <div className="button-row"><Button type="submit" busy={busy}>Zapisz przypomnienia</Button></div>
      <p className="source-credit">Ustawienia przypomnień zostają w tym telefonie i nie trafiają na serwer. Gdy zmienisz plan treningowy, zapisz je ponownie.</p>
    </form>}
  </section>
}

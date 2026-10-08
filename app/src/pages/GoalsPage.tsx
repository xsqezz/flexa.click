import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Calculator, ChevronRight, Droplets, Scale } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  goalCycleInputSchema, type GoalCycle, type GoalCycleInput, type Journal,
} from '../../../shared/domain'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { activityLevels, energyInputProblem, estimateEnergy, type ActivityLevel, type EnergyEstimate, type Sex } from '../lib/energy'
import { dateLabel, daysEndingAt, today } from '../lib/dates'
import { currentWeight, cycleNames, effectiveCycle, goalForDay, validateCycleStart } from '../lib/goals'
import { integerFormat, numberFormat, nutritionTotal } from '../lib/nutrition'
import { useFeedback } from '../components/Feedback'
import { rememberGoalsReviewed } from '../components/FirstSteps'
import { NutritionSummary, WaterPanel } from '../components/Summaries'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { ChipChoice, ChoiceList } from '../components/WizardFields'
import { Brand, Button, Field, Notice, Skeleton, errorMessage } from '../components/ui'

type Kind = GoalCycle['kind']
type Draft = {
  kind: Kind; startDate: string; endDate: string; startWeight: string; targetWeight: string
  calories: string; protein: string; carbs: string; fat: string; water: string
  age: string; sex: Sex | null; height: string; activity: ActivityLevel | null
}

const decimal = (value: string): number => value.trim() === '' ? Number.NaN : Number(value.replace(',', '.'))
const phases: { value: Kind; title: string; description: string }[] = [
  { value: 'reduction', title: 'Redukcja', description: 'Wybierasz łagodny deficyt. Bez automatycznego przełączania cykli.' },
  { value: 'maintenance', title: 'Utrzymanie', description: 'Utrzymujesz dotychczasowy kierunek i obserwujesz zmiany.' },
  { value: 'muscle_gain', title: 'Budowa mięśni', description: 'Możesz wybrać umiarkowaną nadwyżkę energii.' },
  { value: 'manual', title: 'Własny cel', description: 'Wpisujesz wszystkie wartości samodzielnie, bez sugestii.' },
]

function initialDraft(journal: Journal): Draft {
  const answers = journal.training.plan?.answers
  const age = answers?.age ?? null
  const kind: Kind = age !== null && age < 18 ? 'manual'
    : answers?.goal === 'fat-loss' ? 'reduction' : answers?.goal === 'muscle' ? 'muscle_gain' : 'manual'
  return {
    kind, startDate: today(), endDate: '', startWeight: String(currentWeight(journal) ?? ''),
    targetWeight: String(journal.profile.targetWeight ?? ''), calories: String(journal.profile.calorieGoal),
    protein: String(journal.profile.proteinGoal), carbs: String(journal.profile.carbsGoal),
    fat: String(journal.profile.fatGoal), water: String(journal.profile.waterGoal),
    age: String(age ?? ''), sex: answers?.sex === 'female' || answers?.sex === 'male' ? answers.sex : null,
    height: '', activity: null,
  }
}

function CycleForm({ journal, onboarding }: { journal: Journal; onboarding: boolean }) {
  const { execute, pending } = useJournal()
  const auth = useAuth()
  const feedback = useFeedback()
  const navigate = useNavigate()
  const kindId = useId()
  const activityId = useId()
  const sexId = useId()
  const [draft, setDraft] = useState(() => initialDraft(journal))
  const [estimate, setEstimate] = useState<EnergyEstimate | null>(null)
  const [showEstimate, setShowEstimate] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attempt = useRef<{ input: string; id: string } | null>(null)
  const hasAnswers = Boolean(journal.training.plan)
  const age = decimal(draft.age)
  const minor = Number.isFinite(age) && age < 18
  const estimateAllowed = Number.isFinite(age) && age >= 18 && age <= 100

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setEstimate(null)
    setConfirmed(false)
    setError(null)
  }

  function setAge(value: string) {
    const next = decimal(value)
    update({ age: value, ...(Number.isFinite(next) && next < 18 ? { kind: 'manual' as const } : {}) })
  }

  function calculate() {
    const input = {
      sex: draft.sex ?? undefined, age, heightCm: decimal(draft.height),
      weightKg: decimal(draft.startWeight), activity: draft.activity ?? undefined,
      goal: draft.kind === 'reduction' ? 'lose' as const : draft.kind === 'muscle_gain' ? 'gain' as const : 'maintain' as const,
    }
    const problem = energyInputProblem(input)
    if (problem) { setError(problem); setEstimate(null); return }
    if (!input.sex || !input.activity) { setError('Wybierz płeć używaną we wzorze i poziom aktywności.'); return }
    setEstimate(estimateEnergy({ ...input, sex: input.sex, activity: input.activity }))
    setError(null)
  }

  function applyEstimate() {
    if (!estimate) return
    update({
      calories: String(estimate.calories), protein: String(estimate.protein),
      carbs: String(estimate.carbs), fat: String(estimate.fat), water: String(estimate.water),
    })
    feedback('Propozycja przeniesiona do formularza. Sprawdź liczby i zatwierdź cykl.')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!Number.isInteger(age) || age < (auth.mode === 'demo' ? 16 : 18) || age > 100) {
      setError(auth.mode === 'demo' ? 'Podaj wiek od 16 do 100 lat.' : 'Podaj wiek od 18 do 100 lat.')
      return
    }
    if (minor && draft.kind !== 'manual') { setError('Osoby poniżej 18 lat mogą ustalać tylko cele ręcznie.'); return }
    if (!confirmed) { setError('Zaznacz potwierdzenie, aby zapisać wybrane cele.'); return }
    const proposed = goalCycleInputSchema.safeParse({
      kind: draft.kind, startDate: draft.startDate, endDate: draft.endDate,
      startWeightKg: decimal(draft.startWeight), targetWeightKg: draft.targetWeight.trim() ? decimal(draft.targetWeight) : null,
      calorieGoal: decimal(draft.calories), proteinGoal: decimal(draft.protein),
      carbsGoal: decimal(draft.carbs), fatGoal: decimal(draft.fat), waterGoal: decimal(draft.water),
    })
    if (!proposed.success) {
      setError('Sprawdź daty, wagę i cele. Koniec cyklu musi przypadać po jego początku, a wszystkie wartości muszą mieścić się w zakresie pól.')
      return
    }
    let value: GoalCycleInput
    try { value = validateCycleStart(proposed.data, journal) }
    catch (cause) { setError(errorMessage(cause)); return }
    const key = JSON.stringify(value)
    if (attempt.current?.input !== key) attempt.current = { input: key, id: crypto.randomUUID() }
    setError(null)
    try {
      await execute({ type: 'goals.start', id: attempt.current.id, value })
      feedback('Cele zostały zatwierdzone. Nowy cykl jest aktywny.')
      navigate('/goals', { replace: onboarding })
    } catch (cause) { setError(errorMessage(cause)) }
  }

  return <form className="goals-form" onSubmit={(event) => { void submit(event) }} noValidate>
    <section className="panel goals-form-section">
      <h2>Wybierz kierunek i daty</h2>
      <p>Ty decydujesz, kiedy cykl się kończy. Po tej dacie zatwierdzone cele zostaną bez zmian, aż rozpoczniesz następny.</p>
      {!hasAnswers && <Field label="Wiek (lata)" hint="Potrzebny do doboru dostępnych opcji; nie zapisujemy go osobno.">
        <input type="number" inputMode="numeric" min={auth.mode === 'demo' ? 16 : 18} max="100" required value={draft.age}
          onChange={(event) => setAge(event.target.value)} /></Field>}
      {minor && <Notice>Osoby w wieku 16–17 lat mogą wpisywać cele tylko ręcznie. Nie sugerujemy redukcji ani budowania masy. Ustal potrzeby żywieniowe z opiekunem i specjalistą.</Notice>}
      {!hasAnswers && !Number.isFinite(age) && <p className="goals-help">Po podaniu wieku pokażemy dostępne rodzaje cykli.</p>}
      <h3 id={kindId} className="energy-label">Rodzaj cyklu</h3>
      <ChoiceList name="cycle-kind" labelledBy={kindId} value={draft.kind} onChange={(kind) => update({ kind })}
        options={estimateAllowed ? phases : phases.filter((phase) => phase.value === 'manual')} />
      <div className="form-grid">
        <Field label="Początek" hint="Możesz wpisać wcześniejszą datę, nie późniejszą niż dziś.">
          <input type="date" min="1900-01-01" max={today()} required value={draft.startDate} onChange={(event) => {
            const measurement = journal.measurements.find((item) => item.date === event.target.value)
            update({ startDate: event.target.value, ...(measurement ? { startWeight: String(measurement.weightKg) } : {}) })
          }} /></Field>
        <Field label="Koniec" hint="Wybierz datę, bez narzuconej długości cyklu.">
          <input type="date" min={draft.startDate || today()} max="2100-12-31" required value={draft.endDate}
            onChange={(event) => update({ endDate: event.target.value })} /></Field>
        <Field label="Masa na początku (kg)" hint="Zapiszemy pomiar dla daty początku, nie nadpiszemy innej wartości.">
          <input type="number" inputMode="decimal" min="20" max="500" step="0.1" required value={draft.startWeight}
            onChange={(event) => update({ startWeight: event.target.value })} /></Field>
        <Field label="Masa docelowa (kg)" hint="Opcjonalna; możesz ją później zmienić w Celach.">
          <input type="number" inputMode="decimal" min="20" max="500" step="0.1" value={draft.targetWeight}
            onChange={(event) => update({ targetWeight: event.target.value })} /></Field>
      </div>
    </section>
    <section className="panel goals-form-section">
      <h2>Dzienne cele</h2>
      <p>Punktem wyjścia są obecne wartości profilu. Możesz je wpisać samodzielnie lub, jako osoba dorosła, policzyć orientacyjną propozycję.</p>
      {estimateAllowed && draft.kind !== 'manual' && <div className="goals-estimator">
        <Button type="button" variant="ghost" aria-expanded={showEstimate} onClick={() => { setShowEstimate(!showEstimate); setError(null) }}>
          <Calculator size={17} aria-hidden="true" />{showEstimate ? 'Ukryj kalkulator' : 'Oblicz propozycję'}
        </Button>
        {showEstimate && <div className="goals-estimator-fields">
          <p>Wzór Mifflina–St Jeora. Wiek i płeć z ankiety użyjemy ponownie, jeśli je podano. Wzrost i aktywność nie są zapisywane.</p>
          {hasAnswers && <p><strong>{draft.age} lat</strong> z ankiety treningowej</p>}
          <h3 id={sexId} className="energy-label">Płeć używana wyłącznie we wzorze</h3>
          <ChipChoice name="formula-sex" labelledBy={sexId} value={draft.sex} onChange={(sex) => update({ sex })}
            options={[{ value: 'female', label: 'Kobieta' }, { value: 'male', label: 'Mężczyzna' }]} />
          <Field label="Wzrost (cm)"><input type="number" inputMode="decimal" min="120" max="230" step="0.1"
            value={draft.height} onChange={(event) => update({ height: event.target.value })} /></Field>
          <h3 id={activityId} className="energy-label">Codzienna aktywność</h3>
          <ChoiceList name="energy-activity" labelledBy={activityId} value={draft.activity}
            onChange={(activity) => update({ activity })}
            options={activityLevels.map((level) => ({ value: level.id, title: level.label, description: level.description }))} />
          <Button type="button" variant="secondary" onClick={calculate}>Policz orientacyjnie</Button>
          {estimate && <output className="goals-proposal">
            <strong>{integerFormat.format(estimate.calories)} kcal / dzień</strong>
            <span>Utrzymanie ok. {integerFormat.format(estimate.maintenance)} kcal · białko {estimate.protein} g · tłuszcze {estimate.fat} g · węglowodany {estimate.carbs} g · woda {estimate.water} ml</span>
            <Button type="button" onClick={applyEstimate}>Przenieś propozycję do pól</Button>
          </output>}
          <p className="source-credit">Szacunek może odbiegać od rzeczywistych potrzeb. Choroby, leki, ciąża i karmienie wymagają indywidualnego ustalenia celów ze specjalistą.</p>
        </div>}
      </div>}
      <div className="form-grid goals-values">
        <Field label="Energia (kcal / dzień)"><input type="number" min="500" max="10000" step="1" required value={draft.calories}
          onChange={(event) => update({ calories: event.target.value })} /></Field>
        <Field label="Woda (ml / dzień)"><input type="number" min="500" max="6000" step="1" required value={draft.water}
          onChange={(event) => update({ water: event.target.value })} /></Field>
        <Field label="Białko (g)"><input type="number" min="0" max="500" step="0.1" required value={draft.protein}
          onChange={(event) => update({ protein: event.target.value })} /></Field>
        <Field label="Węglowodany (g)"><input type="number" min="0" max="1000" step="0.1" required value={draft.carbs}
          onChange={(event) => update({ carbs: event.target.value })} /></Field>
        <Field label="Tłuszcze (g)"><input type="number" min="0" max="500" step="0.1" required value={draft.fat}
          onChange={(event) => update({ fat: event.target.value })} /></Field>
      </div>
    </section>
    <section className="panel goals-confirm">
      <h2>Potwierdź swój wybór</h2>
      <p>Zapisywane wartości nie zmienią się automatycznie z kolejną fazą. Treningi nie dodają kalorii do dziennego celu.</p>
      <label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); setError(null) }} />
        <span>Sprawdziłem(-am) daty, wagę oraz kcal, makroskładniki i wodę. Zatwierdzam te cele na bieżący cykl.</span></label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <Button type="submit" busy={pending}>Zatwierdź cele i rozpocznij cykl <ArrowRight size={17} aria-hidden="true" /></Button>
        {!onboarding && <Link to="/goals" className="button button-secondary">Wróć bez zmian</Link>}
      </div>
      <p className="source-credit">Flexa nie zastępuje porady medycznej ani dietetycznej. W razie wątpliwości omów cele ze specjalistą.</p>
    </section>
  </form>
}

export function GoalsSetupPage() {
  const { data, execute, pending, loading, error: loadError, refresh } = useJournal()
  const auth = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  if (loading) return <main className="fatal-error"><Brand /><Skeleton /></main>
  if (!data) return <main className="fatal-error"><Brand /><Notice tone="error">{loadError ?? 'Nie udało się odczytać danych konta.'}</Notice>
    <Button variant="secondary" onClick={refresh}>Spróbuj ponownie</Button></main>
  if (auth.mode === 'cloud' && data.goals.setupDone && !leaving) return <Navigate to="/goals" replace />
  async function skip() {
    setError(null)
    setLeaving(true)
    try { await execute({ type: 'goals.skip' }); navigate('/', { replace: true }) }
    catch (cause) { setLeaving(false); setError(errorMessage(cause)) }
  }
  return <div className="goals-setup-layout">
    <header className="wizard-header"><Brand /><Button variant="ghost" onClick={() => { void skip() }} busy={pending}>Pomiń na razie</Button></header>
    <main className="goals-setup-main">
      <div className="goals-setup-intro"><h1>Ustal swoje cele</h1>
        <p>Ostatni krok: wpisz masę i wybierz wartości na pierwszy cykl. Niczego nie zmienimy bez Twojego potwierdzenia.</p></div>
      {error && <Notice tone="error">{error}</Notice>}
      <CycleForm journal={data} onboarding />
    </main>
  </div>
}

export function NewGoalCyclePage() {
  const { data } = useJournal()
  if (!data) throw new Error('Journal data is unavailable')
  return <>
    <div className="goals-back"><Link to="/goals" className="text-link">← Wróć do Celów</Link></div>
    <PageHeader title="Nowy cykl" description="Nowe dzienne cele zaczną obowiązywać dopiero po Twoim zatwierdzeniu." primary="none" />
    <CycleForm journal={data} onboarding={false} />
  </>
}

function TargetWeightEditor({ journal }: { journal: Journal }) {
  const { execute, pending } = useJournal()
  const feedback = useFeedback()
  const [value, setValue] = useState(String(journal.profile.targetWeight ?? ''))
  const [error, setError] = useState<string | null>(null)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = value.trim() === '' ? null : decimal(value)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 20 || parsed > 500)) {
      setError('Podaj masę od 20 do 500 kg albo zostaw pole puste.')
      return
    }
    setError(null)
    try {
      await execute({ type: 'profile.save', value: { ...journal.profile, targetWeight: parsed } })
      feedback('Masa docelowa została zaktualizowana.')
    } catch (cause) { setError(errorMessage(cause)) }
  }
  return <form onSubmit={(event) => { void save(event) }} className="goals-weight-edit">
    <Field label="Masa docelowa (kg)" hint="Opcjonalna. Nie wpływa automatycznie na dzienny cel kalorii.">
      <input type="number" min="20" max="500" step="0.1" value={value}
        onChange={(event) => { setValue(event.target.value); setError(null) }} /></Field>
    <Button type="submit" variant="secondary" busy={pending}>Zapisz wagę docelową</Button>
    {error && <Notice tone="error">{error}</Notice>}
  </form>
}

function CycleHistory({ journal, day }: { journal: Journal; day: string }) {
  const [range, setRange] = useState(14)
  const { setDate } = useWorkspace()
  const current = effectiveCycle(journal)
  const archived = [...journal.goals.cycles].filter((cycle) => cycle.id !== current?.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt))
  return <>
    <section className="panel goals-history" aria-labelledby="goals-history-title">
      <div className="section-heading"><h2 id="goals-history-title">Historia energii</h2>
        <div className="range-selector" aria-label="Okres historii kalorii">
          {[7, 14, 30].map((days) => <button key={days} type="button" aria-pressed={days === range} onClick={() => setRange(days)}>{days} dni</button>)}
        </div>
      </div>
      <p className="goals-help">Brak wpisów nie oznacza zera. Cele są pokazane według cyklu zatwierdzonego dla danej daty; po końcu cyklu obowiązuje ostatni zatwierdzony cel.</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Historia spożytej energii i celów">
        <table className="goals-history-table"><caption className="sr-only">Spożyta energia a zatwierdzone cele, dzień po dniu</caption>
          <thead><tr><th scope="col">Dzień</th><th scope="col">Zjedzone</th><th scope="col">Cel</th><th scope="col">Woda</th></tr></thead>
          <tbody>{daysEndingAt(day, range).reverse().map((date) => {
            const meals = journal.meals.filter((meal) => meal.date === date)
            const goal = goalForDay(journal, date)
            const kcal = meals.length ? nutritionTotal(meals, 'kcal').value : null
            const water = journal.water.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.amountMl, 0)
            return <tr key={date} className={date === day ? 'selected' : undefined}>
              <th scope="row"><button className="text-link" type="button" onClick={() => setDate(date)}>{dateLabel(date, { day: 'numeric', month: 'short', weekday: 'short' })}</button></th>
              <td>{kcal === null ? 'Brak wpisów' : <div className="goals-history-value"><strong>{integerFormat.format(kcal)} kcal</strong>
                {goal && <span className="goals-history-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, kcal / goal.calorieGoal * 100)}%` }} /></span>}
              </div>}</td>
              <td>{goal ? `${integerFormat.format(goal.calorieGoal)} kcal` : 'Nie ustalono'}</td>
              <td>{water ? `${numberFormat.format(water / 1000)} l` : '—'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </section>
    <section className="panel goals-cycles" aria-labelledby="goals-cycles-title">
      <h2 id="goals-cycles-title">Archiwum cykli</h2>
      {archived.length ? <ol>{archived.map((cycle) => <li key={cycle.id}>
        <div><strong>{cycleNames[cycle.kind]}</strong><span>{dateLabel(cycle.startDate)} – {dateLabel(cycle.endDate)}</span></div>
        <p>{integerFormat.format(cycle.calorieGoal)} kcal · B {numberFormat.format(cycle.proteinGoal)} g · W {numberFormat.format(cycle.carbsGoal)} g · T {numberFormat.format(cycle.fatGoal)} g · woda {numberFormat.format(cycle.waterGoal / 1000)} l</p>
        <small>Start: {numberFormat.format(cycle.startWeightKg)} kg · cel: {cycle.targetWeightKg === null ? 'nie podano' : `${numberFormat.format(cycle.targetWeightKg)} kg`}{cycle.status === 'active' ? ' · okres minął, cele pozostały bez zmian' : ''}</small>
      </li>)}</ol> : <p className="goals-help">Poprzednie cykle pojawią się tutaj po zatwierdzeniu następnego.</p>}
    </section>
  </>
}

export function GoalsPage() {
  const { data } = useJournal()
  const auth = useAuth()
  const { date, openMeasurement } = useWorkspace()
  useEffect(() => { rememberGoalsReviewed(auth.session?.user.id) }, [auth.session?.user.id])
  if (!data) throw new Error('Journal data is unavailable')
  const current = effectiveCycle(data)
  const last = [...data.goals.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  const weight = currentWeight(data)
  const target = data.profile.targetWeight
  const dailyTarget = goalForDay(data, date)
  const meals = data.meals.filter((meal) => meal.date === date)
  return <>
    <PageHeader title="Cele" description="Twój kierunek na dziś i historia zatwierdzonych zmian. Bez automatycznych faz." primary="none" />
    <div className="page-toolbar"><DateControl /><Link className="button button-primary" to="/goals/new">Rozpocznij nowy cykl <ArrowRight size={17} aria-hidden="true" /></Link></div>
    {!data.goals.setupDone && <Notice>Wstępne wartości są tylko punktem wyjścia. <Link to="/goals/setup">Ustal i zatwierdź swoje cele</Link> albo wróć do nich później.</Notice>}
    {!current && <Notice>{last
      ? <>Cykl zakończył się {dateLabel(last.endDate)}. Dzienne cele nie zmieniły się same. Wybierz kolejny cykl, kiedy będziesz gotowy(-a).</>
      : 'Nie masz jeszcze zapisanego cyklu. Obecne cele możesz potwierdzić lub zmienić, rozpoczynając pierwszy cykl.'}</Notice>}
    <h2 className="goals-day-title">Cel i zapis · {dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
    <div className="dashboard-grid">
      <div className="dashboard-main">{dailyTarget
        ? <NutritionSummary meals={meals} profile={dailyTarget} date={date} />
        : <section className="panel"><h2>Jedzenie wybranego dnia</h2><p>{meals.length
          ? `Zapisano ${integerFormat.format(nutritionTotal(meals, 'kcal').value)} kcal.`
          : 'Brak zapisanych posiłków.'} Dla tej daty nie ma zatwierdzonego celu.</p></section>}
      </div>
      <aside className="dashboard-aside" aria-label="Woda na wybrany dzień"><WaterPanel data={data} date={date} /></aside>
    </div>
    <div className="goals-overview">
      <section className="panel goals-current" aria-labelledby="current-cycle-title">
        <h2 id="current-cycle-title">{current ? 'Bieżący cykl' : 'Ostatni zatwierdzony kierunek'}</h2>
        <strong className="goals-current-name">{current ? cycleNames[current.kind] : last ? cycleNames[last.kind] : 'Twoje cele'}</strong>
        <p>{current ? `${dateLabel(current.startDate)} – ${dateLabel(current.endDate)}` : last
          ? `Ostatni cykl: ${dateLabel(last.startDate)} – ${dateLabel(last.endDate)}`
          : 'Wybierz daty i wartości, aby zacząć.'}</p>
        <Link className="text-link" to="/goals/new">{current ? 'Zmień kierunek i cele' : 'Wybierz kolejny cykl'} <ChevronRight size={16} aria-hidden="true" /></Link>
      </section>
      <section className="panel goals-weight" aria-labelledby="goals-weight-title">
        <h2 id="goals-weight-title"><Scale size={19} aria-hidden="true" />Masa ciała</h2>
        <dl><div><dt>Aktualna</dt><dd>{weight === null ? 'Brak pomiaru' : `${numberFormat.format(weight)} kg`}</dd></div>
          <div><dt>Docelowa</dt><dd>{target === null ? 'Nie wybrano' : `${numberFormat.format(target)} kg`}</dd></div></dl>
        {weight !== null && target !== null && <p>Różnica: {numberFormat.format(Math.abs(target - weight))} kg {target < weight ? 'w dół' : target > weight ? 'w górę' : '— wartości są równe'}.</p>}
        <button className="text-link" type="button" onClick={openMeasurement}>Dodaj aktualny pomiar <ChevronRight size={16} aria-hidden="true" /></button>
        <details className="goals-weight-details"><summary>Zmień masę docelową</summary>
          <TargetWeightEditor key={data.profile.targetWeight ?? 'none'} journal={data} />
        </details>
      </section>
    </div>
    <CycleHistory journal={data} day={date} />
    <p className="goals-disclaimer"><Droplets size={16} aria-hidden="true" /> Woda i energia z treningów nie zmieniają same celów jedzenia. Szacunki nie są poradą medyczną.</p>
  </>
}

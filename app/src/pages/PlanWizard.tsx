import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  equipmentLabels, goalLabels, homeEquipment, levelLabels, limitationLabels, needsHealthConsent, placeLabels,
  sessionLengths, sexLabels, trainingAnswersSchema, trainingGoals, trainingLevels, trainingLimitations, trainingPlaces,
  trainingSexes, weekdayNames, weekdayShort,
  type Goal, type HomeEquipment, type Level, type Limitation, type Place, type Sex, type TrainingAnswers,
} from '../../../shared/training'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { generatePlan } from '../lib/training/generator'
import { limitationSummary, placeSummary, scheduleLabel } from '../lib/training/format'
import { useFeedback } from '../components/Feedback'
import { CheckList, ChipChoice, ChoiceList, WizardQuestion } from '../components/WizardFields'
import { Brand, Button, Notice, Skeleton, errorMessage } from '../components/ui'

type Step = 'intro' | 'about' | 'goal' | 'place' | 'equipment' | 'level' | 'time' | 'health' | 'summary'
type Draft = {
  age: string; sex: Sex | null; goal: Goal | null; place: Place | null; equipment: HomeEquipment[]
  level: Level | null; weekdays: number[]; minutes: number | null; limitations: Limitation[]
  redFlags: 'yes' | 'no' | null; clearance: boolean; healthConsent: boolean
}

const titles: Record<Step, string> = {
  intro: 'Zanim zaczniesz',
  about: 'Kilka słów o Tobie',
  goal: 'Jaki jest Twój główny cel?',
  place: 'Gdzie będziesz trenować?',
  equipment: 'Jaki sprzęt masz pod ręką?',
  level: 'Jakie masz doświadczenie?',
  time: 'Kiedy i jak długo chcesz trenować?',
  health: 'Zdrowie i ograniczenia',
  summary: 'Sprawdź odpowiedzi',
}

function draftFrom(answers: TrainingAnswers | undefined): Draft {
  if (!answers) return {
    age: '', sex: null, goal: null, place: null, equipment: [], level: null, weekdays: [0, 2, 4], minutes: 45,
    limitations: [], redFlags: null, clearance: false, healthConsent: false,
  }
  return {
    age: String(answers.age), sex: answers.sex, goal: answers.goal, place: answers.place, equipment: answers.equipment,
    level: answers.level, weekdays: answers.weekdays, minutes: answers.minutes, limitations: answers.limitations,
    redFlags: answers.cautiousStart ? 'yes' : 'no', clearance: answers.cautiousStart, healthConsent: answers.healthConsent,
  }
}

export function PlanWizard({ mode }: { mode: 'onboarding' | 'edit' }) {
  const journal = useJournal()
  if (journal.loading) return <main className="fatal-error"><Brand /><Skeleton /></main>
  if (!journal.data) return <main className="fatal-error"><Brand />
    <Notice tone="error">{journal.error ?? 'Nie udało się odczytać danych konta.'}</Notice>
    <Button variant="secondary" onClick={journal.refresh}>Spróbuj ponownie</Button>
  </main>
  return <WizardForm mode={mode} initial={journal.data.training.plan?.answers}
    onboardingDone={journal.data.training.onboardingDone || journal.data.training.plan !== null} goalsDone={journal.data.goals.setupDone} />
}

function WizardForm({ mode, initial, onboardingDone, goalsDone }:
  { mode: 'onboarding' | 'edit'; initial?: TrainingAnswers; onboardingDone: boolean; goalsDone: boolean }) {
  const auth = useAuth()
  const { execute, pending } = useJournal()
  const navigate = useNavigate()
  const feedback = useFeedback()
  const cloud = auth.mode === 'cloud'
  const minAge = cloud ? 18 : 16
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial))
  const [step, setStep] = useState<Step>(mode === 'onboarding' ? 'intro' : 'about')
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [step])

  if (mode === 'onboarding' && onboardingDone && !finishing) return <Navigate to={goalsDone ? '/' : '/goals/setup'} replace />

  const steps: Step[] = [
    ...(mode === 'onboarding' ? ['intro' as const] : []), 'about', 'goal', 'place',
    ...(draft.place === 'home' ? ['equipment' as const] : []), 'level', 'time', 'health', 'summary',
  ]
  const index = steps.indexOf(step)
  const numbered: Step[] = steps.filter((item) => item !== 'intro')
  const position = numbered.indexOf(step) + 1
  const update = (patch: Partial<Draft>) => { setError(null); setDraft((current) => ({ ...current, ...patch })) }
  const consentNeeded = cloud && needsHealthConsent({ limitations: draft.limitations, cautiousStart: draft.redFlags === 'yes' })

  function problem(target: Step): string | null {
    const age = Number(draft.age)
    switch (target) {
      case 'about':
        if (!/^\d{1,2}$/.test(draft.age.trim()) || age < minAge || age > 99) return cloud ? 'Podaj wiek od 18 do 99 lat. Konto Flexa jest przeznaczone dla osób pełnoletnich.' : 'Podaj wiek od 16 do 99 lat.'
        return draft.sex ? null : 'Wybierz płeć albo opcję „Wolę nie podawać”.'
      case 'goal': return draft.goal ? null : 'Wybierz główny cel.'
      case 'place': return draft.place ? null : 'Wybierz miejsce treningu.'
      case 'level': return draft.level ? null : 'Wybierz poziom doświadczenia.'
      case 'time':
        if (draft.weekdays.length < 2) return 'Wybierz co najmniej 2 dni treningowe.'
        return draft.minutes ? null : 'Wybierz długość jednego treningu.'
      case 'health':
        if (!draft.redFlags) return 'Odpowiedz na pierwsze pytanie o zdrowie.'
        if (draft.redFlags === 'yes' && !draft.clearance) return 'Plan z łagodnym startem przygotujemy dopiero po zgodzie lekarza na aktywność. Możesz wrócić do ankiety później.'
        if (consentNeeded && !draft.healthConsent) return 'Aby zapisać plan dopasowany do zdrowia, zaznacz zgodę albo odznacz informacje o zdrowiu.'
        return null
      default: return null
    }
  }

  function answers(): TrainingAnswers | null {
    const parsed = trainingAnswersSchema.safeParse({
      age: Number(draft.age), sex: draft.sex, goal: draft.goal, place: draft.place,
      equipment: draft.place === 'home' ? draft.equipment : [], level: draft.level,
      weekdays: draft.weekdays, minutes: draft.minutes, limitations: draft.limitations,
      cautiousStart: draft.redFlags === 'yes', healthConsent: consentNeeded && draft.healthConsent,
    })
    return parsed.success ? parsed.data : null
  }

  async function finish() {
    const value = answers()
    const missing = steps.map(problem).find(Boolean)
    if (!value || missing) { setError(missing ?? 'Uzupełnij wszystkie odpowiedzi przed utworzeniem planu.'); return }
    setError(null)
    setFinishing(true)
    try {
      await execute({ type: 'plan.save', value: generatePlan(value) })
      feedback('Twój plan jest gotowy. Powodzenia na pierwszym treningu!')
      navigate(mode === 'onboarding' && !goalsDone ? '/goals/setup' : '/plan', { replace: true })
    } catch (cause) {
      setFinishing(false)
      setError(errorMessage(cause))
    }
  }

  async function skip() {
    if (mode === 'edit') { navigate('/plan'); return }
    setError(null)
    setFinishing(true)
    try {
      await execute({ type: 'onboarding.skip' })
      feedback('Plan ułożysz w każdej chwili w zakładce Treningi.')
      navigate(goalsDone ? '/' : '/goals/setup', { replace: true })
    } catch (cause) {
      setFinishing(false)
      setError(errorMessage(cause))
    }
  }

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 'summary') { void finish(); return }
    const found = problem(step)
    if (found) { setError(found); return }
    setError(null)
    setStep(steps[index + 1])
  }

  function back() {
    setError(null)
    if (index === 0 || (mode === 'edit' && step === 'about')) { void skip(); return }
    setStep(steps[index - 1])
  }

  function toggleDay(day: number) {
    if (draft.weekdays.includes(day)) { update({ weekdays: draft.weekdays.filter((item) => item !== day) }); return }
    if (draft.weekdays.length >= 6) { setError('Maksymalnie 6 dni — zostaw co najmniej jeden dzień na odpoczynek.'); return }
    update({ weekdays: [...draft.weekdays, day].sort((a, b) => a - b) })
  }

  const consecutive = draft.weekdays.some((day) => draft.weekdays.includes(day + 1) && draft.weekdays.includes(day + 2))
  const ready = step === 'summary' ? answers() : null

  return <div className="wizard-layout">
    <header className="wizard-header">
      <Brand />
      {step !== 'intro' && <button type="button" className="text-link" onClick={() => { void skip() }} disabled={pending}>{mode === 'onboarding' ? 'Pomiń na razie' : 'Anuluj'}</button>}
    </header>
    {step !== 'intro' && <div className="wizard-progress">
      <span className="wizard-progress-track" aria-hidden="true"><span style={{ transform: `scaleX(${position / numbered.length})` }} /></span>
      <span>Krok {position} z {numbered.length}</span>
    </div>}
    <main className="wizard-main">
      <form className="wizard-card" onSubmit={next} noValidate>
        <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1>

        {step === 'intro' && <>
          <p className="wizard-lead">Odpowiedz na kilka krótkich pytań — zajmie to około 2 minut. Ułożymy plan dopasowany do Twojego celu, sprzętu, czasu i zdrowia.</p>
          <ul className="wizard-benefits">
            <li><Check size={18} aria-hidden="true" />Siłownia albo dom — także bez żadnego sprzętu.</li>
            <li><Check size={18} aria-hidden="true" />Dni i długość treningu wybierasz Ty.</li>
            <li><Check size={18} aria-hidden="true" />Rozgrzewka, serie, przerwy, technika i rozciąganie w każdym treningu.</li>
            <li><Check size={18} aria-hidden="true" />Ćwiczenia dobrane z ominięciem zgłoszonych dolegliwości.</li>
          </ul>
          <p className="wizard-note">Plan powstaje w aplikacji według reguł treningowych, bez AI. Zmienisz go w każdej chwili w zakładce Plan.</p>
        </>}

        {step === 'about' && <>
          <p className="wizard-lead">Wiek pomaga dobrać intensywność, przerwy i bezpieczne warianty ćwiczeń.</p>
          <WizardQuestion id="question-age" title="Ile masz lat?" hint={cloud ? undefined : 'Osoby w wieku 16–17 lat dostaną plan nastawiony na naukę techniki.'}>
            <input className="wizard-number" aria-labelledby="question-age" inputMode="numeric" autoComplete="off" maxLength={2}
              value={draft.age} onChange={(event) => update({ age: event.target.value.replace(/\D/g, '') })} />
          </WizardQuestion>
          <WizardQuestion id="question-sex" title="Płeć" hint="Nie zmienia doboru ćwiczeń; uzupełnia wskazówki dotyczące zdrowia kości.">
            <ChipChoice name="sex" labelledBy="question-sex" value={draft.sex} onChange={(sex) => update({ sex })}
              options={trainingSexes.map((value) => ({ value, label: sexLabels[value] }))} />
          </WizardQuestion>
        </>}

        {step === 'goal' && <>
          <p className="wizard-lead" id="question-goal">Wybierz jeden cel — plan rozłoży pod niego akcenty.</p>
          <ChoiceList name="goal" labelledBy="question-goal" value={draft.goal} onChange={(goal) => update({ goal })}
            options={trainingGoals.map((value) => ({ value, ...goalLabels[value] }))} />
        </>}

        {step === 'place' && <>
          <p className="wizard-lead" id="question-place">Na siłowni zakładamy dostęp do typowego sprzętu. W domu zapytamy, co masz.</p>
          <ChoiceList name="place" labelledBy="question-place" value={draft.place} onChange={(place) => update({ place })}
            options={trainingPlaces.map((value) => ({ value, ...placeLabels[value] }))} />
        </>}

        {step === 'equipment' && <>
          <p className="wizard-lead" id="question-equipment">Zaznacz wszystko, co masz. Bez sprzętu też ułożymy pełny plan — z masą ciała, ścianą i plecakiem z książkami.</p>
          <CheckList labelledBy="question-equipment" values={draft.equipment} onChange={(equipment) => update({ equipment })}
            options={homeEquipment.map((value) => ({ value, title: equipmentLabels[value] }))} />
        </>}

        {step === 'level' && <>
          <p className="wizard-lead" id="question-level">Oceń szczerze — łatwiej zwiększyć trudność niż wracać po przeciążeniu.</p>
          <ChoiceList name="level" labelledBy="question-level" value={draft.level} onChange={(level) => update({ level })}
            options={trainingLevels.map((value) => ({ value, ...levelLabels[value] }))} />
        </>}

        {step === 'time' && <>
          <p className="wizard-lead">Czas treningu obejmuje rozgrzewkę i rozciąganie.</p>
          <WizardQuestion id="question-days" title="W które dni?" hint={`Wybrano: ${draft.weekdays.length} z 2–6 dni.`}>
            <fieldset className="weekday-picker" aria-labelledby="question-days">
              {weekdayShort.map((label, day) => <button type="button" key={label} aria-pressed={draft.weekdays.includes(day)}
                aria-label={weekdayNames[day]} onClick={() => toggleDay(day)}>{label}</button>)}
            </fieldset>
            {consecutive && <p className="wizard-hint">Treningi dzień po dniu są w porządku — plan przeplata akcenty. Zadbaj o sen i regenerację.</p>}
          </WizardQuestion>
          <WizardQuestion id="question-minutes" title="Ile minut trwa jeden trening?">
            <ChipChoice name="minutes" labelledBy="question-minutes" value={draft.minutes} onChange={(minutes) => update({ minutes })}
              options={sessionLengths.map((value) => ({ value, label: `${value} min` }))} />
          </WizardQuestion>
        </>}

        {step === 'health' && <>
          <p className="wizard-lead">Odpowiedzi pomogą ominąć ćwiczenia, które mogłyby Ci zaszkodzić. Flexa nie ocenia stanu zdrowia.</p>
          <WizardQuestion id="question-flags" title="Czy lekarz zalecił Ci ograniczenie wysiłku albo występuje u Ciebie choroba serca, ból w klatce piersiowej, zawroty głowy lub omdlenia, ciąża, niedawna operacja lub świeży uraz?">
            <ChipChoice name="flags" labelledBy="question-flags" value={draft.redFlags} onChange={(redFlags) => update({ redFlags, clearance: false })}
              options={[{ value: 'no' as const, label: 'Nie' }, { value: 'yes' as const, label: 'Tak' }]} />
            {draft.redFlags === 'yes' && <>
              <Notice>Zanim zaczniesz, skonsultuj aktywność z lekarzem. Plan z łagodnym startem przygotujemy tylko wtedy, gdy lekarz zgodził się na ćwiczenia.</Notice>
              <label className="checkbox-label"><input type="checkbox" checked={draft.clearance} onChange={(event) => update({ clearance: event.target.checked })} />
                <span>Lekarz zgodził się na moją aktywność fizyczną — chcę plan z łagodnym startem.</span></label>
            </>}
          </WizardQuestion>
          <WizardQuestion id="question-limits" title="Czy coś z poniższych Cię dotyczy?" hint="Zaznacz wszystko, co pasuje. Brak zaznaczenia oznacza brak ograniczeń.">
            <CheckList labelledBy="question-limits" values={draft.limitations} onChange={(limitations) => update({ limitations })}
              options={trainingLimitations.map((value) => ({ value, title: limitationLabels[value] }))} />
          </WizardQuestion>
          {consentNeeded && <label className="checkbox-label wizard-consent"><input type="checkbox" checked={draft.healthConsent} onChange={(event) => update({ healthConsent: event.target.checked })} />
            <span>Zgadzam się na zapisanie tych informacji o zdrowiu na moim koncie Flexa wyłącznie w celu dopasowania planu. Zgodę wycofam, usuwając plan lub konto.</span></label>}
          {!cloud && <p className="wizard-note">W trybie demo odpowiedzi zostają tylko na tym urządzeniu.</p>}
        </>}

        {step === 'summary' && !ready && <Notice tone="error">Brakuje części odpowiedzi. Wróć do poprzednich kroków i je uzupełnij.</Notice>}
        {step === 'summary' && ready && <>
          <p className="wizard-lead">Plan ułożymy z tych odpowiedzi. Każdą możesz jeszcze zmienić.</p>
          <dl className="summary-list">
            {([
              ['Wiek i płeć', `${ready.age} lat · ${sexLabels[ready.sex]}`, 'about'],
              ['Cel', goalLabels[ready.goal].title, 'goal'],
              ['Miejsce i sprzęt', placeSummary(ready), ready.place === 'home' ? 'equipment' : 'place'],
              ['Doświadczenie', levelLabels[ready.level].title, 'level'],
              ['Dni i czas', `${scheduleLabel(ready)} · ${ready.minutes} min`, 'time'],
              ['Zdrowie', limitationSummary(ready), 'health'],
            ] as [string, string, Step][]).map(([label, value, target]) => <div key={label}>
              <dt>{label}</dt>
              <dd><span>{value}</span>
                <button type="button" className="text-link" aria-label={`Zmień: ${label}`} onClick={() => { setError(null); setStep(target) }}>Zmień</button></dd>
            </div>)}
          </dl>
          <p className="wizard-note">Plan to ogólne wskazówki treningowe, a nie porada medyczna. Przy niepokojących objawach przerwij ćwiczenia.</p>
        </>}

        {error && <Notice tone="error">{error}</Notice>}
        <div className="wizard-actions">
          {step === 'intro'
            ? <Button type="button" variant="secondary" onClick={() => { void skip() }} disabled={pending}>Pomiń na razie</Button>
            : <Button type="button" variant="secondary" onClick={back} disabled={pending}><ArrowLeft size={17} aria-hidden="true" />{mode === 'edit' && step === 'about' ? 'Anuluj' : 'Wstecz'}</Button>}
          <Button type="submit" busy={pending && step === 'summary'}>
            {step === 'intro' ? 'Zaczynamy' : step === 'summary' ? 'Utwórz mój plan' : 'Dalej'}<ArrowRight size={17} aria-hidden="true" />
          </Button>
        </div>
      </form>
    </main>
  </div>
}

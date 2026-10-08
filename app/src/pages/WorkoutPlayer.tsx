import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CalendarCheck, Check, ListChecks, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { PlanSession, TrainingPlan } from '../../../shared/training'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { today } from '../lib/dates'
import { alternativesFor } from '../lib/training/generator'
import { duration, plannedWorkout, sessionShortName, sessionTitle, stopwatch } from '../lib/training/format'
import { findExercise } from '../lib/training/library'
import { clearProgress, newProgress, progressScope, readProgress, writeProgress, type WorkoutProgress } from '../lib/training/progress'
import { draftsToSets, formatSet, lastSets, setDraftFrom, takesLoad, type SetDraft } from '../lib/training/sets'
import { blockOf, partLabels, workoutSteps, type TimerPhase, type WorkoutStep } from '../lib/training/steps'
import { ExerciseVideo } from '../components/ExerciseVideo'
import { WorkoutDrawer } from '../components/WorkoutDrawer'
import { Brand, Button, Drawer, Field, Notice, Skeleton } from '../components/ui'

const SOUND_KEY = 'flexa:workout-sound'
type Signals = { prime: () => void; beep: (kind: 'tick' | 'end') => void }

function useSignals(sound: boolean): Signals {
  const context = useRef<AudioContext | null>(null)
  const enabled = useRef(sound)
  useEffect(() => { enabled.current = sound }, [sound])
  const [signals] = useState<Signals>(() => ({
    prime() {
      if (!enabled.current) return
      try { context.current ??= new AudioContext(); void context.current.resume() } catch { /* Sound is optional. */ }
    },
    beep(kind) {
      if (kind === 'end') navigator.vibrate?.([180, 90, 180])
      const audio = context.current
      if (!enabled.current || !audio) return
      const tones = kind === 'tick' ? [[0, 660, 0.09]] : [[0, 880, 0.15], [0.2, 880, 0.15], [0.4, 1175, 0.3]]
      for (const [delay, frequency, length] of tones) {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        const start = audio.currentTime + delay
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
        oscillator.connect(gain).connect(audio.destination)
        oscillator.start(start)
        oscillator.stop(start + length + 0.05)
      }
    },
  }))
  return signals
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false
    const request = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then((sentinel) => {
        if (stopped) void sentinel.release()
        else lock = sentinel
      }).catch(() => { /* The screen may still dim; the workout keeps its own time. */ })
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', request)
      void lock?.release().catch(() => undefined)
    }
  }, [active])
}

const add = (list: string[], id: string) => list.includes(id) ? list : [...list, id]
const without = (list: string[], ids: string[]) => list.filter((item) => !ids.includes(item))
const nameOf = (step: WorkoutStep) => findExercise(step.exercise)?.name ?? 'Ćwiczenie'
/** Strength sets with a repetition target can optionally record what was actually done. */
const loggable = (step: WorkoutStep) => step.part === 'main' && step.phases === null && findExercise(step.exercise)?.measure === 'reps'
const hasValue = (draft: SetDraft) => draft.reps.trim() !== '' || draft.weight.trim() !== ''

function SetLog({ step, draft, suggestion, onChange }: { step: WorkoutStep; draft: SetDraft; suggestion: string | null; onChange: (draft: SetDraft) => void }) {
  const load = takesLoad(step.exercise)
  return <fieldset className="player-setlog">
    <legend>Twoja seria <span>(opcjonalnie)</span></legend>
    <div className="player-setlog-fields">
      <Field label="Powtórzenia"><input type="number" inputMode="numeric" min="1" max="100" step="1" value={draft.reps}
        onChange={(event) => onChange({ ...draft, reps: event.target.value })} /></Field>
      {load && <Field label="Ciężar (kg)"><input type="number" inputMode="decimal" min="0" max="500" step="0.25" value={draft.weight}
        onChange={(event) => onChange({ ...draft, weight: event.target.value })} /></Field>}
    </div>
    <p className="player-setlog-hint">{suggestion ? `Wpisano wartości z ostatniego zapisu (${suggestion}). ` : ''}Możesz zostawić puste — „Skończone” działa tak samo.</p>
  </fieldset>
}

function StepTimer({ phases, now, signals, onFinish }: { phases: TimerPhase[]; now: number; signals: Signals; onFinish: () => void }) {
  const total = phases.reduce((sum, phase) => sum + phase.seconds, 0) * 1000
  const [run, setRun] = useState<{ since: number | null; spent: number }>({ since: null, spent: 0 })
  const spent = Math.min(total, run.spent + (run.since === null ? 0 : Math.max(0, now - run.since)))
  let left = spent / 1000
  let phaseIndex = 0
  while (phaseIndex < phases.length - 1 && left >= phases[phaseIndex].seconds) { left -= phases[phaseIndex].seconds; phaseIndex++ }
  const phase = phases[phaseIndex]
  const remaining = Math.max(0, Math.ceil(phase.seconds - left))
  const finished = spent >= total
  const finish = useRef(onFinish)
  useEffect(() => { finish.current = onFinish })
  const lastPhase = useRef(phaseIndex)
  useEffect(() => {
    if (lastPhase.current === phaseIndex) return
    lastPhase.current = phaseIndex
    signals.beep('tick')
  }, [phaseIndex, signals])
  useEffect(() => {
    if (!finished) return
    signals.beep('end')
    const timer = window.setTimeout(() => finish.current(), 900)
    return () => window.clearTimeout(timer)
  }, [finished, signals])
  return <div className={`player-timer tone-${phase.tone}`}>
    <p className="player-timer-phase">{phase.label}</p>
    <p className="player-timer-value" role="timer" aria-label={`${phase.label}: ${duration(remaining)}`}>{stopwatch(remaining)}</p>
    <span className="player-meter" aria-hidden="true"><span style={{ transform: `scaleX(${total ? spent / total : 0})` }} /></span>
    <div className="button-row">
      {run.since === null
        ? <Button variant="secondary" disabled={finished} onClick={() => { signals.prime(); setRun({ since: Date.now(), spent: run.spent }) }}>
          <Play size={17} aria-hidden="true" />{run.spent ? 'Wznów odliczanie' : 'Start odliczania'}</Button>
        : <Button variant="secondary" onClick={() => setRun({ since: null, spent })}><Pause size={17} aria-hidden="true" />Pauza</Button>}
      {(run.spent > 0 || run.since !== null) && <Button variant="ghost" onClick={() => setRun({ since: null, spent: 0 })}><RotateCcw size={16} aria-hidden="true" />Od nowa</Button>}
    </div>
  </div>
}

export function WorkoutPlayer() {
  const { sessionKey } = useParams()
  const journal = useJournal()
  if (journal.loading) return <main className="fatal-error"><Brand /><Skeleton /></main>
  if (!journal.data) return <main className="fatal-error"><Brand />
    <Notice tone="error">{journal.error ?? 'Nie udało się odczytać planu.'}</Notice>
    <Button variant="secondary" onClick={journal.refresh}>Spróbuj ponownie</Button>
  </main>
  const plan = journal.data.training.plan
  const index = plan?.sessions.findIndex((session) => session.key === sessionKey) ?? -1
  if (!plan || index < 0) return <Navigate to="/plan" replace />
  return <Player key={`${plan.createdAt}:${plan.sessions[index].key}`} plan={plan} session={plan.sessions[index]} sessionIndex={index} />
}

function Player({ plan, session, sessionIndex }: { plan: TrainingPlan; session: PlanSession; sessionIndex: number }) {
  const auth = useAuth()
  const { data } = useJournal()
  const workouts = data?.workouts
  const history = useMemo(() => lastSets(workouts ?? []), [workouts])
  const scope = progressScope(auth.mode, auth.session?.user.id)
  const steps = useMemo(() => workoutSteps(session), [session])
  const title = sessionTitle(session, sessionIndex, plan.answers.goal)
  const [resumed] = useState(() => {
    const saved = readProgress(scope, plan.createdAt)
    return saved && saved.session === session.key && saved.index < steps.length ? saved : null
  })
  const [state, setState] = useState<WorkoutProgress>(() => resumed ?? newProgress(scope, plan.createdAt, session.key))
  const [now, setNow] = useState(() => Date.now())
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true } })
  const [listOpen, setListOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showResumed, setShowResumed] = useState(resumed !== null)
  const heading = useRef<HTMLHeadingElement>(null)
  const live = useRef<HTMLParagraphElement>(null)
  const signals = useSignals(sound)
  const announce = (text: string) => { if (live.current) live.current.textContent = text }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (state.finishedAt !== null) { clearProgress(); return }
    if (state.index === 0 && !state.done.length && !state.skipped.length && !state.rest) return
    writeProgress({ ...state, updatedAt: Date.now() })
  }, [state])
  useWakeLock(state.finishedAt === null)

  const step = steps[Math.min(state.index, steps.length - 1)]
  const restLeft = state.rest ? Math.max(0, Math.ceil((state.rest.endsAt - now) / 1000)) : 0
  const rest = state.finishedAt === null && restLeft > 0 ? state.rest : null
  const resting = rest !== null
  const elapsed = ((state.finishedAt ?? now) - state.startedAt) / 1000
  const done = new Set(state.done)
  const skipped = new Set(state.skipped)

  const lastRest = useRef(restLeft)
  const expired = state.rest !== null && restLeft === 0
  useEffect(() => {
    const before = lastRest.current
    lastRest.current = restLeft
    if (before === restLeft || before === 0) return
    if (restLeft > 0 && restLeft <= 3) signals.beep('tick')
    if (expired) {
      signals.beep('end')
      if (live.current) live.current.textContent = `Koniec przerwy. Teraz: ${nameOf(step)}.`
    }
  }, [restLeft, expired, step, signals])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [state.index, resting, state.finishedAt])

  function nextIndex(from: number, skip: Set<string>) {
    for (let index = from + 1; index < steps.length; index++) if (!skip.has(steps[index].id)) return index
    return -1
  }
  function moveOn(doneIds: string[], skippedIds: string[], rest: number, sets = state.sets) {
    const target = nextIndex(state.index, new Set(skippedIds))
    const time = Date.now()
    setShowResumed(false)
    if (target < 0) { setState({ ...state, sets, done: doneIds, skipped: skippedIds, rest: null, finishedAt: time }); return }
    setState({ ...state, sets, done: doneIds, skipped: skippedIds, index: target, rest: rest > 0 ? { endsAt: time + rest * 1000, total: rest, from: state.index } : null })
    setNow(time)
    if (rest > 0) announce(`${rest <= 20 ? 'Zmiana ćwiczenia' : 'Chwila przerwy'}: ${duration(rest)}.`)
  }
  function prefill(index: number): { draft: SetDraft; suggestion: string | null } {
    const current = steps[index]
    const saved = state.sets[current.id]
    if (saved) return { draft: saved, suggestion: null }
    for (let earlier = index - 1; earlier >= 0; earlier--) {
      const previous = state.sets[steps[earlier].id]
      if (previous && steps[earlier].exercise === current.exercise) return { draft: previous, suggestion: null }
    }
    const last = history.get(current.exercise)
    if (!last || (last.reps === null && last.weightKg === null)) return { draft: { reps: '', weight: '' }, suggestion: null }
    const draft = setDraftFrom(last)
    return { draft: takesLoad(current.exercise) ? draft : { ...draft, weight: '' }, suggestion: formatSet(last) }
  }
  function complete() {
    signals.prime()
    let sets = state.sets
    if (loggable(step)) {
      const { draft } = prefill(state.index)
      sets = { ...sets }
      if (hasValue(draft)) sets[step.id] = draft
      else delete sets[step.id]
    }
    moveOn(add(state.done, step.id), without(state.skipped, [step.id]), step.rest, sets)
  }
  function skipExercise() {
    const ids = steps.filter((item, index) => index >= state.index && item.exercise === step.exercise && blockOf(item) === blockOf(step)).map((item) => item.id)
    moveOn(without(state.done, ids), [...new Set([...state.skipped, ...ids])], 0)
  }
  function back() {
    setShowResumed(false)
    if (resting) {
      const from = rest.from
      setState({ ...state, index: from, rest: null, done: without(state.done, [steps[from].id]) })
      return
    }
    for (let index = state.index - 1; index >= 0; index--) {
      if (skipped.has(steps[index].id)) continue
      setState({ ...state, index, rest: null, done: without(state.done, [steps[index].id]) })
      return
    }
  }
  function jump(index: number) {
    setListOpen(false)
    setShowResumed(false)
    setState({ ...state, index, rest: null, finishedAt: null, skipped: without(state.skipped, [steps[index].id]) })
  }
  function restart() {
    setShowResumed(false)
    setState(newProgress(scope, plan.createdAt, session.key))
  }
  function toggleSound() {
    const next = !sound
    setSound(next)
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* Preference lasts for this workout only. */ }
  }

  const position = state.finishedAt !== null ? steps.length : state.index + (resting ? 0 : 1)
  const exercise = findExercise(step.exercise)
  const options = alternativesFor(step.exercise, plan.answers)
  const minutes = Math.max(1, Math.min(600, Math.round(elapsed / 60)))
  const loggedSets = draftsToSets(steps, state.done, state.sets)

  return <div className="player-layout">
    <header className="player-header">
      <Link className="icon-button" to="/plan" aria-label="Wyjdź z treningu. Postęp zostanie zapamiętany na tym urządzeniu."><X size={22} /></Link>
      <div className="player-title">
        <strong>Dzień {sessionIndex + 1}: {sessionShortName(session.kind)}</strong>
        <span role="timer" aria-label={`Czas treningu ${stopwatch(elapsed)}`}>{stopwatch(elapsed)}</span>
      </div>
      <button type="button" className="icon-button" onClick={toggleSound} aria-pressed={!sound}
        aria-label={sound ? 'Wycisz sygnały dźwiękowe' : 'Włącz sygnały dźwiękowe'}>{sound ? <Volume2 size={21} /> : <VolumeX size={21} />}</button>
      <button type="button" className="icon-button" onClick={() => setListOpen(true)} aria-label="Lista kroków treningu"><ListChecks size={21} /></button>
    </header>
    <div className="player-progress">
      <span className="wizard-progress-track" aria-hidden="true"><span style={{ transform: `scaleX(${position / steps.length})` }} /></span>
      <span>{state.finishedAt !== null ? 'Koniec' : partLabels[step.part]} · krok {Math.max(1, position)} z {steps.length}</span>
    </div>
    <main className="player-main">
      {state.finishedAt !== null ? <section className="player-card player-done" aria-labelledby="player-heading">
        <Check className="player-done-mark" size={30} aria-hidden="true" />
        <h1 id="player-heading" ref={heading} tabIndex={-1}>{state.done.length === steps.length ? 'Trening ukończony. Brawo!' : 'Trening zakończony'}</h1>
        <p className="player-lead">{title}</p>
        <dl className="player-summary">
          <div><dt>Czas</dt><dd>{minutes} min</dd></div>
          <div><dt>Wykonane kroki</dt><dd>{state.done.length} z {steps.length}</dd></div>
          {state.skipped.length > 0 && <div><dt>Pominięte</dt><dd>{state.skipped.length}</dd></div>}
          {loggedSets.length > 0 && <div><dt>Serie z wynikiem</dt><dd>{loggedSets.length}</dd></div>}
        </dl>
        <p className="player-lead">Zapisz trening, aby zobaczyć go w aktywnościach i podsumowaniu tygodnia.</p>
        <div className="button-row">
          <Button onClick={() => setSaving(true)}><CalendarCheck size={17} aria-hidden="true" />Zapisz w dzienniku</Button>
          <Link className="button button-secondary" to="/plan">Wróć do planu</Link>
        </div>
        <button type="button" className="text-link player-restart" onClick={restart}><RotateCcw size={15} aria-hidden="true" />Zacznij ten trening od nowa</button>
      </section> : rest ? <section className="player-rest" aria-labelledby="player-heading">
        <h1 id="player-heading" ref={heading} tabIndex={-1}>{rest.total <= 20 ? 'Zmiana ćwiczenia' : 'Chwila przerwy'}</h1>
        <p className="player-rest-time" role="timer" aria-label={`Pozostało ${duration(restLeft)}`}>{stopwatch(restLeft)}</p>
        <span className="player-meter" aria-hidden="true"><span style={{ transform: `scaleX(${restLeft / rest.total})` }} /></span>
        <p className="player-rest-text">{rest.total <= 20 ? 'Przejdź spokojnie do następnego ćwiczenia.' : 'Odpocznij, napij się wody i wyrównaj oddech. Odliczanie samo przejdzie dalej.'}</p>
        <p className="player-next">Następnie: <strong>{step.tag ? `${step.tag} · ` : ''}{nameOf(step)}</strong><br />{[step.progress, step.target].filter(Boolean).join(' · ')}</p>
        <div className="player-rest-actions">
          <Button variant="secondary" onClick={() => setState({ ...state, rest: { ...rest, endsAt: rest.endsAt + 15000, total: rest.total + 15 } })}>+15 s</Button>
          <Button onClick={() => { setShowResumed(false); setState({ ...state, rest: null }) }}>Pomiń przerwę<SkipForward size={17} aria-hidden="true" /></Button>
        </div>
        <button type="button" className="text-link" onClick={back}><ArrowLeft size={15} aria-hidden="true" />Wróć do poprzedniego ćwiczenia</button>
      </section> : <section className="player-card" aria-labelledby="player-heading">
        {showResumed && resumed && <Notice>Wznowiono trening od kroku {resumed.index + 1}. <button type="button" className="text-link" onClick={restart}>Zacznij od nowa</button></Notice>}
        <div className="player-step-head">
          {step.tag && <span className="exercise-tag">{step.tag}</span>}
          <h1 id="player-heading" ref={heading} tabIndex={-1}>{nameOf(step)}</h1>
        </div>
        <p className="player-dose"><strong>{step.target}</strong>{step.progress && <span>{step.progress}</span>}</p>
        {step.notes.length > 0 && <p className="player-notes">{step.notes.join(' · ')}</p>}
        {step.hint && <p className="player-hint">{step.hint}</p>}
        {loggable(step) && (() => {
          const { draft, suggestion } = prefill(state.index)
          return <SetLog key={step.id} step={step} draft={draft} suggestion={suggestion}
            onChange={(next) => setState({ ...state, sets: { ...state.sets, [step.id]: next } })} />
        })()}
        {step.phases && <StepTimer key={step.id} phases={step.phases} now={now} signals={signals} onFinish={complete} />}
        <ExerciseVideo key={step.exercise} exerciseId={step.exercise} name={nameOf(step)} />
        {exercise && <section className="player-technique" aria-labelledby="player-technique">
          <h2 id="player-technique">Jak to zrobić</h2>
          <ul className="exercise-cues">{exercise.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
          <p><strong>Oddech:</strong> {exercise.breathing}</p>
          {exercise.safety && <p><strong>Bezpieczeństwo:</strong> {exercise.safety}</p>}
          {(options.easier || options.similar || options.harder) && <p><strong>Zamienniki:</strong>{' '}
            {[options.easier && `łatwiej — ${options.easier.name}`, options.similar && `podobnie — ${options.similar.name}`, options.harder && `trudniej — ${options.harder.name}`].filter(Boolean).join(' · ')}</p>}
        </section>}
        <button type="button" className="text-link player-skip" onClick={skipExercise}><SkipForward size={15} aria-hidden="true" />Pomiń to ćwiczenie</button>
      </section>}
      {state.finishedAt === null && !resting && <div className="player-actions">
        <Button variant="secondary" onClick={back} disabled={state.index === 0}><ArrowLeft size={18} aria-hidden="true" />Wstecz</Button>
        <Button onClick={complete}><Check size={19} aria-hidden="true" />Skończone</Button>
      </div>}
      <p className="sr-only" aria-live="polite" ref={live} />
    </main>
    {listOpen && <Drawer title="Kroki treningu" onClose={() => setListOpen(false)}>
      <p>{title}. Wybierz krok, aby do niego przejść.</p>
      {(['warmup', 'main', 'cooldown'] as const).map((part) => {
        const items = steps.map((item, index) => ({ item, index })).filter(({ item }) => item.part === part)
        if (!items.length) return null
        return <section key={part} className="player-steps-part">
          <h3>{partLabels[part]}</h3>
          <ol className="player-steps">{items.map(({ item, index }) => {
            const status = done.has(item.id) ? 'wykonane' : skipped.has(item.id) ? 'pominięte' : null
            return <li key={item.id}><button type="button" aria-current={index === state.index && state.finishedAt === null ? 'step' : undefined} onClick={() => jump(index)}>
              <span className={`player-step-status${status ? ` is-${status === 'wykonane' ? 'done' : 'skipped'}` : ''}`} aria-hidden="true">
                {status === 'wykonane' ? <Check size={15} /> : status === 'pominięte' ? <SkipForward size={14} /> : index + 1}</span>
              <span className="player-step-text"><strong>{item.tag ? `${item.tag} · ` : ''}{nameOf(item)}</strong>
                <small>{[item.progress, item.target, status].filter(Boolean).join(' · ')}</small></span>
            </button></li>
          })}</ol>
        </section>
      })}
      {state.finishedAt === null && <div className="button-row">
        <Button variant="secondary" onClick={() => { setListOpen(false); setState({ ...state, rest: null, finishedAt: Date.now() }) }}>Zakończ trening teraz</Button>
      </div>}
    </Drawer>}
    {saving && <WorkoutDrawer date={today()} preset={{ ...plannedWorkout(session, sessionIndex, plan.answers.goal), minutes, sets: loggedSets }} onClose={() => setSaving(false)} />}
  </div>
}

import { useEffect, useState } from 'react'
import { CalendarCheck, ChevronDown, ClipboardList, RefreshCw, Trash2 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { weekdayNames, weekdayShort, type PlanDrill, type PlanSession, type TrainingPlan } from '../../../shared/training'
import { useJournal } from '../lib/Journal'
import { today } from '../lib/dates'
import { alternativesFor, drillSeconds } from '../lib/training/generator'
import {
  blockHeading, blockHint, duration, formatTarget, goalNotes, itemDetails, planSummary, plannedWorkout, progressionSteps,
  safetyNotes, sessionShortName, sessionTitle, weekdayIndex,
} from '../lib/training/format'
import { findExercise } from '../lib/training/library'
import { useWorkspace } from '../components/Workspace'
import { useFeedback } from '../components/Feedback'
import { Button, Confirm, EmptyState, Notice, errorMessage } from '../components/ui'

function Drills({ drills }: { drills: PlanDrill[] }) {
  return <ol className="drill-list">
    {drills.map((drill) => {
      const exercise = findExercise(drill.exercise)
      return <li key={drill.exercise}>
        <strong>{exercise?.name ?? 'Ćwiczenie niedostępne'}</strong>
        <span className="dose">{formatTarget(drill.target, exercise)}</span>
        {exercise && <small>{exercise.cues[0]}</small>}
      </li>
    })}
  </ol>
}

function Session({ session, index, plan, open, onToggle }: { session: PlanSession; index: number; plan: TrainingPlan; open: boolean; onToggle: (open: boolean) => void }) {
  const { openPlannedWorkout } = useWorkspace()
  const warmupMinutes = Math.max(1, Math.round(session.warmup.reduce((sum, drill) => sum + drillSeconds(drill), 0) / 60))
  const cooldownMinutes = Math.max(1, Math.round(session.cooldown.reduce((sum, drill) => sum + drillSeconds(drill), 0) / 60))
  const exercises = session.blocks.reduce((sum, block) => sum + block.items.length, 0)
  const isToday = weekdayIndex(today()) === session.weekday
  return <details className="panel plan-session" id={session.key} open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
    <summary>
      <span className="plan-day-badge" aria-hidden="true">{weekdayShort[session.weekday]}</span>
      <span className="plan-session-summary">
        <h2>{sessionTitle(session, index, plan.answers.goal)}</h2>
        <small>{weekdayNames[session.weekday]}{isToday ? ' · dziś' : ''} · ok. {session.minutes} min · {exercises} {exercises === 1 ? 'ćwiczenie' : exercises < 5 ? 'ćwiczenia' : 'ćwiczeń'}</small>
      </span>
      <ChevronDown size={20} aria-hidden="true" />
    </summary>
    <div className="plan-session-body">
      <section className="plan-part">
        <h3>Rozgrzewka <small>ok. {warmupMinutes} min</small></h3>
        <Drills drills={session.warmup} />
        {session.blocks[0]?.kind === 'straight' && session.blocks[0].items[0].target.type === 'reps' && <p className="plan-tip">Przed pierwszym ćwiczeniem wykonaj 1–2 lżejsze serie wstępne (ok. 50% i 75% ciężaru roboczego).</p>}
      </section>
      <section className="plan-part">
        <h3>Część główna</h3>
        {session.blocks.map((block, blockIndex) => {
          const letter = String.fromCharCode(65 + blockIndex)
          const hint = blockHint(block)
          return <div className="plan-block" key={`${letter}-${block.items[0].exercise}`}>
            <div className="plan-block-head"><strong>{blockHeading(block, letter)}</strong>{hint && <p>{hint}</p>}</div>
            <ol className="exercise-list">
              {block.items.map((item, itemIndex) => {
                const exercise = findExercise(item.exercise)
                const options = alternativesFor(item.exercise, plan.answers)
                const tag = block.items.length > 1 ? `${letter}${itemIndex + 1}` : letter
                return <li className="exercise" key={item.exercise}>
                  <div className="exercise-head"><span className="exercise-tag">{tag}</span><h4>{exercise?.name ?? 'Ćwiczenie niedostępne'}</h4></div>
                  <p className="exercise-dose">{itemDetails(item, block).join(' · ')}</p>
                  {exercise && <>
                    <p className="exercise-muscles">Pracują: {exercise.muscles}</p>
                    <ul className="exercise-cues">{exercise.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
                    <p className="exercise-note"><strong>Oddech:</strong> {exercise.breathing}</p>
                    {exercise.safety && <p className="exercise-note"><strong>Bezpieczeństwo:</strong> {exercise.safety}</p>}
                    {(options.easier || options.similar || options.harder) && <p className="exercise-note"><strong>Zamienniki:</strong>{' '}
                      {[options.easier && `łatwiej — ${options.easier.name}`, options.similar && `podobnie — ${options.similar.name}`, options.harder && `trudniej — ${options.harder.name}`].filter(Boolean).join(' · ')}</p>}
                  </>}
                </li>
              })}
            </ol>
          </div>
        })}
      </section>
      <section className="plan-part">
        <h3>Schłodzenie i rozciąganie <small>ok. {cooldownMinutes} min</small></h3>
        <Drills drills={session.cooldown} />
      </section>
      <div className="button-row">
        <Button variant="secondary" onClick={() => openPlannedWorkout(plannedWorkout(session, index, plan.answers.goal))}>
          <CalendarCheck size={17} aria-hidden="true" />Zapisz jako wykonany
        </Button>
      </div>
    </div>
  </details>
}

export function PlanPage() {
  const { data, execute, pending } = useJournal()
  const feedback = useFeedback()
  const location = useLocation()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plan = data?.training.plan ?? null
  const todayIndex = weekdayIndex(today())
  const hashKey = location.hash.replace('#', '')
  const initialOpen = plan?.sessions.find((session) => session.key === hashKey)?.key
    ?? plan?.sessions.find((session) => session.weekday === todayIndex)?.key ?? plan?.sessions[0]?.key
  const [open, setOpen] = useState<Set<string>>(() => new Set(initialOpen ? [initialOpen] : []))
  const [seenHash, setSeenHash] = useState(hashKey)
  if (seenHash !== hashKey) {
    setSeenHash(hashKey)
    if (hashKey) setOpen((current) => new Set([...current, hashKey]))
  }
  useEffect(() => {
    if (hashKey) document.getElementById(hashKey)?.scrollIntoView({ block: 'start' })
  }, [hashKey])
  if (!data) throw new Error('Journal data is unavailable')

  function show(key: string) {
    setOpen((current) => new Set([...current, key]))
    requestAnimationFrame(() => {
      const target = document.getElementById(key)
      target?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      target?.querySelector('summary')?.focus({ preventScroll: true })
    })
  }

  async function remove() {
    setError(null)
    try { await execute({ type: 'plan.delete' }); setDeleting(false); feedback('Plan usunięty. Odpowiedzi z ankiety również.') }
    catch (cause) { setError(errorMessage(cause)) }
  }

  if (!plan) return <>
    <header className="page-header"><div><h1>Plan treningowy</h1><p>Rozpisany tydzień treningów dopasowany do Ciebie.</p></div></header>
    {data.training.unreadable && <Notice tone="error">Nie udało się odczytać zapisanego planu — mógł powstać w starszej wersji aplikacji. Utwórz go ponownie; poprzednie odpowiedzi nie zostały użyte.</Notice>}
    <section className="panel">
      <EmptyState title="Ułóż swój plan treningowy" action={<Link className="button button-primary" to="/plan/new"><ClipboardList size={17} aria-hidden="true" />Stwórz plan</Link>}>
        Odpowiesz na kilka pytań: cel, miejsce i sprzęt, doświadczenie, dni i czas oraz zdrowie. Każdy trening dostaniesz z rozgrzewką, seriami, przerwami, wskazówkami techniki i rozciąganiem.
      </EmptyState>
    </section>
  </>

  const sessionsByDay = new Map(plan.sessions.map((session, index) => [session.weekday, { session, index }]))
  return <>
    <header className="page-header">
      <div><h1>Twój plan treningowy</h1><p>{planSummary(plan.answers)}</p></div>
      <Link className="button button-secondary" to="/plan/new"><RefreshCw size={17} aria-hidden="true" />Zmień odpowiedzi</Link>
    </header>
    <section aria-labelledby="plan-week-title">
      <h2 id="plan-week-title" className="sr-only">Tydzień treningowy</h2>
      <ol className="plan-week">
        {weekdayShort.map((label, day) => {
          const entry = sessionsByDay.get(day)
          const dayName = `${weekdayNames[day]}${day === todayIndex ? ' (dziś)' : ''}: `
          return <li key={label} className={entry ? 'training' : undefined} aria-current={day === todayIndex ? 'date' : undefined}>
            <span className="plan-week-day" aria-hidden="true">{label}{day === todayIndex && <em> · dziś</em>}</span>
            {entry ? <button type="button" onClick={() => show(entry.session.key)}>
              <span className="sr-only">{dayName}</span>
              <strong><span className="plan-week-prefix">Dzień </span>{entry.index + 1}</strong>
              <small>{sessionShortName(entry.session.kind)}</small>
            </button>
              : <span className="plan-week-rest"><span aria-hidden="true">—</span><span className="sr-only">{dayName}odpoczynek</span></span>}
          </li>
        })}
      </ol>
    </section>
    <div className="plan-sessions">
      {plan.sessions.map((session, index) => <Session key={session.key} session={session} index={index} plan={plan}
        open={open.has(session.key)} onToggle={(value) => setOpen((current) => {
          const nextOpen = new Set(current)
          if (value) nextOpen.add(session.key)
          else nextOpen.delete(session.key)
          return nextOpen
        })} />)}
    </div>
    <div className="plan-guidance">
      <section className="panel">
        <h2>Jak robić postępy</h2>
        <ol className="guidance-steps">{progressionSteps(plan.answers).map((step) => <li key={step.title}><strong>{step.title}</strong><p>{step.text}</p></li>)}</ol>
        <ul className="guidance-list">{goalNotes(plan.answers).map((note) => <li key={note}>{note}</li>)}</ul>
      </section>
      <section className="panel">
        <h2>Bezpieczeństwo</h2>
        <ul className="guidance-list">{safetyNotes(plan.answers).map((note) => <li key={note}>{note}</li>)}</ul>
        <h2 className="guidance-subtitle">Jak czytać plan</h2>
        <dl className="guidance-terms">
          <div><dt>Zapas powtórzeń</dt><dd>„Zostaw 2 powtórzenia w zapasie” oznacza, że kończysz serię, gdy zostały Ci jeszcze 2 dobre technicznie powtórzenia.</dd></div>
          <div><dt>Tempo 3-0-1</dt><dd>3 s opuszczania, bez pauzy, 1 s podnoszenia.</dd></div>
          <div><dt>Superseria i obwód</dt><dd>Ćwiczenia z tą samą literą wykonujesz po kolei, a przerwę robisz po całej rundzie.</dd></div>
          <div><dt>Przerwa</dt><dd>{`Czas odpoczynku między seriami, np. ${duration(90)}.`}</dd></div>
        </dl>
      </section>
    </div>
    <div className="plan-footer">
      <small>Plan utworzony {new Date(plan.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}. Plan to ogólne wskazówki treningowe, a nie porada medyczna.</small>
      <Button variant="ghost" onClick={() => { setError(null); setDeleting(true) }}><Trash2 size={16} aria-hidden="true" />Usuń plan</Button>
    </div>
    {deleting && <Confirm title="Usunąć plan treningowy?" confirmLabel="Usuń plan" cancelLabel="Zachowaj plan" busy={pending} error={error}
      onClose={() => setDeleting(false)} onConfirm={() => { void remove() }}>
      Usuniemy plan i odpowiedzi z ankiety, w tym informacje o zdrowiu. Zapisane treningi w dzienniku zostaną.
    </Confirm>}
  </>
}

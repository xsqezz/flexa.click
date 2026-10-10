import { useState } from 'react'
import { CalendarCheck, ClipboardList, Play, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { weekdayNames, weekdayShort, type PlanSession, type TrainingPlan } from '../../../shared/training'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { today } from '../lib/dates'
import {
  duration, exercisesLabel, goalNotes, planSummary, plannedWorkout, progressionSteps, safetyNotes, sessionTitle, weekdayIndex,
} from '../lib/training/format'
import { findExercise } from '../lib/training/library'
import { progressScope, readProgress } from '../lib/training/progress'
import { workoutSteps } from '../lib/training/steps'
import { SectionIcon, useWorkspace } from '../components/Workspace'
import { useFeedback } from '../components/Feedback'
import { Button, Confirm, EmptyState, Notice, errorMessage } from '../components/ui'

type Resume = { session: string; step: number; total: number } | null

function SessionCard({ session, index, plan, resume }: { session: PlanSession; index: number; plan: TrainingPlan; resume: Resume }) {
  const { openPlannedWorkout } = useWorkspace()
  const names = [...new Set(session.blocks.flatMap((block) => block.items.map((item) => findExercise(item.exercise)?.name ?? 'Ćwiczenie')))]
  const isToday = weekdayIndex(today()) === session.weekday
  const current = resume?.session === session.key ? resume : null
  return <article className="panel plan-day" aria-labelledby={`${session.key}-title`}>
    <span className="plan-day-badge" aria-hidden="true">{weekdayShort[session.weekday]}</span>
    <div className="plan-day-main">
      <h2 id={`${session.key}-title`}>{sessionTitle(session, index, plan.answers.goal)}</h2>
      <p className="plan-day-meta">{weekdayNames[session.weekday]}{isToday ? ' · dziś' : ''} · ok. {session.minutes} min · {exercisesLabel(names.length)}</p>
      <p className="plan-day-exercises">{names.join(' · ')}</p>
    </div>
    <div className="plan-day-actions">
      <Link className="button button-primary" to={`/plan/${session.key}`}>
        {current ? <><RotateCcw size={17} aria-hidden="true" />Wznów · krok {current.step} z {current.total}</> : <><Play size={17} aria-hidden="true" />Rozpocznij trening</>}
      </Link>
      <Button variant="ghost" onClick={() => openPlannedWorkout(plannedWorkout(session, index, plan.answers.goal))}>
        <CalendarCheck size={17} aria-hidden="true" />Zapisz jako wykonany
      </Button>
    </div>
  </article>
}

export function PlanPage() {
  const { data, execute, pending } = useJournal()
  const auth = useAuth()
  const feedback = useFeedback()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!data) throw new Error('Journal data is unavailable')
  const plan = data.training.plan

  async function remove() {
    setError(null)
    try { await execute({ type: 'plan.delete' }); setDeleting(false); feedback('Plan usunięty. Odpowiedzi z ankiety również.') }
    catch (cause) { setError(errorMessage(cause)) }
  }

  if (!plan) return <>
    <header className="page-header"><div className="page-heading"><SectionIcon /><div><h1>Plan treningowy</h1><p>Rozpisany tydzień treningów dopasowany do Ciebie.</p></div></div></header>
    {data.training.unreadable && <Notice tone="error">Nie udało się odczytać zapisanego planu — mógł powstać w starszej wersji aplikacji. Utwórz go ponownie; poprzednie odpowiedzi nie zostały użyte.</Notice>}
    <section className="panel">
      <EmptyState title="Ułóż swój plan treningowy" action={<Link className="button button-primary" to="/plan/new"><ClipboardList size={17} aria-hidden="true" />Stwórz plan</Link>}>
        Odpowiesz na kilka pytań: cel, miejsce i sprzęt, doświadczenie, dni i czas oraz zdrowie. Potem trening poprowadzi Cię krok po kroku: ćwiczenie, seria, przerwa ze stoperem i film pokazujący technikę.
      </EmptyState>
    </section>
  </>

  const saved = readProgress(progressScope(auth.mode, auth.session?.user.id), plan.createdAt)
  const savedSession = saved ? plan.sessions.find((session) => session.key === saved.session) : undefined
  const resume: Resume = saved && savedSession ? { session: saved.session, step: saved.index + 1, total: workoutSteps(savedSession).length } : null
  return <>
    <header className="page-header">
      <div className="page-heading"><SectionIcon /><div><h1>Twój plan treningowy</h1><p>{planSummary(plan.answers)}</p></div></div>
      <Link className="button button-secondary" to="/plan/new"><RefreshCw size={17} aria-hidden="true" />Zmień odpowiedzi</Link>
    </header>
    <div className="plan-days">
      {plan.sessions.map((session, index) => <SessionCard key={session.key} session={session} index={index} plan={plan} resume={resume} />)}
    </div>
    <div className="plan-guidance">
      <section className="panel">
        <h2>Bezpieczeństwo</h2>
        <ul className="guidance-list">{safetyNotes(plan.answers).map((note) => <li key={note}>{note}</li>)}</ul>
      </section>
      <details className="panel plan-more">
        <summary>Jak robić postępy i czytać plan</summary>
        <ol className="guidance-steps">{progressionSteps(plan.answers).map((step) => <li key={step.title}><strong>{step.title}</strong><p>{step.text}</p></li>)}</ol>
        <ul className="guidance-list">{goalNotes(plan.answers).map((note) => <li key={note}>{note}</li>)}</ul>
        <dl className="guidance-terms">
          <div><dt>Zapas powtórzeń</dt><dd>„Zostaw 2 powtórzenia w zapasie” oznacza, że kończysz serię, gdy zostały Ci jeszcze 2 dobre technicznie powtórzenia.</dd></div>
          <div><dt>Tempo 3-0-1</dt><dd>3 s opuszczania, bez pauzy, 1 s podnoszenia.</dd></div>
          <div><dt>Superseria i obwód</dt><dd>Ćwiczenia z tą samą literą wykonujesz po kolei, a przerwę robisz po całej rundzie.</dd></div>
          <div><dt>Przerwa</dt><dd>{`Po kliknięciu „Skończone” stoper odlicza zaplanowany odpoczynek, np. ${duration(90)}, i sam przechodzi dalej.`}</dd></div>
        </dl>
      </details>
    </div>    <div className="plan-footer">
      <small>Plan utworzony {new Date(plan.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}. Plan to ogólne wskazówki treningowe, a nie porada medyczna.</small>
      <Button variant="ghost" onClick={() => { setError(null); setDeleting(true) }}><Trash2 size={16} aria-hidden="true" />Usuń plan</Button>
    </div>
    {deleting && <Confirm title="Usunąć plan treningowy?" confirmLabel="Usuń plan" cancelLabel="Zachowaj plan" busy={pending} error={error}
      onClose={() => setDeleting(false)} onConfirm={() => { void remove() }}>
      Usuniemy plan i odpowiedzi z ankiety, w tym informacje o zdrowiu. Zapisane treningi w dzienniku zostaną.
    </Confirm>}
  </>
}

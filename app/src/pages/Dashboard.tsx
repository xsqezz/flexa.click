import { ArrowUpRight, ChefHat, ClipboardList, Footprints, Target, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { weekdayNames } from '../../../shared/training'
import { useJournal } from '../lib/Journal'
import { dateLabel, today } from '../lib/dates'
import { cycleNames, effectiveCycle } from '../lib/goals'
import { integerFormat, numberFormat, pace } from '../lib/nutrition'
import { sessionShortName, sessionTitle, weekdayIndex } from '../lib/training/format'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { EmptyState, SectionHeading } from '../components/ui'
import { FirstSteps } from '../components/FirstSteps'

function PlanNote({ date }: { date: string }) {
  const { data } = useJournal()
  const plan = data?.training.plan
  if (!plan) return <p className="plan-note"><ClipboardList size={17} aria-hidden="true" />
    <span>Nie masz jeszcze planu treningowego. <Link to="/plan/new">Ułóż plan w 2 minuty</Link></span></p>
  const day = weekdayIndex(date)
  const index = plan.sessions.findIndex((session) => session.weekday === day)
  if (index >= 0) {
    const session = plan.sessions[index]
    return <p className="plan-note"><ClipboardList size={17} aria-hidden="true" />
      <span>W planie na ten dzień: {sessionTitle(session, index, plan.answers.goal)} · ok. {session.minutes} min. <Link to={`/plan/${session.key}`}>Rozpocznij trening</Link></span></p>
  }
  const nextIndex = plan.sessions.findIndex((session) => session.weekday > day)
  const next = plan.sessions[nextIndex >= 0 ? nextIndex : 0]
  return <p className="plan-note"><ClipboardList size={17} aria-hidden="true" />
    <span>Dziś odpoczynek od planu. Najbliższy trening: {weekdayNames[next.weekday]} — <Link to="/plan">{sessionShortName(next.kind)}</Link></span></p>
}

export function Dashboard() {
  const { data } = useJournal()
  const { date, openWorkout } = useWorkspace()
  if (!data) throw new Error('Journal data is unavailable')
  const meals = data.meals.filter((meal) => meal.date === date)
  const workout = data.workouts.filter((item) => item.date === date).at(-1)
  const cycle = effectiveCycle(data)
  return <>
    <PageHeader title={date === today() ? 'Dzisiaj, w Twoim rytmie' : 'Twój dziennik'}
      description={`${dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })} · Cześć, ${data.profile.displayName}. Małe kroki też się liczą.`} />
    <div className="page-toolbar"><DateControl /><Link to="/progress" className="text-link">Zobacz swoje postępy <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    <FirstSteps />
    <div className="today-layout">
      <section className="panel activity-preview">
        <SectionHeading title="Trening w planie" to="/plan">Treningi</SectionHeading>
        <PlanNote date={date} />
        {workout ? <div className="activity-preview-content">
          <span className="activity-symbol"><Footprints size={25} aria-hidden="true" /></span>
          <div><h3>{workout.name}</h3><p>{workout.importHash ? 'Import własnego pliku' : 'Twój zapis'} · {integerFormat.format(workout.minutes)} min</p></div>
          <div className="activity-numbers">
            <strong>{workout.distanceKm !== null ? `${numberFormat.format(workout.distanceKm)} km` : `${integerFormat.format(workout.minutes)} min`}</strong>
            <span>{pace(workout) ? `${pace(workout)} min/km` : workout.effort ? `Odczuwalny wysiłek ${workout.effort}/10` : 'We własnym tempie'}</span>
          </div>
        </div> : <EmptyState title="Miejsce na Twój ruch" action={<button className="text-link" onClick={openWorkout}>Dodaj aktywność</button>}>
          Spacer, siłownia czy rower? Zapisz to, co dziś zrobiło Ci dobrze.
        </EmptyState>}
      </section>
      <div className="today-quick-links">
        <Link to="/goals" className="today-quick-link"><Target size={20} aria-hidden="true" /><span><strong>Twoje cele</strong>
          <small>{cycle ? `Bieżący cykl: ${cycleNames[cycle.kind]}` : 'Zobacz cel i dzienny bilans'}</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>
        <Link to="/meals" className="today-quick-link"><Utensils size={20} aria-hidden="true" /><span><strong>Posiłki tego dnia</strong>
          <small>{meals.length ? `${meals.length} ${meals.length === 1 ? 'wpis' : meals.length < 5 ? 'wpisy' : 'wpisów'} · otwórz listę` : 'Otwórz listę i dodaj posiłek'}</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>
        <Link to="/kitchen" className="today-quick-link"><ChefHat size={20} aria-hidden="true" /><span><strong>Nie wiesz, co zjeść?</strong>
          <small>Ułóż przepis z tego, co masz w domu</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
    </div>
  </>
}

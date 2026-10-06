import { ArrowUpRight, Footprints, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJournal } from '../lib/Journal'
import { dateLabel, today } from '../lib/dates'
import { integerFormat, numberFormat, pace } from '../lib/nutrition'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { NutritionSummary, WaterPanel, WeeklyActivity } from '../components/Summaries'
import { MealList } from '../components/MealList'
import { EmptyState, SectionHeading } from '../components/ui'

export function Dashboard() {
  const { data } = useJournal()
  const { date, openWorkout } = useWorkspace()
  if (!data) throw new Error('Journal data is unavailable')
  const meals = data.meals.filter((meal) => meal.date === date)
  const workout = data.workouts.filter((item) => item.date === date).at(-1)
  return <>
    <PageHeader title={date === today() ? 'Dzisiaj, w Twoim rytmie' : 'Twój dziennik'}
      description={`${dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })} · Cześć, ${data.profile.displayName}. Małe kroki też się liczą.`} />
    <div className="page-toolbar"><DateControl /><Link to="/progress" className="text-link">Zobacz swoje postępy <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <NutritionSummary meals={meals} profile={data.profile} />
        <section className="panel meal-panel">
          <SectionHeading title="Twoje posiłki" to="/journal">Cały dziennik</SectionHeading>
          <MealList date={date} />
        </section>
        <section className="panel activity-preview">
          <SectionHeading title="Twoja aktywność" to="/workouts">Wszystkie treningi</SectionHeading>
          {workout ? <div className="activity-preview-content">
            <span className="activity-symbol"><Footprints size={25} aria-hidden="true" /></span>
            <div><h3>{workout.name}</h3><p>{workout.importHash ? 'Import własnego pliku' : 'Twój zapis'} · {integerFormat.format(workout.minutes)} min</p></div>
            <div className="activity-numbers">
              <strong>{workout.distanceKm !== null ? `${numberFormat.format(workout.distanceKm)} km` : `${integerFormat.format(workout.minutes)} min`}</strong>
              <span>{pace(workout) ? `${pace(workout)} min/km` : workout.effort ? `Odczuwalny wysiłek ${workout.effort}/10` : 'We własnym tempie'}</span>
            </div>
          </div> : <EmptyState title="Miejsce na Twój ruch" action={<button className="text-link" onClick={openWorkout}>Dodaj pierwszą aktywność</button>}>
            Spacer, siłownia czy rower? Zapisz to, co dziś zrobiło Ci dobrze.
          </EmptyState>}
        </section>
      </div>
      <aside className="dashboard-aside" aria-label="Ruch i nawodnienie">
        <WeeklyActivity data={data} date={date} />
        <WaterPanel data={data} date={date} />
        <section className="quiet-note"><Sparkles size={20} aria-hidden="true" /><div><h3>Nie musisz robić wszystkiego.</h3><p>Dziennik jest dla Ciebie, nie odwrotnie. Zapisz tyle, ile dziś potrzebujesz.</p></div></section>
      </aside>
    </div>
  </>
}

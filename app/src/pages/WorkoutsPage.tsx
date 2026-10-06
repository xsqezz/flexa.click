import { useState } from 'react'
import { Bike, Dumbbell, Footprints, Trash2 } from 'lucide-react'
import { workoutNames, type Workout } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { dateLabel, shiftDate } from '../lib/dates'
import { integerFormat, numberFormat, pace, workoutLoad } from '../lib/nutrition'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { Confirm, EmptyState, errorMessage } from '../components/ui'
import { useFeedback } from '../components/Feedback'

export function WorkoutsPage() {
  const { data, execute, pending } = useJournal()
  const { date, openWorkout } = useWorkspace()
  const feedback = useFeedback()
  const [range, setRange] = useState(30)
  const [deleting, setDeleting] = useState<Workout | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!data) throw new Error('Journal data is unavailable')
  const workouts = data.workouts.filter((workout) => workout.date <= date && (range === 0 || workout.date >= shiftDate(date, -range + 1)))
    .sort((a, b) => b.date.localeCompare(a.date))
  async function remove() {
    if (!deleting) return
    setError(null)
    try { await execute({ type: 'workout.delete', id: deleting.id }); setDeleting(null); feedback('Trening usunięty.') }
    catch (cause) { setError(errorMessage(cause)) }
  }
  return <>
    <PageHeader title="Treningi po Twojemu" description="Każda aktywność ma swoje miejsce. Bez rankingów i presji." primary="workout" />
    <div className="page-toolbar"><DateControl /><div className="range-selector" aria-label="Okres aktywności">
      {[7, 30, 0].map((value) => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value ? `${value} dni` : 'Wszystkie'}</button>)}
    </div></div>
    <div className="overview-strip">
      <div><small>Aktywności w okresie</small><strong>{workouts.length}</strong></div>
      <div><small>Łączny czas</small><strong>{integerFormat.format(workouts.reduce((sum, workout) => sum + workout.minutes, 0))} min</strong></div>
      <div><small>Zapisany dystans</small><strong>{numberFormat.format(workouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0))} km</strong></div>
    </div>
    <div className="workouts-list">
      {workouts.length === 0 && <section className="panel"><EmptyState title="Pierwszy trening czeka na zapis" action={<button className="button button-primary" onClick={openWorkout}>Dodaj aktywność</button>}>Zapisz spacer, bieg, siłownię albo zaimportuj własny plik GPX lub TCX.</EmptyState></section>}
      {workouts.map((workout) => {
        const Icon = workout.kind === 'ride' ? Bike : workout.kind === 'strength' ? Dumbbell : Footprints
        const load = workoutLoad(workout)
        return <article className="panel workout-item" key={workout.id}>
          <span className="activity-symbol"><Icon size={24} aria-hidden="true" /></span>
          <div className="workout-item-main"><h2>{workout.name}</h2><p>{dateLabel(workout.date)} · {workoutNames[workout.kind]} · {workout.importHash ? 'Import pliku' : 'Wpis ręczny'}</p>
            <div className="workout-values">
              <div><small>Czas</small><strong>{numberFormat.format(workout.minutes)} min</strong></div>
              {workout.distanceKm !== null && <div><small>Dystans</small><strong>{numberFormat.format(workout.distanceKm)} km</strong></div>}
              {pace(workout) && <div><small>Średnie tempo</small><strong>{pace(workout)} /km</strong></div>}
              {workout.calories !== null && <div><small>Energia — szacunek</small><strong>{integerFormat.format(workout.calories)} kcal</strong></div>}
              {load !== null && <div><small>Obciążenie · min × RPE</small><strong>{integerFormat.format(load)}</strong></div>}
              {workout.elevationM !== null && <div><small>Suma przewyższeń</small><strong>{integerFormat.format(workout.elevationM)} m</strong></div>}
            </div>
          </div>
          <button className="icon-button" aria-label={`Usuń trening: ${workout.name}`} onClick={() => { setError(null); setDeleting(workout) }}><Trash2 size={17} /></button>
        </article>
      })}
    </div>
    <p className="source-credit">Import działa bez zewnętrznego konta. Integracja API Stravy jest wyłączona: jej regulamin wymaga, aby aplikacja nie konkurowała z jej funkcjami. <a href="https://www.strava.com/legal/api" target="_blank" rel="noreferrer">Poznaj ograniczenia</a>.</p>
    {deleting && <Confirm title="Usunąć trening?" onClose={() => setDeleting(null)} onConfirm={() => { void remove() }} busy={pending} error={error}>
      „{deleting.name}” z {dateLabel(deleting.date)}. Jeśli trening pochodzi z pliku, po usunięciu możesz zaimportować go ponownie.
    </Confirm>}
  </>
}

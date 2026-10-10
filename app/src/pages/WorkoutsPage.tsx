import { useState } from 'react'
import { Bike, BookmarkPlus, ChevronRight, Dumbbell, Footprints, Repeat, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { workoutNames } from '../../../shared/domain'
import { useFeedback } from '../components/Feedback'
import { useJournal } from '../lib/Journal'
import { dateLabel, shiftDate } from '../lib/dates'
import { integerFormat, numberFormat, pace, workoutLoad } from '../lib/nutrition'
import { exerciseName, formatSet } from '../lib/training/sets'
import { plural } from '../lib/templates'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { EmptyState, errorMessage } from '../components/ui'

export function WorkoutsPage() {
  const { data, execute, removeWithUndo } = useJournal()
  const feedback = useFeedback()
  const { date, openWorkout, openPlannedWorkout } = useWorkspace()
  const [range, setRange] = useState(30)
  if (!data) throw new Error('Journal data is unavailable')
  const workouts = data.workouts.filter((workout) => workout.date <= date && (range === 0 || workout.date >= shiftDate(date, -range + 1)))
    .sort((a, b) => b.date.localeCompare(a.date))
  return <>
    <PageHeader title="Ruch" description="Spacery, biegi i treningi. Bez rankingów." />
    <div className="page-toolbar"><DateControl /><div className="range-selector" aria-label="Okres aktywności">
      {[7, 30, 0].map((value) => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value ? `${value} dni` : 'Wszystkie'}</button>)}
    </div></div>
    <p className="stat-line" aria-label="Podsumowanie okresu">
      <strong>{workouts.length}</strong> {plural(workouts.length, ['aktywność', 'aktywności', 'aktywności'])} · <strong>{integerFormat.format(workouts.reduce((sum, workout) => sum + workout.minutes, 0))}</strong> min · <strong>{numberFormat.format(workouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0))}</strong> km
    </p>
    {data.workoutTemplates.length > 0 && <section className="panel my-workouts" aria-labelledby="my-workouts-title">
      <h2 id="my-workouts-title">Moje treningi</h2>
      <ul className="my-workouts-list">{data.workoutTemplates.map((template) => <li key={template.id}>
          <span className="my-workouts-name"><strong>{template.name}</strong>
            <small>{workoutNames[template.kind]} · {numberFormat.format(template.minutes)} min{template.sets.length ? ` · serie: ${template.sets.length}` : ''}</small></span>
          <button type="button" className="button button-secondary" aria-label={`Zapisz dziś: ${template.name}`}
            onClick={() => openPlannedWorkout({ name: template.name, kind: template.kind, minutes: template.minutes, sets: template.sets.length ? template.sets : undefined, origin: 'template' })}>Zapisz dziś</button>
          <button type="button" className="icon-button" aria-label={`Usuń własny trening: ${template.name}`}
            onClick={() => removeWithUndo({ type: 'wtemplate.delete', id: template.id }, `Usunięto własny trening „${template.name}”.`)}><Trash2 size={17} /></button>
        </li>)}</ul>
    </section>}
    <p className="workouts-links"><Link className="text-link" to="/workouts/exercises">Historia ćwiczeń: serie, ciężary i objętość<ChevronRight size={15} aria-hidden="true" /></Link></p>
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
            {workout.sets && workout.sets.length > 0 && <details className="workout-sets">
              <summary>Serie: {workout.sets.length}</summary>
              <ul>{[...new Set(workout.sets.map((set) => set.exercise))].map((exercise) => <li key={exercise}>
                <strong>{exerciseName(exercise)}</strong> {workout.sets?.filter((set) => set.exercise === exercise).map(formatSet).join(', ')}
              </li>)}</ul>
            </details>}
            <div className="workout-item-actions">
              {workout.name.trim().length <= 60 && !data.workoutTemplates.some((template) => template.name.trim().toLocaleLowerCase('pl-PL') === workout.name.trim().toLocaleLowerCase('pl-PL')) &&
                <button type="button" className="text-link" aria-label={`Zapisz jako własny trening: ${workout.name}`}
                  onClick={() => {
                    void execute({ type: 'wtemplate.save', value: { name: workout.name, kind: workout.kind, minutes: workout.minutes, sets: workout.sets ?? [] } })
                      .then(() => feedback(`Zapisano „${workout.name}” w Moich treningach.`))
                      .catch((cause: unknown) => feedback(errorMessage(cause), { tone: 'error' }))
                  }}><BookmarkPlus size={16} aria-hidden="true" />Zapisz jako własny</button>}
              <button type="button" className="button button-secondary" aria-label={`Powtórz dziś: ${workout.name}`}
                onClick={() => openPlannedWorkout({ name: workout.name, kind: workout.kind, minutes: workout.minutes, distanceKm: workout.distanceKm, sets: workout.sets, origin: 'repeat' })}>
                <Repeat size={16} aria-hidden="true" />Powtórz dziś</button>
            </div>
          </div>
          <button className="icon-button" aria-label={`Usuń trening: ${workout.name}`}
            onClick={() => removeWithUndo({ type: 'workout.delete', id: workout.id }, `Usunięto trening „${workout.name}” z ${dateLabel(workout.date)}.`)}><Trash2 size={17} /></button>
        </article>
      })}
    </div>
    <p className="source-credit">Import działa bez zewnętrznego konta. Integracja API Stravy jest wyłączona: jej regulamin wymaga, aby aplikacja nie konkurowała z jej funkcjami. <a href="https://www.strava.com/legal/api" target="_blank" rel="noreferrer">Poznaj ograniczenia</a>.</p>
  </>
}

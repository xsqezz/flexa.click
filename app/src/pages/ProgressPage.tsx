import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Measurement } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { daysEndingAt, dateLabel, shiftDate } from '../lib/dates'
import { integerFormat, numberFormat, nutritionTotal, workoutLoad } from '../lib/nutrition'
import { BarChart, LineChart } from '../components/Charts'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { Confirm, errorMessage } from '../components/ui'
import { useFeedback } from '../components/Feedback'

export function ProgressPage() {
  const { data, execute, pending } = useJournal()
  const { date } = useWorkspace()
  const feedback = useFeedback()
  const [range, setRange] = useState(30)
  const [deleting, setDeleting] = useState<Measurement | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!data) throw new Error('Journal data is unavailable')
  const start = shiftDate(date, -range + 1)
  const days = daysEndingAt(date, range)
  const nutrition = days.map((day) => {
    const meals = data.meals.filter((meal) => meal.date === day)
    return { date: day, value: meals.length ? nutritionTotal(meals, 'kcal').value : null }
  })
  const load = days.map((day) => {
    const workouts = data.workouts.filter((workout) => workout.date === day)
    const values = workouts.map(workoutLoad)
    return { date: day, value: !values.length || values.some((value) => value === null) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0) }
  })
  const measurements = data.measurements.filter((measurement) => measurement.date >= start && measurement.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date))
  const recorded = nutrition.filter((point) => point.value !== null)
  const average = recorded.length ? recorded.reduce((sum, point) => sum + (point.value ?? 0), 0) / recorded.length : null
  async function remove() {
    if (!deleting) return
    setError(null)
    try { await execute({ type: 'measurement.delete', id: deleting.id }); setDeleting(null); feedback('Pomiar usunięty.') }
    catch (cause) { setError(errorMessage(cause)) }
  }
  return <>
    <PageHeader title="Postępy bez pośpiechu" description="Spójrz na całość, nie na jeden dzień. Twoje dane, bez abonamentu." primary="measurement" />
    <div className="page-toolbar"><DateControl /><div className="range-selector" aria-label="Okres analizy">
      {[7, 30, 90].map((value) => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value} dni</button>)}
    </div></div>
    <div className="overview-strip">
      <div><small>Dni z zapisem jedzenia</small><strong>{recorded.length} / {range}</strong></div>
      <div><small>Średnio — zapisane dni</small><strong>{average === null ? '—' : `${integerFormat.format(average)} kcal`}</strong></div>
      <div><small>Ostatni pomiar w okresie</small><strong>{measurements.length ? `${numberFormat.format(measurements.at(-1)?.weightKg ?? 0)} kg` : '—'}</strong></div>
    </div>
    <section className="panel chart-section"><h2>Energia w dzienniku</h2><p>To suma zapisów, nie ocena diety. Dni bez wpisów nie wchodzą do średniej. Przerywana linia oznacza obecny cel.</p>
      <BarChart points={nutrition} label="Energia w dzienniku" unit="kcal" goal={data.profile.calorieGoal} />
    </section>
    <div className="settings-grid">
      <section className="panel chart-section"><h2>Historia pomiarów</h2><p>Naturalne wahania są częścią historii. Wykres nie jest diagnozą ani prognozą.</p>
        <LineChart points={measurements.map((measurement) => ({ date: measurement.date, value: measurement.weightKg }))} label="Masa ciała" />
        {measurements.length > 0 && <div className="table-scroll"><table><caption className="sr-only">Zarządzanie pomiarami</caption><thead><tr><th scope="col">Data</th><th scope="col">Masa</th><th scope="col">Akcja</th></tr></thead>
          <tbody>{measurements.map((measurement) => <tr key={measurement.id}><td>{dateLabel(measurement.date)}</td><td>{numberFormat.format(measurement.weightKg)} kg</td><td>
            <button className="icon-button" aria-label={`Usuń pomiar z ${dateLabel(measurement.date)}`} onClick={() => { setError(null); setDeleting(measurement) }}><Trash2 size={16} /></button>
          </td></tr>)}</tbody>
        </table></div>}
      </section>
      <section className="panel chart-section"><h2>Obciążenie odczuwalne</h2><p>Minuty × Twój wysiłek RPE. To prosty, subiektywny wskaźnik — nie medyczna miara zmęczenia. Dzień bez pełnego RPE pozostaje bez oszacowania.</p>
        <BarChart points={load} label="Obciążenie odczuwalne" unit="min × RPE" />
      </section>
    </div>
    {deleting && <Confirm title="Usunąć pomiar?" onClose={() => setDeleting(null)} onConfirm={() => { void remove() }} busy={pending} error={error}>
      {dateLabel(deleting.date)}: {numberFormat.format(deleting.weightKg)} kg. Pozostałe pomiary zostaną zachowane.
    </Confirm>}
  </>
}

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useJournal } from '../lib/Journal'
import { daysEndingAt, dateLabel, shiftDate } from '../lib/dates'
import { integerFormat, numberFormat, workoutLoad } from '../lib/nutrition'
import { BarChart, LineChart } from '../components/Charts'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { movingAverage } from '../lib/trend'
import { plural } from '../lib/templates'

export function ProgressPage() {
  const { data, removeWithUndo } = useJournal()
  const { date } = useWorkspace()
  const [range, setRange] = useState(30)
  if (!data) throw new Error('Journal data is unavailable')
  const start = shiftDate(date, -range + 1)
  const days = daysEndingAt(date, range)
  const load = days.map((day) => {
    const workouts = data.workouts.filter((workout) => workout.date === day)
    const values = workouts.map(workoutLoad)
    return { date: day, value: !values.length || values.some((value) => value === null) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0) }
  })
  const measurements = data.measurements.filter((measurement) => measurement.date >= start && measurement.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date))
  const workouts = data.workouts.filter((workout) => workout.date >= start && workout.date <= date)
  const weightTrend = movingAverage(data.measurements.filter((measurement) => measurement.date <= date)
    .map((measurement) => ({ date: measurement.date, value: measurement.weightKg }))).filter((point) => point.date >= start)
  const extras = [
    { key: 'waistCm', label: 'Talia', unit: 'cm' },
    { key: 'hipsCm', label: 'Biodra', unit: 'cm' },
    { key: 'bodyFatPct', label: 'Tkanka tłuszczowa', unit: '%' },
  ] as const
  const shownExtras = extras.filter((extra) => measurements.some((measurement) => measurement[extra.key] != null))
  return <>
    <PageHeader title="Postępy bez pośpiechu" description="Spójrz na całość, nie na jeden dzień." />
    <div className="page-toolbar"><DateControl /><div className="range-selector" aria-label="Okres analizy">
      {[7, 30, 90].map((value) => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value} dni</button>)}
    </div></div>
    <p className="stat-line" aria-label="Podsumowanie okresu">
      <strong>{measurements.length}</strong> {plural(measurements.length, ['pomiar', 'pomiary', 'pomiarów'])} · ostatni <strong>{measurements.length ? `${numberFormat.format(measurements.at(-1)?.weightKg ?? 0)} kg` : '—'}</strong> · aktywność <strong>{integerFormat.format(workouts.reduce((sum, workout) => sum + workout.minutes, 0))}</strong> min
    </p>
    <div className="settings-grid">
      <section className="panel chart-section"><h2>Historia pomiarów</h2><p>Linia przerywana to średnia z 7 dni. Wahania są naturalne; wykres nie jest diagnozą.</p>
        <LineChart points={measurements.map((measurement) => ({ date: measurement.date, value: measurement.weightKg }))} label="Masa ciała" average={weightTrend} />
        {measurements.length > 0 && <div className="table-scroll"><table><caption className="sr-only">Zarządzanie pomiarami</caption><thead><tr><th scope="col">Data</th><th scope="col">Masa</th>
          {shownExtras.map((extra) => <th scope="col" key={extra.key}>{extra.label}</th>)}<th scope="col">Akcja</th></tr></thead>
          <tbody>{measurements.map((measurement) => <tr key={measurement.id}><td>{dateLabel(measurement.date)}</td><td>{numberFormat.format(measurement.weightKg)} kg</td>
            {shownExtras.map((extra) => <td key={extra.key}>{measurement[extra.key] == null ? '—' : `${numberFormat.format(measurement[extra.key] ?? 0)} ${extra.unit}`}</td>)}<td>
            <button className="icon-button" aria-label={`Usuń pomiar z ${dateLabel(measurement.date)}`}
              onClick={() => removeWithUndo({ type: 'measurement.delete', id: measurement.id }, `Usunięto pomiar z ${dateLabel(measurement.date)}: ${numberFormat.format(measurement.weightKg)} kg.`)}><Trash2 size={16} /></button>
          </td></tr>)}</tbody>
        </table></div>}
      </section>
      <section className="panel chart-section"><h2>Obciążenie odczuwalne</h2><p>Minuty × Twój wysiłek RPE — subiektywny wskaźnik, nie miara medyczna.</p>
        <BarChart points={load} label="Obciążenie odczuwalne" unit="min × RPE" />
      </section>
    </div>
  </>
}

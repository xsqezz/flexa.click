import type { Journal } from '../../../shared/domain'
import { dateLabel } from '../lib/dates'
import { integerFormat, numberFormat } from '../lib/nutrition'
import { weekSummary } from '../lib/week'

function weightChangeText(change: number | null, hasCurrent: boolean, hasPrevious: boolean) {
  if (!hasCurrent) return 'Brak pomiaru w tym tygodniu'
  if (!hasPrevious || change === null) return 'Brak pomiaru w poprzednim tygodniu do porównania'
  if (change === 0) return <><span aria-hidden="true">→ </span>Tyle samo co w poprzednim tygodniu</>
  return <><span aria-hidden="true">{change < 0 ? '↓ ' : '↑ '}</span>{numberFormat.format(Math.abs(change))} kg {change < 0 ? 'mniej' : 'więcej'} niż w poprzednim tygodniu</>
}

/** Plain numbers for the Monday–Sunday week of the selected date, next to the week before. */
export function WeekPanel({ data, date }: { data: Journal; date: string }) {
  const { current, previous, minutesGoal, weightChange } = weekSummary(data, date)
  const range = `${dateLabel(current.start, { day: 'numeric', month: 'short' })} – ${dateLabel(current.end, { day: 'numeric', month: 'short' })}`
  const kcal = (value: number | null) => value === null ? '—' : `${integerFormat.format(value)} kcal`
  const items = [
    { label: 'Dni z zapisem jedzenia', value: `${current.foodDays} / 7`, before: `${previous.foodDays} / 7` },
    { label: 'Średnio w dniach z zapisem', value: kcal(current.averageKcal), before: kcal(previous.averageKcal) },
    { label: minutesGoal > 0 ? 'Ruch wobec celu tygodnia' : 'Ruch', value: `${integerFormat.format(current.minutes)}${minutesGoal > 0 ? ` / ${integerFormat.format(minutesGoal)}` : ''} min`, before: `${integerFormat.format(previous.minutes)} min` },
    { label: 'Treningi', value: String(current.workouts), before: String(previous.workouts) },
    { label: 'Dni z celem wody', value: `${current.waterDays} / 7`, before: `${previous.waterDays} / 7` },
  ]
  return <section className="panel week-summary" aria-labelledby="week-summary-title">
    <div className="week-summary-head">
      <h2 id="week-summary-title">Twój tydzień</h2>
      <span>{range}</span>
    </div>
    <dl className="week-summary-grid">
      {items.map((item) => <div key={item.label}>
        <dt>{item.label}</dt>
        <dd><strong>{item.value}</strong><small>Poprzedni tydzień: {item.before}</small></dd>
      </div>)}
      <div>
        <dt>Ostatni pomiar masy</dt>
        <dd><strong>{current.weight ? `${numberFormat.format(current.weight.value)} kg` : '—'}</strong>
          <small>{weightChangeText(weightChange, current.weight !== null, previous.weight !== null)}</small></dd>
      </div>
    </dl>
    <p className="week-summary-note">Tydzień od poniedziałku do niedzieli. Średnia liczy tylko dni z wpisami — brak zapisu to nie zero.</p>
  </section>
}

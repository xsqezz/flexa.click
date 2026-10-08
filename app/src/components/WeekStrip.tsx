import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useJournal } from '../lib/Journal'
import { dateLabel, shiftDate, today, weekStart } from '../lib/dates'
import { integerFormat, nutritionTotal } from '../lib/nutrition'
import { useWorkspace } from './Workspace'

const weekdayShort = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd']

/** Tydzień w jednym rzędzie: dni z wpisami i suma kcal. Dotknięcie dnia otwiera go w dzienniku. */
export function WeekStrip() {
  const { data } = useJournal()
  const { date, setDate } = useWorkspace()
  if (!data) return null
  const start = weekStart(date)
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(start, index))
  const current = today()
  return <nav className="week-strip" aria-label={`Tydzień od ${dateLabel(start, { day: 'numeric', month: 'long' })}`} data-no-swipe>
    <button type="button" className="icon-button" aria-label="Poprzedni tydzień" onClick={() => setDate(shiftDate(date, -7))}><ChevronLeft size={18} /></button>
    <ol>
      {days.map((day, index) => {
        const meals = data.meals.filter((meal) => meal.date === day)
        const kcal = meals.length ? integerFormat.format(nutritionTotal(meals, 'kcal').value) : null
        const label = `${dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}${day === current ? ', dziś' : ''}: ${kcal ? `${kcal} kcal w dzienniku` : 'bez wpisów jedzenia'}`
        return <li key={day}>
          <button type="button" aria-pressed={day === date} aria-current={day === current ? 'date' : undefined} aria-label={label}
            className={day === date ? 'selected' : undefined} onClick={() => setDate(day)}>
            <span className="week-strip-day" aria-hidden="true">{weekdayShort[index]}</span>
            <strong aria-hidden="true">{Number(day.slice(8))}</strong>
            <small aria-hidden="true">{kcal ?? '—'}</small>
            {meals.length > 0 && <span className="week-strip-dot" aria-hidden="true" />}
          </button>
        </li>
      })}
    </ol>
    <button type="button" className="icon-button" aria-label="Następny tydzień" onClick={() => setDate(shiftDate(date, 7))}><ChevronRight size={18} /></button>
  </nav>
}

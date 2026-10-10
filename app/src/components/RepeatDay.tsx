import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { useJournal } from '../lib/Journal'
import { dateLabel } from '../lib/dates'
import { integerFormat, nutritionTotal } from '../lib/nutrition'
import { itemsLabel } from '../lib/templates'
import { useFeedback } from './Feedback'
import { Button, Field, errorMessage } from './ui'

const maxChoices = 14

/** "Powtórz dzień": while a day has no meals, offers to copy a whole earlier day (every meal group, same portions). */
export function RepeatDay({ date }: { date: string }) {
  const { data, execute, pending } = useJournal()
  const feedback = useFeedback()
  const [chosen, setChosen] = useState('')
  const days = useMemo(() => {
    if (!data) return []
    const byDate = new Map<string, typeof data.meals>()
    for (const meal of data.meals) if (meal.date < date) byDate.set(meal.date, [...(byDate.get(meal.date) ?? []), meal])
    return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, maxChoices)
  }, [data, date])
  if (!data || data.meals.some((meal) => meal.date === date) || !days.length) return null
  const source = chosen || days[0]![0]
  const meals = days.find(([day]) => day === source)?.[1] ?? []

  async function copy() {
    try {
      await execute({ type: 'meal.addMany', value: meals.map(({ food, portion, meal }) => ({ date, meal, food, portion })) })
      feedback(`Skopiowano ${itemsLabel(meals.length)} z dnia ${dateLabel(source, { day: 'numeric', month: 'long' })}.`)
    } catch (cause) { feedback(errorMessage(cause), { tone: 'error' }) }
  }

  return <section className="panel repeat-day" aria-labelledby="repeat-day-title">
    <h2 id="repeat-day-title">Powtórz dzień</h2>
    <p className="scan-lead">Jesz podobnie jak ostatnio? Skopiuj cały wcześniejszy dzień i popraw to, co było inaczej.</p>
    <div className="repeat-day-controls">
      <Field label="Który dzień skopiować">
        <select value={source} onChange={(event) => setChosen(event.target.value)}>
          {days.map(([day, list]) => <option key={day} value={day}>
            {dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })} · {integerFormat.format(nutritionTotal(list, 'kcal').value)} kcal
          </option>)}
        </select>
      </Field>
      <Button onClick={() => { void copy() }} busy={pending}><Copy size={17} aria-hidden="true" />Skopiuj ({itemsLabel(meals.length)})</Button>
    </div>
  </section>
}

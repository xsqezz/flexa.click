import { useState } from 'react'
import { Copy } from 'lucide-react'
import { mealNames, type MealKind } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { shiftDate, today } from '../lib/dates'
import { itemsLabel } from '../lib/templates'
import { useFeedback } from './Feedback'
import { errorMessage } from './ui'

/** "Z wczoraj": copies a meal group from the previous day, offered only while the group is still empty. */
export function CopyFromYesterday({ date, kind }: { date: string; kind: MealKind }) {
  const { data, execute } = useJournal()
  const feedback = useFeedback()
  const [busy, setBusy] = useState(false)
  if (!data) return null
  if (data.meals.some((meal) => meal.date === date && meal.meal === kind)) return null
  const previous = shiftDate(date, -1)
  const source = data.meals.filter((meal) => meal.date === previous && meal.meal === kind)
  if (!source.length || date <= '1900-01-01') return null
  const isToday = date === today()
  const visible = isToday ? 'Z wczoraj' : 'Z dnia wcześniej'
  async function copy() {
    setBusy(true)
    try {
      await execute({ type: 'meal.addMany', value: source.map(({ food, portion }) => ({ date, meal: kind, food, portion })) })
      feedback(`Skopiowano ${itemsLabel(source.length)} do: ${mealNames[kind]}.`)
    } catch (cause) { feedback(errorMessage(cause), { tone: 'error' }) }
    finally { setBusy(false) }
  }
  return <button type="button" className="text-link meal-copy" disabled={busy} aria-busy={busy || undefined}
    aria-label={`Kopiuj ${visible.toLowerCase()}: ${mealNames[kind]} (${itemsLabel(source.length)})`}
    onClick={() => { void copy() }}>
    <Copy size={15} aria-hidden="true" />{visible}
  </button>
}

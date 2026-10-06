import { useState } from 'react'
import { Apple, Coffee, Moon, Plus, Sun, Trash2, Utensils } from 'lucide-react'
import { mealNames, type Meal, type MealKind } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { integerFormat, numberFormat, nutritionTotal } from '../lib/nutrition'
import { sourceNames } from '../lib/sources'
import { useWorkspace } from './Workspace'
import { Confirm, errorMessage } from './ui'
import { useFeedback } from './Feedback'

const groups: { kind: MealKind; Icon: typeof Coffee }[] = [
  { kind: 'breakfast', Icon: Coffee }, { kind: 'lunch', Icon: Sun },
  { kind: 'dinner', Icon: Moon }, { kind: 'snack', Icon: Apple },
]

export function MealList({ date }: { date: string }) {
  const { data, execute, pending } = useJournal()
  const { openMeal } = useWorkspace()
  const feedback = useFeedback()
  const [deleting, setDeleting] = useState<Meal | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!data) throw new Error('Journal data is unavailable')
  async function remove() {
    if (!deleting) return
    setError(null)
    try { await execute({ type: 'meal.delete', id: deleting.id }); setDeleting(null); feedback('Usunięto wpis z dziennika.') }
    catch (cause) { setError(errorMessage(cause)) }
  }
  return <>
    {groups.map(({ kind, Icon }) => {
      const entries = data.meals.filter((meal) => meal.date === date && meal.meal === kind)
      return <div className="meal-group" key={kind}>
        <div className="meal-group-heading"><Icon size={18} aria-hidden="true" /><h3>{mealNames[kind]}</h3>
          <span>{integerFormat.format(nutritionTotal(entries, 'kcal').value)} kcal</span>
          <button className="icon-button" aria-label={`Dodaj do: ${mealNames[kind]}`} onClick={() => openMeal(kind)}><Plus size={17} /></button>
        </div>
        {entries.length ? entries.map((entry) => <div className="meal-row" key={entry.id}>
          <span className="food-mark"><Utensils size={16} aria-hidden="true" /></span>
          <div className="meal-row-info"><strong>{entry.food.name}</strong>
            <small>{numberFormat.format(entry.portion)} {entry.food.unit} · {sourceNames[entry.food.source]}</small>
          </div>
          <span className="meal-row-energy">{integerFormat.format(nutritionTotal([entry], 'kcal').value)} kcal</span>
          <button className="icon-button" aria-label={`Usuń: ${entry.food.name}`} onClick={() => { setError(null); setDeleting(entry) }}><Trash2 size={14} /></button>
        </div>) : <p className="meal-empty">Jeszcze bez wpisów. Dodaj wtedy, gdy chcesz.</p>}
      </div>
    })}
    {deleting && <Confirm title="Usunąć wpis?" onClose={() => setDeleting(null)} onConfirm={() => { void remove() }} busy={pending} error={error}>
      {deleting.food.name}, {numberFormat.format(deleting.portion)} {deleting.food.unit}. Cel i pozostałe wpisy zostaną zachowane.
    </Confirm>}
  </>
}

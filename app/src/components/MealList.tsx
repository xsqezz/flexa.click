import { Apple, Coffee, Moon, Plus, Sun, Trash2, Utensils } from 'lucide-react'
import { mealNames, type MealKind } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { integerFormat, numberFormat, nutritionTotal } from '../lib/nutrition'
import { sourceNames } from '../lib/sources'
import { useWorkspace } from './Workspace'
import { CopyFromYesterday } from './MealCopy'
import { portionLabel } from '../lib/quick-kcal'

const groups: { kind: MealKind; Icon: typeof Coffee }[] = [
  { kind: 'breakfast', Icon: Coffee }, { kind: 'lunch', Icon: Sun },
  { kind: 'dinner', Icon: Moon }, { kind: 'snack', Icon: Apple },
]

export function MealList({ date }: { date: string }) {
  const { data, removeWithUndo } = useJournal()
  const { openMeal } = useWorkspace()
  if (!data) throw new Error('Journal data is unavailable')
  return <>
    {groups.map(({ kind, Icon }) => {
      const entries = data.meals.filter((meal) => meal.date === date && meal.meal === kind)
      return <div className="meal-group" key={kind}>
        <div className="meal-group-heading"><Icon size={18} aria-hidden="true" /><h3>{mealNames[kind]}</h3>
          <span>{integerFormat.format(nutritionTotal(entries, 'kcal').value)} kcal</span>
          <CopyFromYesterday date={date} kind={kind} />
          <button className="icon-button" aria-label={`Dodaj do: ${mealNames[kind]}`} onClick={() => openMeal(kind)}><Plus size={17} /></button>
        </div>
        {entries.length ? entries.map((entry) => <div className="meal-row" key={entry.id}>
          <span className="food-mark"><Utensils size={16} aria-hidden="true" /></span>
          <div className="meal-row-info"><strong>{entry.food.name}</strong>
            <small>{portionLabel(entry, numberFormat.format)} · {sourceNames[entry.food.source]}</small>
          </div>
          <span className="meal-row-energy">{integerFormat.format(nutritionTotal([entry], 'kcal').value)} kcal</span>
          <button className="icon-button" aria-label={`Usuń: ${entry.food.name}`}
            onClick={() => removeWithUndo({ type: 'meal.delete', id: entry.id }, `Usunięto: ${entry.food.name}, ${portionLabel(entry, numberFormat.format)}.`)}><Trash2 size={14} /></button>
        </div>) : <p className="meal-empty">Jeszcze bez wpisów. Dodaj wtedy, gdy chcesz.</p>}
      </div>
    })}
  </>
}

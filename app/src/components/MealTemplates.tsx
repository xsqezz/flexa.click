import { useId, useState, type FormEvent } from 'react'
import { BookmarkPlus, ChevronRight, Layers, Trash2 } from 'lucide-react'
import { mealNames, mealTemplateSchema, type MealKind, type MealTemplate } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { dateLabel } from '../lib/dates'
import { integerFormat } from '../lib/nutrition'
import { itemsLabel } from '../lib/templates'
import { useFeedback } from './Feedback'
import { Button, Confirm, Field, Notice, errorMessage } from './ui'

const mealKinds: MealKind[] = ['breakfast', 'lunch', 'dinner', 'snack']
const accusative: Record<MealKind, string> = { breakfast: 'śniadanie', lunch: 'obiad', dinner: 'kolację', snack: 'przekąski' }
const suggestedName: Record<MealKind, string> = { breakfast: 'Moje śniadanie', lunch: 'Mój obiad', dinner: 'Moja kolacja', snack: 'Moje przekąski' }
const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('pl-PL') === b.trim().toLocaleLowerCase('pl-PL')

function templateEnergy(template: MealTemplate): number {
  return template.items.reduce((total, item) => total + (item.food.nutrients.kcal ?? 0) * item.portion / 100, 0)
}

/** "Zestawy": save the chosen meal of the day as a named set and add saved sets with one tap. */
export function MealTemplates({ date, initialMeal, onAdded }: { date: string; initialMeal: MealKind; onAdded: () => void }) {
  const { data, execute, pending } = useJournal()
  const feedback = useFeedback()
  const headingId = useId()
  const [meal, setMeal] = useState<MealKind>(initialMeal)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<MealTemplate | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  if (!data) return null
  const templates = data.mealTemplates
  const current = data.meals.filter((entry) => entry.date === date && entry.meal === meal)

  async function add(template: MealTemplate) {
    setError(null)
    try {
      await execute({ type: 'meal.addMany', value: template.items.map(({ food, portion }) => ({ date, meal, food, portion })) })
      feedback(`Dodano zestaw „${template.name}” (${itemsLabel(template.items.length)}) do: ${mealNames[meal]}.`)
      onAdded()
    } catch (cause) { setError(errorMessage(cause)) }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (templates.some((template) => sameName(template.name, name))) {
      setError('Masz już zestaw o tej nazwie. Wybierz inną nazwę albo usuń poprzedni zestaw.'); return
    }
    if (current.length > 30) { setError('Zestaw może mieć najwyżej 30 pozycji.'); return }
    const parsed = mealTemplateSchema.omit({ id: true }).safeParse({
      name, items: current.map(({ food, portion }) => ({ food, portion })),
    })
    if (!parsed.success) { setError('Podaj nazwę od 1 do 60 znaków.'); return }
    setError(null)
    try {
      await execute({ type: 'template.save', value: parsed.data })
      feedback(`Zapisano zestaw „${parsed.data.name}”. Dodasz go jednym dotknięciem.`)
      setNaming(false)
    } catch (cause) { setError(errorMessage(cause)) }
  }

  async function remove() {
    if (!deleting) return
    setDeleteError(null)
    try {
      await execute({ type: 'template.delete', id: deleting.id })
      feedback(`Usunięto zestaw „${deleting.name}”. Wpisy w dzienniku zostały bez zmian.`)
      setDeleting(null)
    } catch (cause) { setDeleteError(errorMessage(cause)) }
  }

  return <section className="meal-templates" aria-labelledby={headingId}>
    <div className="meal-templates-heading">
      <h3 id={headingId}><Layers size={17} aria-hidden="true" />Zestawy</h3>
      {current.length > 0 && !naming && <button type="button" className="text-link" onClick={() => {
        setError(null); setName(suggestedName[meal]); setNaming(true)
      }}><BookmarkPlus size={16} aria-hidden="true" />Zapisz {accusative[meal]} jako zestaw</button>}
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {(templates.length > 0 || current.length > 0) && <Field label="Posiłek dla zestawu">
      <select value={meal} onChange={(event) => { setMeal(event.target.value as MealKind); setNaming(false); setError(null) }}>
        {mealKinds.map((kind) => <option key={kind} value={kind}>{mealNames[kind]}</option>)}
      </select>
    </Field>}
    {naming && <form className="meal-template-form" onSubmit={(event) => { void save(event) }}>
      <Field label="Nazwa zestawu" hint={`${itemsLabel(current.length)} z dnia ${dateLabel(date, { day: 'numeric', month: 'long' })}: ${current.map((entry) => entry.food.name).join(', ')}.`}>
        <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} autoComplete="off" />
      </Field>
      <div className="button-row">
        <Button type="submit" busy={pending}>Zapisz zestaw</Button>
        <Button type="button" variant="secondary" onClick={() => { setNaming(false); setError(null) }}>Anuluj</Button>
      </div>
    </form>}
    {templates.length > 0 ? <ul className="template-list">{templates.map((template) => <li key={template.id}>
      <button type="button" className="food-result" disabled={pending} onClick={() => { void add(template) }}>
        <span className="food-mark"><Layers size={17} aria-hidden="true" /></span>
        <div><strong>{template.name}</strong>
          <small>{itemsLabel(template.items.length)} · {integerFormat.format(templateEnergy(template))} kcal · dodaj do: {mealNames[meal]}</small>
        </div><ChevronRight size={16} aria-hidden="true" />
      </button>
      <button type="button" className="icon-button" aria-label={`Usuń zestaw: ${template.name}`} onClick={() => { setDeleteError(null); setDeleting(template) }}><Trash2 size={15} /></button>
    </li>)}</ul> : !naming && <p className="source-credit">
      {current.length ? 'Zapisz ten posiłek jako zestaw, a następnym razem dodasz wszystkie produkty jednym dotknięciem.'
        : 'Zestaw to zapisany posiłek z kilku produktów, np. Twoje stałe śniadanie. Gdy dodasz produkty do posiłku, zapiszesz go tutaj.'}
    </p>}
    {deleting && <Confirm title="Usunąć zestaw?" confirmLabel="Usuń zestaw" cancelLabel="Zachowaj zestaw" busy={pending} error={deleteError}
      onClose={() => setDeleting(null)} onConfirm={() => { void remove() }}>
      „{deleting.name}” zniknie z listy zestawów. Wpisy w dzienniku pozostaną bez zmian.
    </Confirm>}
  </section>
}

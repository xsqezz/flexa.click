import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { mealNames, type MealKind } from '../../../shared/domain'
import { useFeedback } from '../components/Feedback'
import { PageHeader } from '../components/Workspace'
import { Button, Notice, errorMessage } from '../components/ui'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { dateLabel, shiftDate, today, weekStart } from '../lib/dates'
import { goalForDay } from '../lib/goals'
import {
  dayTotals, markLogged, planProblem, planStorageKey, pruneRolling, readPlan, setSlot, slotKey, subscribePlan, templateKcal, writePlan,
  type MealPlan,
} from '../lib/meal-plan'
import { integerFormat } from '../lib/nutrition'

const mealKinds: MealKind[] = ['breakfast', 'lunch', 'dinner', 'snack']

function usePlan(scope: string): { plan: MealPlan; update: (change: (plan: MealPlan) => MealPlan) => void } {
  const raw = useSyncExternalStore(
    subscribePlan,
    () => { try { return localStorage.getItem(planStorageKey(scope)) ?? '{}' } catch { return '{}' } },
    () => '{}',
  )
  const plan = useMemo(() => { void raw; return readPlan(scope) }, [raw, scope])
  const update = useCallback((change: (current: MealPlan) => MealPlan) => writePlan(scope, change(readPlan(scope))), [scope])
  return { plan, update }
}

export function MealPlanPage() {
  const { data, execute, pending } = useJournal()
  const auth = useAuth()
  const feedback = useFeedback()
  const { plan, update } = usePlan(auth.session?.user.id ?? 'demo')
  const [offset, setOffset] = useState(0)
  const [busyDay, setBusyDay] = useState<string | null>(null)
  if (!data) throw new Error('Journal data is unavailable')
  const start = shiftDate(weekStart(today()), offset * 7)
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(start, index))
  const templates = data.mealTemplates
  const live = pruneRolling(plan, templates, today())
  const problem = planProblem(data)

  async function logDay(date: string) {
    const entries = mealKinds.flatMap((kind) => {
      const slot = live[slotKey(date, kind)]
      const template = slot && !slot.logged ? templates.find((item) => item.id === slot.templateId) : undefined
      return template ? [{ kind, template }] : []
    })
    if (!entries.length) return
    setBusyDay(date)
    try {
      await execute({
        type: 'meal.addMany',
        value: entries.flatMap(({ kind, template }) => template.items.map(({ food, portion }) => ({ date, meal: kind, food, portion }))),
      })
      update((current) => entries.reduce((next, { kind }) => markLogged(next, date, kind), current))
      feedback(`Zapisano plan dnia (${entries.length}) w dzienniku.`)
    } catch (cause) { feedback(errorMessage(cause), { tone: 'error' }) }
    finally { setBusyDay(null) }
  }

  return <>
    <PageHeader title="Plan tygodnia" description="Rozplanuj posiłki z zapisanych zestawów i zapisz cały dzień w dzienniku jednym dotknięciem. Plan zostaje na tym urządzeniu." />
    <Link className="text-link" to="/meals"><ArrowLeft size={16} aria-hidden="true" />Wróć do posiłków</Link>
    {problem && <Notice>{problem}</Notice>}
    <div className="page-toolbar plan-week-nav">
      <Button variant="secondary" onClick={() => setOffset((value) => value - 1)} aria-label="Poprzedni tydzień"><ChevronLeft size={17} aria-hidden="true" /></Button>
      <strong>{dateLabel(start, { day: 'numeric', month: 'short' })} – {dateLabel(days[6]!, { day: 'numeric', month: 'short' })}</strong>
      <Button variant="secondary" onClick={() => setOffset((value) => value + 1)} aria-label="Następny tydzień"><ChevronRight size={17} aria-hidden="true" /></Button>
      {offset !== 0 && <Button variant="secondary" onClick={() => setOffset(0)}>Ten tydzień</Button>}
    </div>
    <div className="meal-plan-grid">
      {days.map((date) => {
        const totals = dayTotals(live, templates, date, mealKinds)
        const goal = goalForDay(data, date)
        const pendingSlots = mealKinds.some((kind) => live[slotKey(date, kind)] && !live[slotKey(date, kind)]!.logged)
        return <section key={date} className={date === today() ? 'panel meal-plan-day today' : 'panel meal-plan-day'} aria-labelledby={`plan-${date}`}>
          <h2 id={`plan-${date}`}>{dateLabel(date, { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
          {mealKinds.map((kind: MealKind) => {
            const slot = live[slotKey(date, kind)]
            const template = slot && templates.find((item) => item.id === slot.templateId)
            return <label key={kind} className="meal-plan-slot"><span>{mealNames[kind]}{slot?.logged && ' ✓'}</span>
              <select value={slot?.templateId ?? ''} disabled={Boolean(slot?.logged)}
                onChange={(event) => update((current) => setSlot(current, date, kind, event.target.value || null))}>
                <option value="">—</option>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name} · {integerFormat.format(templateKcal(item))} kcal</option>)}
              </select>
              {slot?.logged && template && <button type="button" className="text-link" onClick={() => update((current) => setSlot(current, date, kind, null))}>Wyczyść</button>}
            </label>
          })}
          <p className="meal-plan-total">{totals.slots ? <>Plan: <strong>{integerFormat.format(totals.planned)} kcal</strong>{goal ? ` z ${integerFormat.format(goal.calorieGoal)} kcal celu` : ''}</> : 'Nic nie zaplanowano.'}</p>
          <Button variant="secondary" busy={busyDay === date} disabled={!pendingSlots || (pending && busyDay !== date)} onClick={() => { void logDay(date) }}>
            <ListChecks size={17} aria-hidden="true" />Zapisz w dzienniku</Button>
        </section>
      })}
    </div>
    <p className="source-credit">Kalorie planu pochodzą z wartości produktów w zestawach. Zapisanie dnia dodaje te pozycje do dziennika, a plan oznacza jako zapisany, żeby nie dodać ich dwa razy.</p>
  </>
}

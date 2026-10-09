import { z } from 'zod'
import type { Journal, MealKind, MealTemplate } from '../../../shared/domain'

/** The weekly plan keeps only template references and lives in this browser (per account or demo). */
const slotSchema = z.object({ templateId: z.uuid(), logged: z.boolean() })
const planSchema = z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}\|(breakfast|lunch|dinner|snack)$/), slotSchema)

export type PlanSlot = z.infer<typeof slotSchema>
export type MealPlan = z.infer<typeof planSchema>
export const slotKey = (date: string, kind: MealKind) => `${date}|${kind}`

const storageKey = (scope: string) => `flexa:meal-plan:v1:${scope}`
const EVENT = 'flexa:meal-plan-changed'

export function readPlan(scope: string): MealPlan {
  try {
    const parsed = planSchema.safeParse(JSON.parse(localStorage.getItem(storageKey(scope)) ?? '{}'))
    return parsed.success ? parsed.data : {}
  } catch { return {} }
}

export function writePlan(scope: string, plan: MealPlan): void {
  try { localStorage.setItem(storageKey(scope), JSON.stringify(plan)) } catch { /* Planning is optional; losing it is harmless. */ }
  window.dispatchEvent(new Event(EVENT))
}

export function subscribePlan(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('storage', listener) }
}

export const planStorageKey = storageKey

export function setSlot(plan: MealPlan, date: string, kind: MealKind, templateId: string | null): MealPlan {
  const next = { ...plan }
  if (templateId === null) delete next[slotKey(date, kind)]
  else next[slotKey(date, kind)] = { templateId, logged: false }
  return next
}

export function markLogged(plan: MealPlan, date: string, kind: MealKind): MealPlan {
  const slot = plan[slotKey(date, kind)]
  return slot ? { ...plan, [slotKey(date, kind)]: { ...slot, logged: true } } : plan
}

/** Drops plan entries older than a week and slots whose template was deleted. */
export function pruneRolling(plan: MealPlan, templates: readonly MealTemplate[], today: string): MealPlan {
  const ids = new Set(templates.map((template) => template.id))
  const limit = new Date(`${today}T00:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() - 7)
  const oldest = limit.toISOString().slice(0, 10)
  return Object.fromEntries(Object.entries(plan).filter(([key, slot]) => key.slice(0, 10) >= oldest && ids.has(slot.templateId)))
}

export function templateKcal(template: MealTemplate): number {
  return template.items.reduce((total, { food, portion }) => total + (food.nutrients.kcal ?? 0) * portion / 100, 0)
}

export type DayPlanTotals = { planned: number; slots: number }

export function dayTotals(plan: MealPlan, templates: readonly MealTemplate[], date: string, kinds: readonly MealKind[]): DayPlanTotals {
  let planned = 0
  let slots = 0
  for (const kind of kinds) {
    const slot = plan[slotKey(date, kind)]
    const template = slot && templates.find((item) => item.id === slot.templateId)
    if (!template) continue
    slots++
    planned += templateKcal(template)
  }
  return { planned, slots }
}

export function planProblem(journal: Journal): string | null {
  return journal.mealTemplates.length ? null : 'Najpierw zapisz posiłek jako zestaw (w oknie dodawania posiłku, zakładka „Zestawy”).'
}

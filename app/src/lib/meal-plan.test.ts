import { beforeEach, describe, expect, it } from 'vitest'
import type { MealTemplate } from '../../../shared/domain'
import { dayTotals, markLogged, pruneRolling, readPlan, setSlot, slotKey, templateKcal, writePlan } from './meal-plan'
import { shiftDate, today } from './dates'

const template = (id: string, kcal: number, portion: number): MealTemplate => ({
  id, name: `Zestaw ${kcal}`,
  items: [{
    portion,
    food: { id: 'f', name: 'Produkt', brand: '', barcode: null, source: 'custom', unit: 'g', nutrients: { kcal, protein: 1, carbs: 1, fat: 1, fiber: 0 } },
  }],
})
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const day = today()

describe('meal plan', () => {
  beforeEach(() => localStorage.clear())

  it('computes template energy from per-100 values and portions', () => {
    expect(templateKcal(template(A, 200, 150))).toBe(300)
  })

  it('sets, replaces, clears and marks slots without touching others', () => {
    let plan = setSlot({}, day, 'lunch', A)
    plan = setSlot(plan, day, 'dinner', B)
    plan = markLogged(plan, day, 'lunch')
    expect(plan[slotKey(day, 'lunch')]).toEqual({ templateId: A, logged: true })
    expect(plan[slotKey(day, 'dinner')]).toEqual({ templateId: B, logged: false })
    plan = setSlot(plan, day, 'lunch', null)
    expect(Object.keys(plan)).toEqual([slotKey(day, 'dinner')])
    expect(markLogged(plan, day, 'snack')).toBe(plan)
  })

  it('sums planned energy only for slots with existing templates', () => {
    const templates = [template(A, 200, 100), template(B, 100, 300)]
    const plan = setSlot(setSlot(setSlot({}, day, 'lunch', A), day, 'dinner', B), day, 'snack', '33333333-3333-4333-8333-333333333333')
    expect(dayTotals(plan, templates, day, ['breakfast', 'lunch', 'dinner', 'snack'])).toEqual({ planned: 500, slots: 2 })
  })

  it('prunes old days and deleted templates', () => {
    const plan = setSlot(setSlot(setSlot({}, shiftDate(day, -30), 'lunch', A), day, 'lunch', A), day, 'dinner', B)
    const kept = pruneRolling(plan, [template(A, 1, 1)], day)
    expect(Object.keys(kept)).toEqual([slotKey(day, 'lunch')])
  })

  it('persists per scope and ignores corrupt storage', () => {
    writePlan('demo', setSlot({}, day, 'lunch', A))
    expect(readPlan('demo')[slotKey(day, 'lunch')]?.templateId).toBe(A)
    expect(readPlan('other')).toEqual({})
    localStorage.setItem('flexa:meal-plan:v1:demo', 'nope')
    expect(readPlan('demo')).toEqual({})
  })
})

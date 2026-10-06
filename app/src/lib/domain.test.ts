import { describe, expect, it } from 'vitest'
import { isValidBarcode, sameBarcode, foodSchema, mealSchema, dateSchema } from '../../../shared/domain'
import { createDemo, demoFoods } from './demo'
import { dateKey, daysEndingAt, shiftDate, weekStart } from './dates'
import { calorieStatus, nutritionTotal, pace, progress, workoutLoad } from './nutrition'

describe('food and nutrition', () => {
  it('validates EAN/UPC/GTIN check digits and preserves leading zeros', () => {
    expect(isValidBarcode('5901234123457')).toBe(true)
    expect(isValidBarcode('4006381333931')).toBe(true)
    expect(isValidBarcode('96385074')).toBe(true)
    expect(isValidBarcode('036000291452')).toBe(true)
    expect(sameBarcode('036000291452', '00036000291452')).toBe(true)
    for (const code of ['5901234123458', '', '12345', '5901234abc457']) expect(isValidBarcode(code)).toBe(false)
  })
  it('scales values by the actual portion and does not invent unknown macro', () => {
    const meal = { id: crypto.randomUUID(), date: '2026-10-06', meal: 'lunch' as const, food: { ...demoFoods[0], nutrients: { ...demoFoods[0].nutrients, protein: null } }, portion: 50 }
    expect(nutritionTotal([meal], 'kcal')).toEqual({ value: 185, missing: 0 })
    expect(nutritionTotal([meal], 'protein')).toEqual({ value: 0, missing: 1 })
  })
  it('requires confirmed units, calories, and a positive finite portion', () => {
    const meal = { id: crypto.randomUUID(), date: '2026-10-06', meal: 'lunch', food: demoFoods[0], portion: 100 }
    expect(mealSchema.safeParse(meal).success).toBe(true)
    for (const portion of [0, -1, Infinity, 10001]) expect(mealSchema.safeParse({ ...meal, portion }).success).toBe(false)
    expect(mealSchema.safeParse({ ...meal, food: { ...demoFoods[0], unit: null } }).success).toBe(false)
    expect(foodSchema.safeParse({ ...demoFoods[0], nutrients: { ...demoFoods[0].nutrients, kcal: -1 } }).success).toBe(false)
    expect(foodSchema.safeParse({ ...demoFoods[0], barcode: '5901234123458' }).success).toBe(false)
  })
  it('caps goal visualization but preserves above-goal information', () => {
    expect(progress(100, 0)).toBe(0)
    expect(progress(2500, 2200)).toBe(100)
    expect(calorieStatus(2500, 2200)).toContain('300')
    expect(calorieStatus(2500, 2200)).toContain('powyżej')
  })
  it('derives pace and RPE load only when their inputs exist', () => {
    const workout = { ...createDemo().workouts[0], kind: 'run' as const, minutes: 32, distanceKm: 5, effort: 4 }
    expect(pace(workout)).toBe('6:24')
    expect(workoutLoad(workout)).toBe(128)
    expect(pace({ ...workout, distanceKm: null })).toBeNull()
    expect(workoutLoad({ ...workout, effort: null })).toBeNull()
  })
})

describe('local calendar dates', () => {
  it('uses the local day, not a UTC substring', () => {
    expect(dateKey(new Date(2026, 9, 6, 0, 1))).toBe('2026-10-06')
  })
  it('handles months, leap years, and Monday-based weeks', () => {
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekStart('2026-10-11')).toBe('2026-10-05')
    expect(daysEndingAt('2026-10-06', 3)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06'])
    expect(dateSchema.safeParse('0001-01-01').success).toBe(false)
    expect(dateSchema.safeParse('2101-01-01').success).toBe(false)
    expect(dateSchema.safeParse('2026-02-29').success).toBe(false)
  })
})

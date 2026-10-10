import { describe, expect, it } from 'vitest'
import { isKcalOnly, kcalOnlyMeal, portionLabel } from './quick-kcal'
import { nutritionTotal } from './nutrition'

const base = { date: '2026-10-10', meal: 'dinner', name: '', kcal: '', protein: '', carbs: '', fat: '' }

describe('kcalOnlyMeal', () => {
  it('reproduces exactly the typed totals and keeps blank macros unknown', () => {
    const result = kcalOnlyMeal({ ...base, name: ' Burger ', kcal: '850', protein: '32,5' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const entry = { ...result.meal, id: 'x' }
    expect(result.meal.food.name).toBe('Burger')
    expect(nutritionTotal([entry], 'kcal').value).toBeCloseTo(850, 5)
    expect(nutritionTotal([entry], 'protein').value).toBeCloseTo(32.5, 5)
    expect(result.meal.food.nutrients.fat).toBeNull()
    expect(isKcalOnly(result.meal.food)).toBe(true)
    expect(portionLabel(result.meal, String)).toBe('wpis kcal')
  })

  it('handles large entries that would exceed the per-100 g limit', () => {
    const result = kcalOnlyMeal({ ...base, kcal: '3600' })
    expect(result.ok && nutritionTotal([{ ...result.meal, id: 'x' }], 'kcal').value).toBeCloseTo(3600, 5)
  })

  it('rejects missing, zero, huge and malformed values', () => {
    for (const kcal of ['', '0', '-5', '4001', 'abc']) expect(kcalOnlyMeal({ ...base, kcal }).ok, kcal).toBe(false)
    expect(kcalOnlyMeal({ ...base, kcal: '300', fat: '-1' }).ok).toBe(false)
    expect(kcalOnlyMeal({ ...base, kcal: '300', meal: 'brunch' }).ok).toBe(false)
  })

  it('shows grams for ordinary products', () => {
    const food = { id: 'a', name: 'Ryż', brand: '', barcode: null, unit: 'g' as const, source: 'custom' as const, nutrients: { kcal: 130, protein: null, carbs: null, fat: null, fiber: null } }
    expect(portionLabel({ food, portion: 150 }, String)).toBe('150 g')
  })
})

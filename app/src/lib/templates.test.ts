import { describe, expect, it } from 'vitest'
import type { Food, Meal } from '../../../shared/domain'
import { shiftDate, today } from './dates'
import { suggestedFoods } from './templates'

const food = (id: string): Food => ({
  id, name: id, brand: '', barcode: null, source: 'custom', unit: 'g',
  nutrients: { kcal: 100, protein: 1, carbs: 1, fat: 1, fiber: 0 },
})
const meal = (id: string, offset: number): Meal => ({
  id: crypto.randomUUID(), date: shiftDate(today(), offset), meal: 'lunch', food: food(id), portion: 100,
})

describe('suggested foods', () => {
  it('moves staples eaten at least three times to the front without hiding recent items', () => {
    const meals = [
      meal('owsianka', -20), meal('owsianka', -10), meal('owsianka', -5), meal('jajko', -3), meal('ryz', -2), meal('pizza', -1),
    ]
    const names = suggestedFoods(meals, [], today()).map((item) => item.food.id)
    expect(names[0]).toBe('owsianka')
    expect(names).toEqual(expect.arrayContaining(['jajko', 'ryz', 'pizza']))
    expect(new Set(names).size).toBe(names.length)
  })

  it('ignores old habits', () => {
    const meals = [meal('stare', -100), meal('stare', -99), meal('stare', -98), meal('nowe', -1)]
    expect(suggestedFoods(meals, [], today()).map((item) => item.food.id)[0]).toBe('nowe')
  })
})

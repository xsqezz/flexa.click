import type { Food, Meal } from '../../../shared/domain'

/** Polish plural: 1 pozycja, 2–4 pozycje, 5+ pozycji (12–14 pozycji). */
export function plural(count: number, [one, few, many]: readonly [string, string, string]): string {
  const tens = count % 100
  const units = count % 10
  const word = count === 1 ? one : units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many
  return `${count} ${word}`
}

export const itemsLabel = (count: number) => plural(count, ['pozycja', 'pozycje', 'pozycji'])

export type RecentFood = { food: Food; portion: number | null; unit: Food['unit'] }

/**
 * Unique foods from the most recently added meals (newest first) with the portion used last time,
 * followed by the user's own products that were not eaten recently.
 */
export function recentFoods(meals: readonly Meal[], customFoods: readonly Food[], limit = 10): RecentFood[] {
  const seen = new Map<string, RecentFood>()
  for (let index = meals.length - 1; index >= 0 && seen.size < limit; index--) {
    const { food, portion } = meals[index]
    const key = food.id || food.name
    if (!seen.has(key)) seen.set(key, { food, portion, unit: food.unit })
  }
  for (let index = customFoods.length - 1; index >= 0 && seen.size < limit + 4; index--) {
    const food = customFoods[index]
    if (!seen.has(food.id)) seen.set(food.id, { food, portion: null, unit: food.unit })
  }
  return [...seen.values()]
}

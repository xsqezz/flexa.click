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

/**
 * Recent foods with the ones the user eats most often (at least 3 times in the last 60 days) moved to the front,
 * so the daily staples are one tap away. Frequency never hides recent items, it only reorders them.
 */
export function suggestedFoods(meals: readonly Meal[], customFoods: readonly Food[], today: string, limit = 12): RecentFood[] {
  const recent = recentFoods(meals, customFoods, limit)
  const from = new Date(`${today}T00:00:00Z`)
  from.setUTCDate(from.getUTCDate() - 60)
  const since = from.toISOString().slice(0, 10)
  const counts = new Map<string, number>()
  for (const meal of meals) {
    if (meal.date < since || meal.date > today) continue
    const key = meal.food.id || meal.food.name
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const count = (item: RecentFood) => counts.get(item.food.id || item.food.name) ?? 0
  const frequent = recent.filter((item) => count(item) >= 3).sort((a, b) => count(b) - count(a)).slice(0, 4)
  return [...frequent, ...recent.filter((item) => !frequent.includes(item))]
}
import type { Meal, Nutrient, Workout } from '../../../shared/domain'

export const numberFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 })
export const integerFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })

export function nutritionTotal(meals: Meal[], nutrient: Nutrient) {
  return meals.reduce((total, meal) => {
    const value = meal.food.nutrients[nutrient]
    return {
      value: total.value + (value === null ? 0 : value * meal.portion / 100),
      missing: total.missing + (value === null ? 1 : 0),
    }
  }, { value: 0, missing: 0 })
}

export function progress(value: number, goal: number): number {
  return goal > 0 ? Math.min(100, Math.max(0, value / goal * 100)) : 0
}

export function pace(workout: Workout): string | null {
  if (workout.kind !== 'run' && workout.kind !== 'walk') return null
  if (!workout.distanceKm || workout.distanceKm <= 0) return null
  const seconds = Math.round(workout.minutes * 60 / workout.distanceKm)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function workoutLoad(workout: Workout): number | null {
  return workout.effort === null ? null : workout.minutes * workout.effort
}

export function calorieStatus(consumed: number, goal: number): string {
  const remaining = goal - consumed
  return remaining >= 0
    ? `${integerFormat.format(remaining)} kcal do wybranego celu`
    : `${integerFormat.format(-remaining)} kcal powyżej wybranego celu`
}

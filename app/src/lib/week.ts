import type { Journal } from '../../../shared/domain'
import { shiftDate, weekStart } from './dates'
import { nutritionTotal } from './nutrition'

export type WeekNumbers = {
  start: string
  end: string
  /** Days with at least one food entry. */
  foodDays: number
  /** Mean energy over the days with entries only; `null` when nothing was logged. */
  averageKcal: number | null
  minutes: number
  workouts: number
  /** Days on which the logged water reached the current goal. */
  waterDays: number
  /** The last measurement of the week. */
  weight: { date: string; value: number } | null
}

export type WeekSummary = {
  current: WeekNumbers
  previous: WeekNumbers
  minutesGoal: number
  /** Latest weight this week minus latest weight last week; `null` when either week has none. */
  weightChange: number | null
}

function weekNumbers(journal: Journal, start: string): WeekNumbers {
  const end = shiftDate(start, 6)
  const inWeek = (date: string) => date >= start && date <= end
  const meals = journal.meals.filter((meal) => inWeek(meal.date))
  const foodDates = [...new Set(meals.map((meal) => meal.date))]
  const workouts = journal.workouts.filter((workout) => inWeek(workout.date))
  const water = new Map<string, number>()
  for (const entry of journal.water) if (inWeek(entry.date)) water.set(entry.date, (water.get(entry.date) ?? 0) + entry.amountMl)
  const measurements = journal.measurements.filter((item) => inWeek(item.date)).sort((a, b) => a.date.localeCompare(b.date))
  const last = measurements.at(-1)
  return {
    start, end,
    foodDays: foodDates.length,
    averageKcal: foodDates.length ? nutritionTotal(meals, 'kcal').value / foodDates.length : null,
    minutes: workouts.reduce((sum, workout) => sum + workout.minutes, 0),
    workouts: workouts.length,
    waterDays: [...water.values()].filter((amount) => amount >= journal.profile.waterGoal).length,
    weight: last ? { date: last.date, value: last.weightKg } : null,
  }
}

/** Monday–Sunday week containing `date`, compared with the week before. */
export function weekSummary(journal: Journal, date: string): WeekSummary {
  const start = weekStart(date)
  const current = weekNumbers(journal, start)
  const previous = weekNumbers(journal, shiftDate(start, -7))
  return {
    current, previous, minutesGoal: journal.profile.weeklyMinutesGoal,
    weightChange: current.weight && previous.weight ? Math.round((current.weight.value - previous.weight.value) * 10) / 10 : null,
  }
}

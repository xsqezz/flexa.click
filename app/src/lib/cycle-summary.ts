import type { GoalCycle, Journal } from '../../../shared/domain'
import { weightTrend } from './adaptive'
import { today } from './dates'
import { nutritionTotal } from './nutrition'

export type CycleSummary = {
  days: number
  elapsedDays: number
  startWeightKg: number
  latestWeightKg: number | null
  changeKg: number | null
  weeklyKg: number | null
  loggedDays: number
  averageKcal: number | null
  goalKcal: number
  averageDeviation: number | null
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
}

/** Factual recap of one cycle: weight change, average intake on logged days and how it compares with the target. */
export function cycleSummary(journal: Journal, cycle: GoalCycle, day = today()): CycleSummary {
  const end = cycle.endDate < day ? cycle.endDate : day
  const days = daysBetween(cycle.startDate, cycle.endDate)
  const elapsedDays = Math.max(0, daysBetween(cycle.startDate, end))
  const weights = journal.measurements.filter((item) => item.date >= cycle.startDate && item.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
  const latestWeightKg = weights.at(-1)?.weightKg ?? null
  const byDay = new Map<string, Journal['meals']>()
  for (const meal of journal.meals) {
    if (meal.date < cycle.startDate || meal.date > end) continue
    byDay.set(meal.date, [...(byDay.get(meal.date) ?? []), meal])
  }
  const totals = [...byDay.values()].map((items) => nutritionTotal(items, 'kcal').value).filter((value) => value >= 600)
  const averageKcal = totals.length ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length) : null
  const trend = weights.length >= 3 ? weightTrend(weights.map((item) => ({ date: item.date, value: item.weightKg }))) : null
  return {
    days, elapsedDays, startWeightKg: cycle.startWeightKg, latestWeightKg,
    changeKg: latestWeightKg === null ? null : Math.round((latestWeightKg - cycle.startWeightKg) * 10) / 10,
    weeklyKg: trend && trend.to !== trend.from && daysBetween(trend.from, trend.to) >= 7 ? trend.weeklyKg : null,
    loggedDays: totals.length, averageKcal, goalKcal: cycle.calorieGoal,
    averageDeviation: averageKcal === null ? null : averageKcal - cycle.calorieGoal,
  }
}

/** Neutral next-step wording after a finished phase; the user always chooses. */
export function nextCycleHint(kind: GoalCycle['kind']): string | null {
  if (kind === 'reduction') return 'Po redukcji wiele osób robi kilka tygodni utrzymania, zanim wybierze kolejny kierunek.'
  if (kind === 'muscle_gain') return 'Po okresie budowy możesz przejść na utrzymanie albo krótką redukcję. To Twoja decyzja.'
  if (kind === 'maintenance') return 'Utrzymanie możesz przedłużyć albo wybrać nowy kierunek, gdy będziesz gotowy(-a).'
  return null
}

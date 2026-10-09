import type { GoalCycle, GoalCycleInput, Journal, Meal } from '../../../shared/domain'
import { shiftDate, today } from './dates'
import { currentWeight, effectiveCycle } from './goals'
import { nutritionTotal } from './nutrition'

export const adaptiveWindowDays = 14
const minWeighIns = 3
const minSpanDays = 10
const minLoggedDays = 8
const maxWeightAgeDays = 3
const maxStepKcal = 200
const minStepKcal = 100

export type WeightTrend = { weeklyKg: number; from: string; to: string; weighIns: number }

export type AdaptiveInsight =
  | { status: 'insufficient'; reasons: string[] }
  | { status: 'goal-reached'; message: string }
  | { status: 'on-track'; trend: WeightTrend; averageKcal: number; band: [number, number] }
  | {
    status: 'suggest'; direction: 'increase' | 'decrease'; deltaKcal: number; trend: WeightTrend
    averageKcal: number; band: [number, number]; reason: string; proposal: GoalCycleInput
  }

/** Planned weekly change in kg for each phase; a trend inside the band means no adjustment is needed. */
export function plannedBand(kind: GoalCycle['kind'], weightKg: number): [number, number] {
  const percent = (low: number, high: number): [number, number] => [
    Math.round(weightKg * low * 100) / 100, Math.round(weightKg * high * 100) / 100,
  ]
  if (kind === 'reduction') return percent(-0.0075, -0.0025)
  if (kind === 'muscle_gain') return percent(0.001, 0.0035)
  return percent(-0.0025, 0.0025)
}

/** Least-squares slope of the measured weights, in kg per week. */
export function weightTrend(points: { date: string; value: number }[]): WeightTrend | null {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) return null
  const origin = Date.parse(`${sorted[0]!.date}T00:00:00Z`)
  const xs = sorted.map((point) => (Date.parse(`${point.date}T00:00:00Z`) - origin) / 86_400_000)
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length
  const meanY = sorted.reduce((sum, point) => sum + point.value, 0) / sorted.length
  const variance = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0)
  if (variance === 0) return null
  const covariance = xs.reduce((sum, x, index) => sum + (x - meanX) * (sorted[index]!.value - meanY), 0)
  return {
    weeklyKg: Math.round(covariance / variance * 7 * 100) / 100,
    from: sorted[0]!.date, to: sorted.at(-1)!.date, weighIns: sorted.length,
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** Lowest daily energy Flexa will ever propose. Unknown sex uses the higher, more cautious floor. */
export function kcalFloor(journal: Journal): number {
  return journal.training.plan?.answers.sex === 'female' ? 1200 : 1500
}

function dailyAverage(meals: Meal[], from: string, to: string): { average: number; loggedDays: number } {
  const days = new Map<string, Meal[]>()
  for (const meal of meals) {
    if (meal.date < from || meal.date > to) continue
    days.set(meal.date, [...(days.get(meal.date) ?? []), meal])
  }
  const totals = [...days.values()].map((items) => nutritionTotal(items, 'kcal').value).filter((value) => value >= 600)
  return {
    average: totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0,
    loggedDays: totals.length,
  }
}

/**
 * Compares the real weight trend with what the active phase aims for and, when they differ, proposes a small
 * change of the daily energy target. It never applies anything: the user confirms a new cycle with the result.
 */
export function adaptiveInsight(journal: Journal, day = today()): AdaptiveInsight | null {
  const cycle = effectiveCycle(journal, day)
  if (!cycle || cycle.kind === 'manual') return null
  const age = journal.training.plan?.answers.age
  if (age !== undefined && age < 18) return null
  const from = cycle.startDate > shiftDate(day, -adaptiveWindowDays) ? cycle.startDate : shiftDate(day, -adaptiveWindowDays)
  const weights = journal.measurements.filter((item) => item.date >= from && item.date <= day)
    .map((item) => ({ date: item.date, value: item.weightKg }))
  const weight = currentWeight(journal, day)
  const { average, loggedDays } = dailyAverage(journal.meals, from, day)
  const reasons: string[] = []
  const latest = weights.map((item) => item.date).sort().at(-1)
  if (weights.length < minWeighIns) reasons.push(`Zapisz co najmniej ${minWeighIns} pomiary masy w ostatnich ${adaptiveWindowDays} dniach (masz ${weights.length}).`)
  else if (daysBetween(weights.map((item) => item.date).sort()[0]!, latest!) < minSpanDays) reasons.push(`Pomiary powinny obejmować co najmniej ${minSpanDays} dni.`)
  if (latest && daysBetween(latest, day) > maxWeightAgeDays) reasons.push('Ostatni pomiar jest starszy niż 3 dni. Zważ się, aby porównać aktualny trend.')
  if (loggedDays < minLoggedDays) reasons.push(`Zapisuj posiłki przez co najmniej ${minLoggedDays} dni w tym okresie (masz ${loggedDays}).`)
  if (reasons.length || weight === null) return { status: 'insufficient', reasons }
  const trend = weightTrend(weights)
  if (!trend) return { status: 'insufficient', reasons: ['Brakuje pomiarów, aby policzyć trend.'] }
  const band = plannedBand(cycle.kind, weight)
  if (cycle.kind !== 'maintenance' && cycle.targetWeightKg !== null) {
    const reached = cycle.kind === 'reduction' ? weight <= cycle.targetWeightKg : weight >= cycle.targetWeightKg
    if (reached) return { status: 'goal-reached', message: 'Masz już docelową masę z tego cyklu. Rozważ nowy cykl, na przykład utrzymanie.' }
  }
  if (trend.weeklyKg >= band[0] && trend.weeklyKg <= band[1]) return { status: 'on-track', trend, averageKcal: Math.round(average), band }

  const below = trend.weeklyKg < band[0]
  const gap = below ? band[0] - trend.weeklyKg : trend.weeklyKg - band[1]
  // 1 kg of body mass is roughly 7700 kcal; close at most a third of the gap per step and keep steps small.
  const rawStep = gap * 7700 / 7 / 3
  const step = Math.min(maxStepKcal, Math.max(minStepKcal, Math.round(rawStep / 50) * 50))
  const direction: 'increase' | 'decrease' = below ? 'increase' : 'decrease'
  const floor = kcalFloor(journal)
  const target = cycle.calorieGoal + (direction === 'increase' ? step : -step)
  const calorieGoal = Math.max(floor, target)
  if (calorieGoal === cycle.calorieGoal) {
    return { status: 'insufficient', reasons: [`Nie proponujemy niższego celu niż ${floor} kcal. Porozmawiaj z lekarzem lub dietetykiem, jeśli trend nadal Cię niepokoi.`] }
  }
  const delta = calorieGoal - cycle.calorieGoal
  const carbsGoal = Math.max(0, Math.round((calorieGoal - cycle.proteinGoal * 4 - cycle.fatGoal * 9) / 4))
  const reason = describe(cycle.kind, below, trend.weeklyKg, band)
  return {
    status: 'suggest', direction, deltaKcal: delta, trend, averageKcal: Math.round(average), band, reason,
    proposal: {
      kind: cycle.kind, startDate: day, endDate: cycle.endDate, startWeightKg: weight, targetWeightKg: cycle.targetWeightKg,
      calorieGoal, proteinGoal: cycle.proteinGoal, carbsGoal, fatGoal: cycle.fatGoal, waterGoal: cycle.waterGoal,
    },
  }
}

function describe(kind: GoalCycle['kind'], below: boolean, weekly: number, band: [number, number]): string {
  const rate = `${weekly > 0 ? '+' : ''}${weekly.toLocaleString('pl-PL')} kg/tydz.`
  const range = `${band[0].toLocaleString('pl-PL')}…${band[1].toLocaleString('pl-PL')} kg/tydz.`
  if (kind === 'reduction') return below
    ? `Masa spada szybciej (${rate}), niż zakłada łagodna redukcja (${range}). Odrobina energii więcej pomoże utrzymać tempo.`
    : `Masa spada wolniej lub rośnie (${rate}), a redukcja zakłada ${range}. Mały krok w dół może to wyrównać.`
  if (kind === 'muscle_gain') return below
    ? `Masa rośnie wolniej (${rate}), niż zakłada budowa mięśni (${range}). Mały krok w górę może pomóc.`
    : `Masa rośnie szybciej (${rate}), niż zakłada budowa mięśni (${range}). Mały krok w dół ograniczy przyrost tłuszczu.`
  return below
    ? `Masa spada (${rate}), a utrzymanie zakłada ${range}. Odrobina energii więcej ustabilizuje wagę.`
    : `Masa rośnie (${rate}), a utrzymanie zakłada ${range}. Mały krok w dół ustabilizuje wagę.`
}

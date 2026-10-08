import {
  goalCycleInputSchema, journalSchema, type GoalCycle, type GoalCycleInput, type Journal, type Profile,
} from '../../../shared/domain'
import { today } from './dates'

export const cycleNames: Record<GoalCycle['kind'], string> = {
  reduction: 'Redukcja',
  maintenance: 'Utrzymanie',
  muscle_gain: 'Budowa mięśni',
  manual: 'Własny cel',
}

export function currentWeight(journal: Journal, day = today()): number | null {
  const latest = journal.measurements.filter((item) => item.date <= day)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  if (latest) return latest.weightKg
  return [...journal.goals.cycles].filter((cycle) => cycle.startDate <= day)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt))[0]?.startWeightKg ?? null
}

export function goalForDay(journal: Journal, day: string): Profile | null {
  if (!journal.goals.cycles.length) return journal.profile
  const cycle = [...journal.goals.cycles].filter((item) => item.startDate <= day)
    .sort((a, b) => b.startDate.localeCompare(a.startDate)
      || Number(b.status === 'active') - Number(a.status === 'active')
      || b.createdAt.localeCompare(a.createdAt))[0]
  return cycle ? { ...journal.profile, calorieGoal: cycle.calorieGoal, proteinGoal: cycle.proteinGoal,
    carbsGoal: cycle.carbsGoal, fatGoal: cycle.fatGoal, waterGoal: cycle.waterGoal,
    targetWeight: cycle.targetWeightKg } : null
}

export function effectiveCycle(journal: Journal, day = today()): GoalCycle | null {
  return journal.goals.cycles.find((cycle) => cycle.status === 'active' && cycle.endDate >= day) ?? null
}

export function validateCycleStart(value: GoalCycleInput, journal: Journal, day = today()): GoalCycleInput {
  const input = goalCycleInputSchema.parse(value)
  if (input.startDate > day || input.endDate < day) throw new Error('Nowy cykl musi obejmować dzisiejszy dzień.')
  if (journal.training.plan?.answers.age !== undefined && journal.training.plan.answers.age < 18 && input.kind !== 'manual') {
    throw new Error('Dla osób poniżej 18 lat dostępne są tylko cele ręczne, bez faz redukcji i budowy masy.')
  }
  const previous = journal.goals.cycles.find((cycle) => cycle.status === 'active')
  if (previous && input.startDate < previous.startDate) throw new Error('Nowy cykl nie może zaczynać się przed poprzednim.')
  const recorded = journal.measurements.find((item) => item.date === input.startDate)
  if (recorded && recorded.weightKg !== input.startWeightKg) {
    throw new Error('Dla daty początku jest już inny pomiar. Użyj zapisanej wagi lub popraw pomiar w Postępach.')
  }
  return input
}

export function startDemoCycle(journal: Journal, id: string, value: GoalCycleInput, now = new Date()): Journal {
  const input = validateCycleStart(value, journal)
  const previous = journal.goals.cycles.find((cycle) => cycle.status === 'active')
  const cycles = journal.goals.cycles.map((cycle) => cycle === previous ? {
    ...cycle, status: 'completed' as const, completedAt: now.toISOString(),
    endDate: cycle.endDate < input.startDate ? cycle.endDate : input.startDate,
  } : cycle)
  cycles.push({ ...input, id, status: 'active', createdAt: now.toISOString(), completedAt: null })
  return journalSchema.parse({
    ...journal,
    goals: { setupDone: true, cycles },
    profile: {
      ...journal.profile, calorieGoal: input.calorieGoal, proteinGoal: input.proteinGoal,
      carbsGoal: input.carbsGoal, fatGoal: input.fatGoal, waterGoal: input.waterGoal,
      targetWeight: input.targetWeightKg,
    },
    measurements: journal.measurements.some((item) => item.date === input.startDate) ? journal.measurements
      : [...journal.measurements, { id: crypto.randomUUID(), date: input.startDate, weightKg: input.startWeightKg }],
  })
}

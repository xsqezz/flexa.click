import { describe, expect, it } from 'vitest'
import { goalCycleInputSchema, journalSchema } from '../../../shared/domain'
import { createDemo, demoAnswers } from './demo'
import { shiftDate, today } from './dates'
import { currentWeight, effectiveCycle, goalForDay, startDemoCycle, validateCycleStart } from './goals'
import { generatePlan } from './training/generator'

describe('nutrition goals', () => {
  const day = today()
  const next = {
    kind: 'muscle_gain' as const, startDate: day, endDate: shiftDate(day, 60),
    startWeightKg: 74.2, targetWeightKg: 77,
    calorieGoal: 2600, proteinGoal: 150, carbsGoal: 330, fatGoal: 75, waterGoal: 2700,
  }

  it('validates dates, weight and all approved targets', () => {
    expect(goalCycleInputSchema.safeParse(next).success).toBe(true)
    expect(goalCycleInputSchema.safeParse({ ...next, endDate: shiftDate(day, -1) }).success).toBe(false)
    expect(goalCycleInputSchema.safeParse({ ...next, startWeightKg: Number.NaN }).success).toBe(false)
    expect(goalCycleInputSchema.safeParse({ ...next, calorieGoal: 0 }).success).toBe(false)
  })

  it('uses the most recent measurement, then the cycle starting weight, without inventing a value', () => {
    const journal = createDemo()
    expect(currentWeight(journal)).toBe(74.2)
    expect(currentWeight({ ...journal, measurements: [] })).toBe(74.8)
    expect(currentWeight({ ...journal, measurements: [], goals: { setupDone: true, cycles: [] } })).toBeNull()
  })

  it('keeps historical daily targets and never changes the approved target when a period ends', () => {
    const journal = createDemo()
    const first = journal.goals.cycles[0]
    expect(goalForDay(journal, shiftDate(first.startDate, -1))).toBeNull()
    expect(goalForDay(journal, day)?.calorieGoal).toBe(2200)
    expect(effectiveCycle(journal, shiftDate(first.endDate, 1))).toBeNull()
    expect(goalForDay(journal, shiftDate(first.endDate, 1))?.calorieGoal).toBe(2200)
    const updated = startDemoCycle(journal, crypto.randomUUID(), next)
    expect(goalForDay(updated, first.startDate)?.calorieGoal).toBe(2200)
    expect(goalForDay(updated, day)?.calorieGoal).toBe(2600)
    expect(updated.profile.calorieGoal).toBe(2600)
    expect(updated.goals.cycles).toHaveLength(2)
    expect(updated.goals.cycles[0]).toMatchObject({ status: 'completed', endDate: day })
    expect(updated.goals.cycles[1]).toMatchObject({ status: 'active', startDate: day, targetWeightKg: 77 })
    expect(updated.measurements).toHaveLength(journal.measurements.length)
  })

  it('rejects a conflicting same-day measurement without mutating the original journal', () => {
    const journal = createDemo()
    expect(() => startDemoCycle(journal, crypto.randomUUID(), { ...next, startWeightKg: 80 })).toThrow('inny pomiar')
    expect(journal.profile.calorieGoal).toBe(2200)
    expect(journal.goals.cycles).toHaveLength(1)
    expect(journal.measurements.find((item) => item.date === day)?.weightKg).toBe(74.2)
  })

  it('allows only manual targets for a demo user aged 16–17', () => {
    const journal = createDemo()
    journal.training.plan = generatePlan({ ...demoAnswers, age: 17 })
    expect(() => validateCycleStart(next, journal)).toThrow('poniżej 18 lat')
    expect(validateCycleStart({ ...next, kind: 'manual' }, journal).kind).toBe('manual')
  })

  it('loads older journals and exports without a cycle history', () => {
    const journal = createDemo()
    const legacy: Record<string, unknown> = { ...journal }
    delete legacy.goals
    expect(journalSchema.parse(legacy).goals).toEqual({ setupDone: true, cycles: [] })
  })
})

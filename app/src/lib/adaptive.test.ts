import { describe, expect, it } from 'vitest'
import { goalCycleInputSchema, journalSchema, type Journal } from '../../../shared/domain'
import { adaptiveInsight, kcalFloor, plannedBand, weightTrend } from './adaptive'
import { createDemo, demoFoods } from './demo'
import { shiftDate, today } from './dates'

const day = today()

function build(options: {
  kind?: 'reduction' | 'maintenance' | 'muscle_gain' | 'manual'
  weights: [number, number][]
  mealDays?: number
  kcalPortion?: number
  calorieGoal?: number
  targetWeightKg?: number | null
  sex?: 'female' | 'male'
}): Journal {
  const journal = createDemo()
  const portion = options.kcalPortion ?? 600
  const meals = Array.from({ length: options.mealDays ?? 12 }, (_, index) => ({
    id: crypto.randomUUID(), date: shiftDate(day, -index), meal: 'lunch' as const, food: demoFoods[4]!, portion,
  }))
  // 130 kcal per 100 g rice -> 780 kcal at 600 g; two items make a plausible day.
  const doubled = meals.flatMap((meal) => [meal, { ...meal, id: crypto.randomUUID(), meal: 'dinner' as const }])
  const cycle = journal.goals.cycles[0]!
  const answers = journal.training.plan ? { ...journal.training.plan.answers, ...(options.sex ? { sex: options.sex } : {}) } : null
  return journalSchema.parse({
    ...journal,
    meals: doubled,
    measurements: options.weights.map(([offset, weightKg]) => ({ id: crypto.randomUUID(), date: shiftDate(day, offset), weightKg })),
    goals: {
      setupDone: true,
      cycles: [{
        ...cycle, kind: options.kind ?? 'reduction', startDate: shiftDate(day, -30), endDate: shiftDate(day, 60),
        calorieGoal: options.calorieGoal ?? 2200, targetWeightKg: options.targetWeightKg === undefined ? 70 : options.targetWeightKg,
      }],
    },
    training: journal.training.plan && answers
      ? { ...journal.training, plan: { ...journal.training.plan, answers } } : journal.training,
  })
}

describe('weight trend', () => {
  it('computes the least-squares slope in kg per week', () => {
    const trend = weightTrend([
      { date: shiftDate(day, -14), value: 80 }, { date: shiftDate(day, -7), value: 79.5 }, { date: day, value: 79 },
    ])
    expect(trend?.weeklyKg).toBe(-0.5)
    expect(trend?.weighIns).toBe(3)
    expect(weightTrend([{ date: day, value: 80 }])).toBeNull()
  })

  it('scales the planned band with body weight', () => {
    expect(plannedBand('reduction', 80)).toEqual([-0.6, -0.2])
    expect(plannedBand('maintenance', 80)).toEqual([-0.2, 0.2])
  })
})

describe('adaptive goal suggestions', () => {
  it('does not apply to manual cycles', () => {
    expect(adaptiveInsight(build({ kind: 'manual', weights: [[-12, 80], [-6, 80], [0, 80]] }), day)).toBeNull()
  })

  it('asks for more data instead of guessing', () => {
    const result = adaptiveInsight(build({ weights: [[0, 80]] }), day)
    expect(result?.status).toBe('insufficient')
    const sparse = adaptiveInsight(build({ weights: [[-12, 80], [-6, 80], [0, 80]], mealDays: 3 }), day)
    expect(sparse?.status === 'insufficient' && sparse.reasons.some((reason) => reason.includes('posiłki'))).toBe(true)
    const stale = adaptiveInsight(build({ weights: [[-16, 80], [-12, 80], [-8, 80]] }), day)
    expect(stale?.status === 'insufficient' && stale.reasons.some((reason) => reason.includes('starszy'))).toBe(true)
  })

  it('stays quiet when the trend matches the phase', () => {
    const result = adaptiveInsight(build({ weights: [[-12, 80.6], [-6, 80.3], [0, 80]] }), day)
    expect(result?.status).toBe('on-track')
  })

  it('proposes a small decrease when a reduction stalls, keeping protein and fat', () => {
    const journal = build({ weights: [[-12, 80], [-6, 80.1], [0, 80]] })
    const result = adaptiveInsight(journal, day)
    expect(result?.status).toBe('suggest')
    if (result?.status !== 'suggest') return
    expect(result.direction).toBe('decrease')
    expect(result.deltaKcal).toBeLessThan(0)
    expect(result.deltaKcal).toBeGreaterThanOrEqual(-200)
    expect(result.proposal.calorieGoal).toBe(2200 + result.deltaKcal)
    expect(result.proposal.proteinGoal).toBe(journal.goals.cycles[0]!.proteinGoal)
    expect(result.proposal.fatGoal).toBe(journal.goals.cycles[0]!.fatGoal)
    expect(result.proposal.startDate).toBe(day)
    expect(goalCycleInputSchema.safeParse(result.proposal).success).toBe(true)
  })

  it('proposes more energy when weight falls too fast', () => {
    const result = adaptiveInsight(build({ weights: [[-12, 82], [-6, 80.5], [0, 79]] }), day)
    expect(result?.status === 'suggest' && result.direction === 'increase' && result.deltaKcal >= 100).toBe(true)
  })

  it('suggests more energy for a stalled muscle gain', () => {
    const result = adaptiveInsight(build({ kind: 'muscle_gain', targetWeightKg: 90, weights: [[-12, 80], [-6, 80], [0, 80]] }), day)
    expect(result?.status === 'suggest' && result.direction === 'increase').toBe(true)
  })

  it('never proposes less than the safety floor', () => {
    expect(kcalFloor(build({ weights: [[0, 80]], sex: 'female' }))).toBe(1200)
    const result = adaptiveInsight(build({ weights: [[-12, 80], [-6, 80.2], [0, 80.2]], calorieGoal: 1500, sex: 'male' }), day)
    expect(result?.status).toBe('insufficient')
  })

  it('recognises a reached target weight', () => {
    const result = adaptiveInsight(build({ weights: [[-12, 70.5], [-6, 70.2], [0, 69.8]], targetWeightKg: 70 }), day)
    expect(result?.status).toBe('goal-reached')
  })
})

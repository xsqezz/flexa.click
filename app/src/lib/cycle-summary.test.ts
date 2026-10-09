import { describe, expect, it } from 'vitest'
import { createDemo } from './demo'
import { cycleSummary, nextCycleHint } from './cycle-summary'
import { today } from './dates'

describe('cycle summary', () => {
  it('summarises the demo cycle from real entries only', () => {
    const journal = createDemo()
    const cycle = journal.goals.cycles[0]!
    const summary = cycleSummary(journal, cycle, today())
    expect(summary.elapsedDays).toBe(22)
    expect(summary.startWeightKg).toBe(74.8)
    expect(summary.latestWeightKg).toBe(74.2)
    expect(summary.changeKg).toBe(-0.6)
    expect(summary.loggedDays).toBeGreaterThan(0)
    expect(summary.averageKcal).not.toBeNull()
    expect(summary.averageDeviation).toBe(summary.averageKcal! - cycle.calorieGoal)
  })

  it('returns nulls instead of zeros without data', () => {
    const journal = { ...createDemo(), meals: [], measurements: [] }
    const summary = cycleSummary(journal, journal.goals.cycles[0]!, today())
    expect(summary.averageKcal).toBeNull()
    expect(summary.changeKg).toBeNull()
    expect(summary.weeklyKg).toBeNull()
  })

  it('offers no hint for manual cycles', () => {
    expect(nextCycleHint('manual')).toBeNull()
    expect(nextCycleHint('reduction')).toContain('utrzymania')
  })
})

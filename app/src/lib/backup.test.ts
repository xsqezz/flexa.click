import { describe, expect, it } from 'vitest'
import type { Journal } from '../../../shared/domain'
import { createDemo, demoAnswers } from './demo'
import { journalExportText } from './export'
import { importedFoodId, parseBackup, planImport } from './backup'
import { shiftDate, today } from './dates'
import { isUuid } from './ids'
import { generatePlan } from './training/generator'

const options = { replaceProfile: false, restorePlan: false }
const clone = (journal: Journal): Journal => structuredClone(journal)

describe('backup parsing', () => {
  it('reads the current export and version 1 files without templates', () => {
    const journal = createDemo()
    const current = parseBackup(journalExportText(journal, 'cloud', new Date('2026-10-08T10:00:00Z')))
    expect(current).toMatchObject({ version: 2, mode: 'cloud', exportedAt: '2026-10-08T10:00:00.000Z' })
    expect(current.journal.meals).toHaveLength(journal.meals.length)
    const legacyData: Record<string, unknown> = { ...journal }
    delete legacyData.mealTemplates
    delete legacyData.training
    delete legacyData.goals
    const legacy = parseBackup(`\uFEFF${JSON.stringify({ format: 'flexa-journal', version: 1, exportedAt: '2026-10-01T08:00:00Z', mode: 'demo', data: legacyData })}`)
    expect(legacy.version).toBe(1)
    expect(legacy.journal.mealTemplates).toEqual([])
    expect(legacy.journal.goals).toEqual({ setupDone: true, cycles: [] })
  })

  it('explains what is wrong instead of importing a broken file', () => {
    expect(() => parseBackup('{oops')).toThrow('JSON')
    expect(() => parseBackup('{"hello":1}')).toThrow('To nie jest kopia')
    expect(() => parseBackup('{"format":"flexa-journal","version":9,"data":{}}')).toThrow('nowszej wersji')
    const journal = createDemo()
    const broken = JSON.parse(journalExportText(journal, 'demo')) as { data: { meals: { portion: number }[] } }
    broken.data.meals[2].portion = -1
    expect(() => parseBackup(JSON.stringify(broken))).toThrow('posiłki, wpis 3')
  })
})

describe('import merge plan', () => {
  it('adds nothing when the same diary is restored again', () => {
    const journal = createDemo()
    const preview = planImport(journal, clone(journal), options)
    expect(preview.total).toBe(0)
    expect(preview.counts.meals).toEqual({ inFile: journal.meals.length, added: 0, present: journal.meals.length })
    expect(preview.measurementConflicts).toBe(0)
  })

  it('adds only missing entries, counting identical entries and keeping existing measurements', () => {
    const existing = createDemo()
    const backup = clone(existing)
    const meal = backup.meals[0]
    backup.meals.push({ ...meal, id: crypto.randomUUID() }, { ...meal, id: crypto.randomUUID(), portion: meal.portion + 1 })
    backup.water.push({ id: crypto.randomUUID(), date: existing.water[0].date, amountMl: existing.water[0].amountMl })
    backup.workouts.push({ ...backup.workouts[0], id: crypto.randomUUID(), importHash: 'b'.repeat(64) })
    backup.workouts.push({ ...backup.workouts[0], id: crypto.randomUUID(), importHash: 'b'.repeat(64) })
    backup.measurements[0] = { ...backup.measurements[0], weightKg: 99 }
    backup.measurements.push({ id: crypto.randomUUID(), date: '2001-01-01', weightKg: 70 })
    backup.customFoods.push({ ...existing.meals[0].food, id: 'legacy-id', source: 'custom', name: 'Owsianka domowa' })
    backup.mealTemplates.push({ id: crypto.randomUUID(), name: 'Moje śniadanie', items: [{ food: meal.food, portion: 50 }] })
    existing.mealTemplates.push({ id: crypto.randomUUID(), name: 'Kolacja', items: [{ food: meal.food, portion: 50 }] })
    backup.mealTemplates.push({ id: crypto.randomUUID(), name: ' kolacja ', items: [{ food: meal.food, portion: 60 }] })

    const preview = planImport(existing, backup, options)
    expect(preview.counts.meals.added).toBe(2)
    expect(preview.payload.meals.map((item) => item.portion)).toEqual([meal.portion, meal.portion + 1])
    expect(preview.payload.meals[0]).not.toHaveProperty('id')
    expect(preview.counts.water.added).toBe(1)
    expect(preview.counts.workouts.added).toBe(1)
    expect(preview.counts.measurements).toEqual({ inFile: existing.measurements.length + 1, added: 1, present: existing.measurements.length })
    expect(preview.measurementConflicts).toBe(1)
    expect(preview.payload.customFoods).toHaveLength(1)
    expect(isUuid(preview.payload.customFoods[0].id)).toBe(true)
    expect(preview.payload.customFoods[0].id).toBe(importedFoodId('legacy-id'))
    expect(preview.payload.mealTemplates.map((template) => template.name)).toEqual(['Moje śniadanie'])
    expect(preview.payload.profile).toBeNull()
    expect(preview.payload.plan).toBeNull()
    expect(preview.total).toBe(2 + 1 + 1 + 1 + 1 + 1)

    const again = planImport({
      ...existing, customFoods: [...existing.customFoods, ...preview.payload.customFoods],
    }, backup, options)
    expect(again.counts.customFoods.added).toBe(0)
  })

  it('replaces goals and restores the plan only when asked, skipping health data without consent', () => {
    const existing = createDemo()
    const backup = clone(existing)
    backup.profile = { ...backup.profile, calorieGoal: 1800 }
    expect(planImport(existing, backup, { replaceProfile: true, restorePlan: true }).payload.profile?.calorieGoal).toBe(1800)
    expect(planImport(existing, backup, { replaceProfile: true, restorePlan: true }).payload.plan).toEqual(backup.training.plan)
    backup.training.plan = { ...generatePlan(demoAnswers), answers: { ...demoAnswers, limitations: ['knees'], healthConsent: false } }
    const preview = planImport(existing, backup, { replaceProfile: false, restorePlan: true })
    expect(preview.payload.plan).toBeNull()
    expect(preview.planNote).toMatch(/zgody/)
    expect(preview.hasPlan).toBe(true)
  })

  it('previews archived cycles separately, changes their IDs, and never imports an active cycle', () => {
    const existing = createDemo()
    const backup = clone(existing)
    existing.goals.cycles = []
    const historic = {
      ...backup.goals.cycles[0], id: crypto.randomUUID(), status: 'completed' as const,
      startDate: shiftDate(today(), -90), endDate: shiftDate(today(), -40),
      completedAt: new Date().toISOString(),
    }
    backup.goals.cycles.push(historic)
    const withoutConsent = planImport(existing, backup, options)
    expect(withoutConsent.goalsInFile).toBe(2)
    expect(withoutConsent.goalsRestorable).toBe(1)
    expect(withoutConsent.payload.goalCycles).toEqual([])
    expect(withoutConsent.goalCycleNote).toMatch(/Aktywnych/)

    const accepted = planImport(existing, backup, { ...options, restoreGoalHistory: true })
    expect(accepted.payload.goalCycles).toHaveLength(1)
    expect(accepted.payload.goalCycles[0]).toMatchObject({ kind: historic.kind, status: 'completed' })
    expect(accepted.payload.goalCycles[0].id).not.toBe(historic.id)
    expect(accepted.total).toBe(1)
    expect(planImport(backup, backup, { ...options, restoreGoalHistory: true }).goalsRestorable).toBe(0)
  })

  it('restores missing custom workouts by name and leaves existing ones alone', () => {
    const existing = createDemo()
    existing.workoutTemplates = [{ id: crypto.randomUUID(), name: 'Siłownia A', kind: 'strength', minutes: 50, sets: [] }]
    const backup = clone(existing)
    backup.workoutTemplates.push({ id: crypto.randomUUID(), name: 'Bieg 5 km', kind: 'run', minutes: 30, sets: [] })
    backup.workoutTemplates.push({ id: crypto.randomUUID(), name: ' siłownia a ', kind: 'other', minutes: 10, sets: [] })
    const preview = planImport(existing, backup, options)
    expect(preview.payload.workoutTemplates.map((item) => item.name)).toEqual(['Bieg 5 km'])
    expect(preview.counts.workoutTemplates).toEqual({ inFile: 3, added: 1, present: 2 })
    expect(preview.total).toBe(1)
  })
})

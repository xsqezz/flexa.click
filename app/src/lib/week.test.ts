import { describe, expect, it } from 'vitest'
import type { Journal } from '../../../shared/domain'
import { weekSummary } from './week'

const food = {
  id: 'f', name: 'Owsianka', brand: '', barcode: null, unit: 'g' as const, source: 'custom' as const,
  nutrients: { kcal: 400, protein: null, carbs: null, fat: null, fiber: null },
}
const meal = (date: string, portion: number) => ({ id: crypto.randomUUID(), date, meal: 'breakfast' as const, food, portion })
const workout = (date: string, minutes: number) => ({
  id: crypto.randomUUID(), date, name: 'Spacer', kind: 'walk' as const, minutes,
  distanceKm: null, calories: null, effort: null, elevationM: null, importHash: null,
})

function journal(patch: Partial<Journal> = {}): Journal {
  return {
    profile: { displayName: 'Test', calorieGoal: 2000, proteinGoal: 100, carbsGoal: 200, fatGoal: 60, waterGoal: 2000, weeklyMinutesGoal: 150, targetWeight: null },
    goals: { setupDone: true, cycles: [] },
    meals: [], workouts: [], water: [], measurements: [], customFoods: [],
    training: { onboardingDone: true, plan: null, unreadable: false },
    mealTemplates: [],
    workoutTemplates: [],
    ...patch,
  }
}

describe('weekly summary', () => {
  // 2026-10-05 is a Monday; the selected Thursday belongs to the week 5–11 October.
  const date = '2026-10-08'
  it('counts the Monday–Sunday week of the selected date and the week before', () => {
    const summary = weekSummary(journal({
      meals: [meal('2026-10-05', 500), meal('2026-10-05', 100), meal('2026-10-11', 250), meal('2026-10-12', 1000), meal('2026-10-04', 300)],
      workouts: [workout('2026-10-06', 30), workout('2026-10-11', 45), workout('2026-09-28', 20), workout('2026-10-12', 60)],
      water: [
        { id: crypto.randomUUID(), date: '2026-10-06', amountMl: 1500 }, { id: crypto.randomUUID(), date: '2026-10-06', amountMl: 500 },
        { id: crypto.randomUUID(), date: '2026-10-07', amountMl: 1900 },
      ],
    }), date)
    expect(summary.current).toMatchObject({ start: '2026-10-05', end: '2026-10-11', foodDays: 2, minutes: 75, workouts: 2, waterDays: 1 })
    expect(summary.current.averageKcal).toBeCloseTo((2400 + 1000) / 2)
    expect(summary.previous).toMatchObject({ start: '2026-09-28', end: '2026-10-04', foodDays: 1, minutes: 20, workouts: 1, waterDays: 0 })
    expect(summary.previous.averageKcal).toBeCloseTo(1200)
    expect(summary.minutesGoal).toBe(150)
  })
  it('compares the latest weights of both weeks and keeps unknowns empty', () => {
    const measurement = (day: string, weightKg: number) => ({ id: crypto.randomUUID(), date: day, weightKg })
    const both = weekSummary(journal({ measurements: [measurement('2026-10-09', 74.2), measurement('2026-10-06', 74.6), measurement('2026-10-01', 75), measurement('2026-09-29', 75.4)] }), date)
    expect(both.current.weight).toEqual({ date: '2026-10-09', value: 74.2 })
    expect(both.previous.weight).toEqual({ date: '2026-10-01', value: 75 })
    expect(both.weightChange).toBe(-0.8)
    const empty = weekSummary(journal({ measurements: [measurement('2026-10-06', 74.6)] }), date)
    expect(empty.weightChange).toBeNull()
    expect(empty.previous).toMatchObject({ foodDays: 0, averageKcal: null, weight: null })
  })
})

import { describe, expect, it } from 'vitest'
import { profileSchema } from '../../../shared/domain'
import { energyInputProblem, estimateEnergy } from './energy'

describe('energy estimate (Mifflin–St Jeor)', () => {
  it('matches hand-calculated reference values', () => {
    expect(estimateEnergy({ sex: 'female', age: 30, heightCm: 165, weightKg: 60, activity: 'moderate', goal: 'maintain' }))
      .toEqual({ bmr: 1320, maintenance: 2046, calories: 2050, protein: 96, fat: 57, carbs: 288, water: 2100 })
    expect(estimateEnergy({ sex: 'male', age: 40, heightCm: 180, weightKg: 80, activity: 'sedentary', goal: 'lose' }))
      .toEqual({ bmr: 1730, maintenance: 2076, calories: 1870, protein: 128, fat: 52, carbs: 223, water: 2800 })
    expect(estimateEnergy({ sex: 'male', age: 25, heightCm: 190, weightKg: 120, activity: 'very-active', goal: 'gain' }))
      .toEqual({ bmr: 2268, maintenance: 4308, calories: 4740, protein: 192, fat: 132, carbs: 696, water: 4200 })
  })

  it('caps protein and keeps every value within the profile limits', () => {
    const heavy = estimateEnergy({ sex: 'male', age: 30, heightCm: 180, weightKg: 150, activity: 'moderate', goal: 'maintain' })
    expect(heavy.protein).toBe(200)
    const light = estimateEnergy({ sex: 'female', age: 100, heightCm: 120, weightKg: 30, activity: 'sedentary', goal: 'lose' })
    expect(light.carbs).toBeGreaterThanOrEqual(0)
    expect(light.water).toBe(1050)
    for (const estimate of [heavy, light]) {
      expect(profileSchema.safeParse({
        displayName: 'Test', calorieGoal: estimate.calories, proteinGoal: estimate.protein,
        carbsGoal: estimate.carbs, fatGoal: estimate.fat, waterGoal: estimate.water,
        weeklyMinutesGoal: 150, targetWeight: null,
      }).success).toBe(true)
    }
  })

  it('is not offered under 18 and validates the ranges', () => {
    expect(energyInputProblem({ sex: 'female', age: 17, heightCm: 165, weightKg: 60, activity: 'light', goal: 'maintain' })).toMatch(/dorosłych/)
    expect(() => estimateEnergy({ sex: 'female', age: 16, heightCm: 165, weightKg: 60, activity: 'light', goal: 'maintain' })).toThrow(/18/)
    expect(energyInputProblem({ sex: 'female', age: 101, heightCm: 165, weightKg: 60, activity: 'light', goal: 'maintain' })).toMatch(/100/)
    expect(energyInputProblem({ sex: 'male', age: 30, heightCm: 90, weightKg: 60, activity: 'light', goal: 'maintain' })).toMatch(/wzrost/)
    expect(energyInputProblem({ sex: 'male', age: 30, heightCm: 180, weightKg: Number.NaN, activity: 'light', goal: 'maintain' })).toMatch(/masę/)
    expect(energyInputProblem({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'light', goal: 'maintain' })).toBeNull()
  })
})

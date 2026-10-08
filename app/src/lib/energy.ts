import type { Profile } from '../../../shared/domain'

export type Sex = 'female' | 'male'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active'
export type EnergyGoal = 'maintain' | 'lose' | 'gain'

export const activityLevels: { id: ActivityLevel; factor: number; label: string; description: string }[] = [
  { id: 'sedentary', factor: 1.2, label: 'Niska', description: 'Głównie siedzę, mało chodzę, nie trenuję.' },
  { id: 'light', factor: 1.375, label: 'Lekka', description: 'Spacery lub lekki trening 1–3 razy w tygodniu.' },
  { id: 'moderate', factor: 1.55, label: 'Umiarkowana', description: 'Trening 3–5 razy w tygodniu albo dużo ruchu na co dzień.' },
  { id: 'active', factor: 1.725, label: 'Wysoka', description: 'Intensywny trening 6–7 razy w tygodniu.' },
  { id: 'very-active', factor: 1.9, label: 'Bardzo wysoka', description: 'Praca fizyczna i codzienny trening albo dwa treningi dziennie.' },
]

export const energyGoals: { id: EnergyGoal; factor: number; label: string; description: string }[] = [
  { id: 'maintain', factor: 1, label: 'Utrzymanie', description: 'Tyle, ile szacunkowo zużywasz.' },
  { id: 'lose', factor: 0.9, label: 'Powolna redukcja', description: 'Około 10% mniej niż utrzymanie.' },
  { id: 'gain', factor: 1.1, label: 'Powolny wzrost', description: 'Około 10% więcej niż utrzymanie.' },
]

export type EnergyInput = {
  sex: Sex; age: number; heightCm: number; weightKg: number; activity: ActivityLevel; goal: EnergyGoal
}

export type EnergyEstimate = {
  bmr: number; maintenance: number
  calories: number; protein: number; fat: number; carbs: number; water: number
}

export const energyLimits = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
} as const

/** Zwraca opis problemu z danymi albo `null`, gdy można liczyć. */
export function energyInputProblem(input: Partial<EnergyInput>): string | null {
  const { age, heightCm, weightKg } = input
  if (age === undefined || !Number.isFinite(age)) return 'Podaj wiek w pełnych latach.'
  if (age < energyLimits.age.min) return 'Kalkulator jest przeznaczony dla dorosłych. U osób poniżej 18 lat zapotrzebowanie zależy od wzrastania, dlatego go nie liczymy — porozmawiaj o tym z lekarzem lub dietetykiem.'
  if (age > energyLimits.age.max) return 'Wzór działa dla wieku od 18 do 100 lat.'
  if (heightCm === undefined || !Number.isFinite(heightCm) || heightCm < energyLimits.heightCm.min || heightCm > energyLimits.heightCm.max) {
    return `Podaj wzrost od ${energyLimits.heightCm.min} do ${energyLimits.heightCm.max} cm.`
  }
  if (weightKg === undefined || !Number.isFinite(weightKg) || weightKg < energyLimits.weightKg.min || weightKg > energyLimits.weightKg.max) {
    return `Podaj masę ciała od ${energyLimits.weightKg.min} do ${energyLimits.weightKg.max} kg.`
  }
  if (!input.sex || !input.activity || !input.goal) return 'Uzupełnij wszystkie pola.'
  return null
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Mifflin–St Jeor BMR × activity factor, adjusted by the chosen goal. Macros: protein 1.6 g/kg (max 200 g and
 * max 35% of energy), fat 25% of energy, carbohydrates the remainder; water 35 ml/kg. Clamped to the profile limits.
 */
export function estimateEnergy(input: EnergyInput): EnergyEstimate {
  const problem = energyInputProblem(input)
  if (problem) throw new Error(problem)
  const activity = activityLevels.find((level) => level.id === input.activity)
  const goal = energyGoals.find((item) => item.id === input.goal)
  if (!activity || !goal) throw new Error('Nieznany poziom aktywności lub cel.')
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + (input.sex === 'male' ? 5 : -161)
  const maintenance = bmr * activity.factor
  const calories = clamp(Math.round(maintenance * goal.factor / 10) * 10, 500, 10000)
  const protein = clamp(Math.round(Math.min(1.6 * input.weightKg, 200, calories * 0.35 / 4)), 0, 500)
  const fat = clamp(Math.round(calories * 0.25 / 9), 0, 500)
  const carbs = clamp(Math.round((calories - protein * 4 - fat * 9) / 4), 0, 1000)
  const water = clamp(Math.round(35 * input.weightKg / 50) * 50, 500, 6000)
  return { bmr: Math.round(bmr), maintenance: Math.round(maintenance), calories, protein, fat, carbs, water }
}

export function goalsFromEstimate(profile: Profile, estimate: EnergyEstimate): Profile {
  return {
    ...profile, calorieGoal: estimate.calories, proteinGoal: estimate.protein,
    carbsGoal: estimate.carbs, fatGoal: estimate.fat, waterGoal: estimate.water,
  }
}

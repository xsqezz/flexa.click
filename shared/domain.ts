import { z } from 'zod'
import { trainingStateSchema } from './training.ts'

export const CONSENT_VERSION = '2026-10-06'
export const dateSchema = z.iso.date().refine((value) => value >= '1900-01-01' && value <= '2100-12-31', {
  message: 'Data musi mieścić się w latach 1900–2100.',
})
const barcodeSchema = z.string().refine(isValidBarcode, {
  message: 'Kod musi być prawidłowym GTIN (EAN-8, UPC-A, EAN-13 lub GTIN-14).',
})
const optionalNutrient = z.number().finite().nonnegative().max(2000).nullable()

export const foodSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  brand: z.string().max(100),
  barcode: barcodeSchema.nullable(),
  unit: z.enum(['g', 'ml']).nullable(),
  source: z.enum(['open-food-facts', 'usda', 'custom', 'demo']),
  estimated: z.boolean().optional(),
  nutrients: z.object({
    kcal: optionalNutrient,
    protein: optionalNutrient,
    carbs: optionalNutrient,
    fat: optionalNutrient,
    fiber: optionalNutrient,
  }),
})

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  calorieGoal: z.number().finite().min(500).max(10000),
  proteinGoal: z.number().finite().nonnegative().max(500),
  carbsGoal: z.number().finite().nonnegative().max(1000),
  fatGoal: z.number().finite().nonnegative().max(500),
  waterGoal: z.number().int().min(500).max(6000),
  weeklyMinutesGoal: z.number().int().nonnegative().max(10000),
  targetWeight: z.number().min(20).max(500).nullable(),
})

export const mealNames = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąski',
} as const

export const mealSchema = z.object({
  id: z.uuid(),
  date: dateSchema,
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  food: foodSchema.refine((food) => food.nutrients.kcal !== null, {
    message: 'Ten produkt nie ma wartości energetycznej. Uzupełnij ją z etykiety.',
  }).refine((food) => food.unit !== null, {
    message: 'Potwierdź, czy wartości dotyczą 100 g czy 100 ml.',
  }),
  portion: z.number().finite().positive().max(10000),
})

/** A named set of products ("Zestaw"), e.g. a usual breakfast, added to a meal with one tap. */
export const mealTemplateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60),
  items: z.array(z.object({ food: mealSchema.shape.food, portion: mealSchema.shape.portion })).min(1).max(30),
})

export const workoutNames = {
  run: 'Bieg',
  ride: 'Rower',
  walk: 'Spacer',
  strength: 'Trening siłowy',
  other: 'Inna aktywność',
} as const

/** One logged set: `exercise` is a library id or a free name typed by the user. */
export const workoutSetSchema = z.object({
  exercise: z.string().trim().min(1).max(80),
  reps: z.number().int().min(1).max(100).nullable(),
  weightKg: z.number().finite().min(0).max(500).nullable(),
  seconds: z.number().int().min(1).max(36000).nullable(),
})

export const workoutSchema = z.object({
  id: z.uuid(),
  date: dateSchema,
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['run', 'ride', 'walk', 'strength', 'other']),
  minutes: z.number().finite().positive().max(1440),
  distanceKm: z.number().finite().nonnegative().max(2000).nullable(),
  calories: z.number().finite().nonnegative().max(30000).nullable(),
  effort: z.number().int().min(1).max(10).nullable(),
  elevationM: z.number().finite().nonnegative().max(100000).nullable(),
  importHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  sets: z.array(workoutSetSchema).max(200).optional(),
})

export const waterSchema = z.object({
  id: z.uuid(),
  date: dateSchema,
  amountMl: z.number().int().positive().max(3000),
})

export const measurementSchema = z.object({
  id: z.uuid(),
  date: dateSchema,
  weightKg: z.number().finite().min(20).max(500),
  waistCm: z.number().finite().min(40).max(250).nullable().optional(),
  hipsCm: z.number().finite().min(40).max(250).nullable().optional(),
  bodyFatPct: z.number().finite().min(2).max(70).nullable().optional(),
})

export const journalSchema = z.object({
  profile: profileSchema,
  meals: z.array(mealSchema),
  workouts: z.array(workoutSchema),
  water: z.array(waterSchema),
  measurements: z.array(measurementSchema),
  customFoods: z.array(foodSchema),
  training: trainingStateSchema.default({ onboardingDone: true, plan: null, unreadable: false }),
  mealTemplates: z.array(mealTemplateSchema).default([]),
})

export const searchRequestSchema = z.object({
  query: z.string().trim().min(2).max(80).optional(),
  barcode: barcodeSchema.optional(),
}).refine((value) => Boolean(value.query) !== Boolean(value.barcode), {
  message: 'Podaj nazwę produktu albo kod kreskowy.',
})

export const searchResponseSchema = z.object({
  foods: z.array(foodSchema),
  warnings: z.array(z.string()),
})

export type Food = z.infer<typeof foodSchema>
export type Profile = z.infer<typeof profileSchema>
export type Meal = z.infer<typeof mealSchema>
export type MealKind = Meal['meal']
export type MealTemplate = z.infer<typeof mealTemplateSchema>
export type Workout = z.infer<typeof workoutSchema>
export type WorkoutSet = z.infer<typeof workoutSetSchema>
export type Water = z.infer<typeof waterSchema>
export type Measurement = z.infer<typeof measurementSchema>
export type Journal = z.infer<typeof journalSchema>
export type SearchRequest = z.infer<typeof searchRequestSchema>
export type SearchResponse = z.infer<typeof searchResponseSchema>
export type Nutrient = keyof Food['nutrients']

export function isValidBarcode(value: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false
  const digits = [...value].map(Number)
  const check = digits.pop()
  const sum = digits.reverse().reduce(
    (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0,
  )
  return (10 - sum % 10) % 10 === check
}

export function sameBarcode(a: string, b: string): boolean {
  return isValidBarcode(a) && isValidBarcode(b)
    && a.padStart(14, '0') === b.padStart(14, '0')
}

import { z } from 'zod'
import {
  journalSchema,
  type Food, type Journal, type Meal, type MealTemplate, type Measurement, type Profile, type Water, type Workout,
} from '../../../shared/domain'
import { needsHealthConsent, type TrainingPlan } from '../../../shared/training'
import { EXPORT_FORMAT } from './export'
import { isUuid, stableUuid } from './ids'
import { isPlanUsable } from './training/generator'

export type Backup = {
  version: 1 | 2
  exportedAt: string | null
  mode: 'demo' | 'cloud' | null
  journal: Journal
}

/** Everything `journal.import` should add. Records have no ids — the repository assigns them. */
export type ImportPayload = {
  meals: Omit<Meal, 'id'>[]
  workouts: Omit<Workout, 'id'>[]
  water: Omit<Water, 'id'>[]
  measurements: Omit<Measurement, 'id'>[]
  customFoods: Food[]
  mealTemplates: Omit<MealTemplate, 'id'>[]
  profile: Profile | null
  plan: TrainingPlan | null
}

export type ImportKind = 'meals' | 'workouts' | 'water' | 'measurements' | 'customFoods' | 'mealTemplates'
export const importKindLabels: Record<ImportKind, string> = {
  meals: 'Posiłki', workouts: 'Treningi', water: 'Woda', measurements: 'Pomiary',
  customFoods: 'Własne produkty', mealTemplates: 'Zestawy',
}

export type ImportCount = { inFile: number; added: number; present: number }

export type ImportPreview = {
  payload: ImportPayload
  counts: Record<ImportKind, ImportCount>
  /** Days present in both places with different values: the existing measurement is kept. */
  measurementConflicts: number
  /** Why the plan from the file will not be restored, if it will not. */
  planNote: string | null
  hasPlan: boolean
  total: number
}

const envelopeSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string().max(40).optional(),
  mode: z.enum(['demo', 'cloud']).optional(),
  data: z.unknown(),
})

const issuePath = (path: readonly PropertyKey[]) => {
  const labels: Record<string, string> = {
    meals: 'posiłki', workouts: 'treningi', water: 'woda', measurements: 'pomiary', customFoods: 'własne produkty',
    mealTemplates: 'zestawy', profile: 'profil', training: 'plan treningowy',
  }
  const [section, index] = path
  const name = labels[String(section)] ?? String(section ?? 'plik')
  return typeof index === 'number' ? `${name}, wpis ${index + 1}` : name
}

/** Reads a Flexa JSON export (version 1 or 2) and validates every record before anything is written. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try { raw = JSON.parse(text.replace(/^\uFEFF/, '')) }
  catch { throw new Error('Ten plik nie jest poprawnym plikiem JSON. Wybierz eksport z Flexy (flexa-….json).') }
  const envelope = envelopeSchema.safeParse(raw)
  if (!envelope.success) {
    const future = typeof raw === 'object' && raw !== null && (raw as { format?: unknown }).format === EXPORT_FORMAT
    throw new Error(future
      ? 'Ta kopia pochodzi z nowszej wersji Flexy albo jest niekompletna. Odśwież aplikację i spróbuj ponownie.'
      : 'To nie jest kopia dziennika Flexa. Wybierz plik pobrany przyciskiem „Eksportuj dane JSON”.')
  }
  const journal = journalSchema.safeParse(envelope.data.data)
  if (!journal.success) {
    const issue = journal.error.issues[0]
    throw new Error(`Kopia zawiera nieprawidłowe dane (${issuePath(issue?.path ?? [])}). Nic nie zostało zapisane.`)
  }
  const exportedAt = envelope.data.exportedAt && !Number.isNaN(Date.parse(envelope.data.exportedAt)) ? envelope.data.exportedAt : null
  return { version: envelope.data.version, exportedAt, mode: envelope.data.mode ?? null, journal: journal.data }
}

const text = (value: string) => value.trim().toLocaleLowerCase('pl-PL')

function withoutId<T extends { id: string }>(item: T): Omit<T, 'id'> {
  const copy: Partial<T> = { ...item }
  delete copy.id
  return copy as Omit<T, 'id'>
}

/** Keeps incoming records whose key is not already present, counting duplicates (two identical entries stay two). */
function missing<T>(existing: readonly T[], incoming: readonly T[], key: (item: T) => string): T[] {
  const available = new Map<string, number>()
  for (const item of existing) available.set(key(item), (available.get(key(item)) ?? 0) + 1)
  return incoming.filter((item) => {
    const count = available.get(key(item)) ?? 0
    if (count > 0) { available.set(key(item), count - 1); return false }
    return true
  })
}

export const mealKey = (meal: Pick<Meal, 'date' | 'meal' | 'food' | 'portion'>) => `${meal.date}|${meal.meal}|${text(meal.food.name)}|${meal.portion}`
const workoutKey = (workout: Workout) => workout.importHash ? `file:${workout.importHash}` : `${workout.date}|${text(workout.name)}|${workout.minutes}`
const foodSignature = (food: Food) => `${text(food.name)}|${text(food.brand)}|${food.unit}|${food.nutrients.kcal}`

/** Custom food ids are database UUIDs in the cloud; older or hand-made ids get a stable UUID instead. */
export function importedFoodId(id: string): string {
  return isUuid(id) ? id : stableUuid(`food:${id}`)
}

export type ImportOptions = { replaceProfile: boolean; restorePlan: boolean }

/** Pure merge plan: what to add so that nothing existing is deleted or overwritten (except opted-in profile/plan). */
export function planImport(existing: Journal, backup: Journal, options: ImportOptions): ImportPreview {
  const meals = missing(existing.meals, backup.meals, mealKey)
  const hashes = new Set(existing.workouts.flatMap((workout) => workout.importHash ? [workout.importHash] : []))
  const workouts = missing(existing.workouts, backup.workouts, workoutKey).filter((workout) => {
    if (!workout.importHash) return true
    if (hashes.has(workout.importHash)) return false
    hashes.add(workout.importHash)
    return true
  })
  const water = missing(existing.water, backup.water, (item) => `${item.date}|${item.amountMl}`)

  const measuredDays = new Map(existing.measurements.map((item) => [item.date, item]))
  let measurementConflicts = 0
  const measurements: Measurement[] = []
  for (const item of backup.measurements) {
    const current = measuredDays.get(item.date)
    if (current) {
      if (JSON.stringify({ ...withoutId(current), date: '' }) !== JSON.stringify({ ...withoutId(item), date: '' })) measurementConflicts++
      continue
    }
    measuredDays.set(item.date, item)
    measurements.push(item)
  }

  const knownFoods = new Set(existing.customFoods.flatMap((food) => [food.id, importedFoodId(food.id)]))
  const knownSignatures = new Set(existing.customFoods.map(foodSignature))
  const customFoods: Food[] = []
  for (const food of backup.customFoods) {
    const id = importedFoodId(food.id)
    if (knownFoods.has(food.id) || knownFoods.has(id) || knownSignatures.has(foodSignature(food))) continue
    knownFoods.add(id)
    knownSignatures.add(foodSignature(food))
    customFoods.push({ ...food, id, source: 'custom' })
  }

  const templateNames = new Set(existing.mealTemplates.map((template) => text(template.name)))
  const mealTemplates = backup.mealTemplates.filter((template) => {
    if (templateNames.has(text(template.name))) return false
    templateNames.add(text(template.name))
    return true
  })

  const plan = backup.training.plan
  let planNote: string | null = null
  let restoredPlan: TrainingPlan | null = null
  if (plan && options.restorePlan) {
    if (!isPlanUsable(plan)) planNote = 'Plan z kopii korzysta z ćwiczeń, których nie ma już w bibliotece, więc go pomijamy. Możesz ułożyć nowy w zakładce Plan.'
    else if (needsHealthConsent(plan.answers) && !plan.answers.healthConsent) planNote = 'Plan z kopii zawiera informacje o zdrowiu bez zgody na ich zapis, więc go pomijamy. Ułóż plan ponownie w zakładce Plan i zaznacz zgodę.'
    else restoredPlan = plan
  }

  const count = (inFile: number, added: number): ImportCount => ({ inFile, added, present: inFile - added })
  const payload: ImportPayload = {
    meals: meals.map(withoutId), workouts: workouts.map(withoutId), water: water.map(withoutId),
    measurements: measurements.map(withoutId), customFoods, mealTemplates: mealTemplates.map(withoutId),
    profile: options.replaceProfile ? backup.profile : null, plan: restoredPlan,
  }
  return {
    payload,
    counts: {
      meals: count(backup.meals.length, meals.length),
      workouts: count(backup.workouts.length, workouts.length),
      water: count(backup.water.length, water.length),
      measurements: count(backup.measurements.length, measurements.length),
      customFoods: count(backup.customFoods.length, customFoods.length),
      mealTemplates: count(backup.mealTemplates.length, mealTemplates.length),
    },
    measurementConflicts,
    planNote,
    hasPlan: plan !== null,
    total: importSize(payload),
  }
}

/** Number of records (plus profile/plan) the import writes; used for progress. */
export function importSize(payload: ImportPayload): number {
  return payload.meals.length + payload.workouts.length + payload.water.length + payload.measurements.length
    + payload.customFoods.length + payload.mealTemplates.length + (payload.profile ? 1 : 0) + (payload.plan ? 1 : 0)
}

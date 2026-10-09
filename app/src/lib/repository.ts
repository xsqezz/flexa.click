import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'
import {
  foodSchema, goalCycleInputSchema, goalCycleSchema, journalSchema, profileSchema, workoutSetSchema,
  type Food, type GoalCycleInput, type Journal, type Meal, type Measurement, type Profile, type Water, type Workout, type WorkoutSet,
} from '../../../shared/domain'
import { needsHealthConsent, trainingPlanSchema, type TrainingPlan, type TrainingState } from '../../../shared/training'
import type { Database, Json, ProfileRow } from './database.types'
import { readDemo, writeDemo } from './demo'
import { isPlanUsable } from './training/generator'
import { mealSchema, mealTemplateSchema, workoutTemplateSchema, type MealTemplate, type WorkoutTemplate } from '../../../shared/domain'
import { importSize, type ImportPayload } from './backup'
import { startDemoCycle } from './goals'
import { today } from './dates'

export type Command =
  | { type: 'profile.save'; value: Profile }
  | { type: 'goals.start'; id: string; value: GoalCycleInput }
  | { type: 'goals.skip' }
  | { type: 'meal.add'; value: Omit<Meal, 'id'> }
  | { type: 'meal.delete'; id: string }
  | { type: 'workout.add'; value: Omit<Workout, 'id'> }
  | { type: 'workout.delete'; id: string }
  | { type: 'water.add'; value: Omit<Water, 'id'> }
  | { type: 'water.delete'; id: string }
  | { type: 'measurement.add'; value: Omit<Measurement, 'id'> }
  | { type: 'measurement.delete'; id: string }
  | { type: 'food.save'; value: Food }
  | { type: 'plan.save'; value: TrainingPlan }
  | { type: 'plan.delete' }
  | { type: 'onboarding.skip' }
  | { type: 'meal.addMany'; value: Omit<Meal, 'id'>[] }
  | { type: 'template.save'; value: Omit<MealTemplate, 'id'> }
  | { type: 'template.delete'; id: string }
  | { type: 'wtemplate.save'; value: Omit<WorkoutTemplate, 'id'> }
  | { type: 'wtemplate.delete'; id: string }
  | { type: 'journal.import'; value: ImportPayload; onProgress?: (saved: number, total: number) => void }

export interface JournalRepository {
  load(signal: AbortSignal): Promise<Journal>
  execute(command: Command): Promise<void>
}

export class DemoRepository implements JournalRepository {
  async load(): Promise<Journal> { return readDemo() }

  async execute(command: Command): Promise<void> {
    const journal = readDemo()
    let updated = journal
    switch (command.type) {
      case 'profile.save': {
        journal.profile = profileSchema.parse(command.value)
        journal.goals.cycles = journal.goals.cycles.map((cycle) => cycle.status === 'active' && cycle.endDate >= today()
          ? { ...cycle, calorieGoal: journal.profile.calorieGoal, proteinGoal: journal.profile.proteinGoal,
            carbsGoal: journal.profile.carbsGoal, fatGoal: journal.profile.fatGoal,
            waterGoal: journal.profile.waterGoal, targetWeightKg: journal.profile.targetWeight } : cycle)
        break
      }
      case 'goals.start': updated = startDemoCycle(journal, command.id, command.value); break
      case 'goals.skip': journal.goals.setupDone = true; break
      case 'meal.add':
        journal.meals.push({ ...command.value, id: crypto.randomUUID() }); break
      case 'meal.delete':
        journal.meals = journal.meals.filter((item) => item.id !== command.id); break
      case 'workout.add':
        if (command.value.importHash && journal.workouts.some((item) => item.importHash === command.value.importHash)) {
          throw new Error('Ten plik został już zaimportowany.')
        }
        journal.workouts.push({ ...command.value, id: crypto.randomUUID() }); break
      case 'workout.delete':
        journal.workouts = journal.workouts.filter((item) => item.id !== command.id); break
      case 'water.add':
        journal.water.push({ ...command.value, id: crypto.randomUUID() }); break
      case 'water.delete':
        journal.water = journal.water.filter((item) => item.id !== command.id); break
      case 'measurement.add':
        journal.measurements = journal.measurements.filter((item) => item.date !== command.value.date)
        journal.measurements.push({ ...command.value, id: crypto.randomUUID() }); break
      case 'measurement.delete':
        journal.measurements = journal.measurements.filter((item) => item.id !== command.id); break
      case 'food.save':
        journal.customFoods = [...journal.customFoods.filter((food) => food.id !== command.value.id), command.value]; break
      case 'plan.save':
        journal.training = { onboardingDone: true, plan: trainingPlanSchema.parse(command.value), unreadable: false }; break
      case 'plan.delete':
        journal.training = { ...journal.training, plan: null, unreadable: false }; break
      case 'onboarding.skip':
        journal.training = { ...journal.training, onboardingDone: true }; break
      case 'meal.addMany':
        journal.meals.push(...validMeals(command.value).map((meal) => ({ ...meal, id: crypto.randomUUID() }))); break
      case 'template.save': {
        const template = mealTemplateSchema.parse({ ...command.value, id: crypto.randomUUID() })
        if (journal.mealTemplates.some((item) => sameTemplateName(item.name, template.name))) throw new Error(templateExists)
        journal.mealTemplates.push(template); break
      }
      case 'template.delete':
        journal.mealTemplates = journal.mealTemplates.filter((item) => item.id !== command.id); break
      case 'wtemplate.save': {
        const template = workoutTemplateSchema.parse({ ...command.value, id: crypto.randomUUID() })
        if (journal.workoutTemplates.some((item) => sameTemplateName(item.name, template.name))) throw new Error(workoutTemplateExists)
        journal.workoutTemplates.push(template); break
      }
      case 'wtemplate.delete':
        journal.workoutTemplates = journal.workoutTemplates.filter((item) => item.id !== command.id); break
      case 'journal.import': importIntoDemo(journal, command.value); break
    }
    writeDemo(updated)
    if (command.type === 'journal.import') command.onProgress?.(importSize(command.value), importSize(command.value))
  }
}

const IMPORT_CHUNK = 200
const workoutTemplateExists = 'Masz już własny trening o tej nazwie. Wybierz inną nazwę albo usuń poprzedni.'
const templateExists = 'Masz już zestaw o tej nazwie. Wybierz inną nazwę albo usuń poprzedni zestaw.'
const sameTemplateName = (a: string, b: string) => a.trim().toLocaleLowerCase('pl-PL') === b.trim().toLocaleLowerCase('pl-PL')

function validMeals(meals: Omit<Meal, 'id'>[]): Omit<Meal, 'id'>[] {
  if (meals.length === 0) throw new Error('Nie ma czego dodać.')
  return meals.map((meal) => mealSchema.omit({ id: true }).parse(meal))
}

/** One local write; never deletes. Existing measurements win over imported ones from the same day. */
function importIntoDemo(journal: Journal, value: ImportPayload): void {
  const withId = <T extends object>(item: T) => ({ ...item, id: crypto.randomUUID() })
  if (value.goalCycles.length) {
    if (journal.goals.cycles.length) throw new Error('Historia cykli już istnieje. Import nie nadpisuje ani nie uruchamia cykli.')
    if (value.goalCycles.length > 1000 || value.goalCycles.some((cycle) => cycle.status !== 'completed' || cycle.endDate > today())) {
      throw new Error('Import dopuszcza wyłącznie zakończone cykle.')
    }
    journal.goals.cycles = value.goalCycles.map((cycle) => goalCycleSchema.parse(cycle))
  }
  if (value.meals.length) journal.meals.push(...validMeals(value.meals).map(withId))
  journal.workouts.push(...value.workouts.filter((workout) => !workout.importHash
    || !journal.workouts.some((item) => item.importHash === workout.importHash)).map(withId))
  journal.water.push(...value.water.map(withId))
  const days = new Set(journal.measurements.map((item) => item.date))
  journal.measurements.push(...value.measurements.filter((item) => !days.has(item.date)).map(withId))
  const foods = new Set(journal.customFoods.map((food) => food.id))
  journal.customFoods.push(...value.customFoods.filter((food) => !foods.has(food.id)).map((food) => foodSchema.parse(food)))
  journal.mealTemplates.push(...value.mealTemplates
    .filter((template) => !journal.mealTemplates.some((item) => sameTemplateName(item.name, template.name)))
    .map((template) => mealTemplateSchema.parse(withId(template))))
  journal.workoutTemplates.push(...value.workoutTemplates
    .filter((template) => !journal.workoutTemplates.some((item) => sameTemplateName(item.name, template.name)))
    .map((template) => workoutTemplateSchema.parse(withId(template))))
  if (value.profile) journal.profile = profileSchema.parse(value.profile)
  if (value.plan) journal.training = { onboardingDone: true, plan: trainingPlanSchema.parse(value.plan), unreadable: false }
}

function result<T>(response: { data: T | null; error: PostgrestError | null }): T {
  if (response.error) {
    if (response.error.code === '23505') throw new Error('Ten wpis już istnieje. Plik mógł zostać wcześniej zaimportowany.')
    if (response.error.code === 'P0001' && /^(Dla daty początku|Nowy cykl|Nie znaleziono profilu|Wymagane logowanie|Historia cykli|Import dopuszcza|Nieprawidłowa historia)/.test(response.error.message)) {
      throw new Error(response.error.message, { cause: response.error })
    }
    if (response.error.code === '23514') throw new Error('Sprawdź daty, rodzaj i wartości celu. Nie zapisano zmian.', { cause: response.error })
    throw new Error(`Nie udało się zapisać lub odczytać danych (${response.error.code || 'sieć'}). Sprawdź połączenie i konfigurację bazy.`, { cause: response.error })
  }
  if (response.data === null) throw new Error('Serwer nie potwierdził operacji. Odśwież dane przed ponowną próbą.')
  return response.data
}

export async function readPages<Row>(
  fetch: (offset: number, end: number) => PromiseLike<{ data: Row[] | null; error: PostgrestError | null }>,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let offset = 0; ; offset += 500) {
    const page = result(await fetch(offset, offset + 499))
    rows.push(...page)
    if (page.length < 500) return rows
  }
}

function profileFromRow(row: ProfileRow): Profile {
  return profileSchema.parse({
    displayName: row.display_name, calorieGoal: row.calorie_goal,
    proteinGoal: row.protein_goal, carbsGoal: row.carbs_goal, fatGoal: row.fat_goal,
    waterGoal: row.water_goal, weeklyMinutesGoal: row.weekly_minutes_goal,
    targetWeight: row.target_weight,
  })
}

export function trainingFromRow(row: { answers: Json; plan: Json } | null, onboardingCompletedAt: string | null | undefined): TrainingState {
  const onboardingDone = Boolean(onboardingCompletedAt) || row !== null
  if (!row) return { onboardingDone, plan: null, unreadable: false }
  const stored = typeof row.plan === 'object' && row.plan !== null && !Array.isArray(row.plan) ? row.plan : {}
  const parsed = trainingPlanSchema.safeParse({ ...stored, answers: row.answers })
  if (!parsed.success || !isPlanUsable(parsed.data)) return { onboardingDone, plan: null, unreadable: true }
  return { onboardingDone, plan: parsed.data, unreadable: false }
}

/** Reads stored sets defensively: one malformed set must not make the whole diary unreadable. */
export function setsFromRow(value: Json | undefined): WorkoutSet[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = workoutSetSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  }).slice(0, 200)
}

export class SupabaseRepository implements JournalRepository {
  private readonly client: SupabaseClient<Database>
  private readonly userId: string

  constructor(client: SupabaseClient<Database>, userId: string) {
    this.client = client
    this.userId = userId
  }

  async load(signal: AbortSignal): Promise<Journal> {
    const client = this.client
    const user = this.userId
    const templates = this.loadTemplates(signal)
    const workoutTemplates = this.loadWorkoutTemplates(signal)
    workoutTemplates.catch(() => {})
    templates.catch(() => {})
    const [profile, meals, workouts, water, measurements, foods, training, cycles] = await Promise.all([
      client.from('profiles').select('*').eq('user_id', user).abortSignal(signal).single(),
      readPages((start, end) => client.from('meal_entries').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      readPages((start, end) => client.from('workouts').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      readPages((start, end) => client.from('water_entries').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      readPages((start, end) => client.from('measurements').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      readPages((start, end) => client.from('custom_foods').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      client.from('training_plans').select('answers, plan').eq('user_id', user).abortSignal(signal).maybeSingle(),
      readPages((start, end) => client.from('goal_cycles').select('*').eq('user_id', user)
        .order('start_date', { ascending: false }).order('created_at', { ascending: false })
        .order('id').range(start, end).abortSignal(signal)),
    ])
    if (training.error) result(training)
    const profileRow = result(profile)
    return journalSchema.parse({
      profile: profileFromRow(profileRow),
      goals: {
        setupDone: profileRow.goals_setup_done_at !== null,
        cycles: cycles.map((row) => ({
          id: row.id, kind: row.kind, startDate: row.start_date, endDate: row.end_date,
          startWeightKg: row.start_weight_kg, targetWeightKg: row.target_weight_kg,
          calorieGoal: row.calorie_goal, proteinGoal: row.protein_goal, carbsGoal: row.carbs_goal,
          fatGoal: row.fat_goal, waterGoal: row.water_goal, status: row.status,
          createdAt: row.created_at, completedAt: row.completed_at,
        })),
      },
      meals: meals.map((row) => ({
        id: row.id, date: row.date, meal: row.meal, food: foodSchema.parse(row.food), portion: row.portion,
      })),
      workouts: workouts.map((row) => ({
        id: row.id, date: row.date, name: row.name, kind: row.kind, minutes: row.minutes,
        distanceKm: row.distance_km, calories: row.calories, effort: row.effort,
        elevationM: row.elevation_m, importHash: row.import_hash, sets: setsFromRow(row.sets),
      })),
      water: water.map((row) => ({ id: row.id, date: row.date, amountMl: row.amount_ml })),
      measurements: measurements.map((row) => ({
        id: row.id, date: row.date, weightKg: row.weight_kg,
        waistCm: row.waist_cm ?? null, hipsCm: row.hips_cm ?? null, bodyFatPct: row.body_fat_pct ?? null,
      })),
      customFoods: foods.map((row) => foodSchema.parse(row.food)),
      training: trainingFromRow(training.data, profileRow.onboarding_completed_at),
      mealTemplates: await templates,
      workoutTemplates: await workoutTemplates,
    })
  }

  /** Custom workouts arrive in their own migration; until it is applied the diary still loads without them. */
  private async loadWorkoutTemplates(signal: AbortSignal): Promise<WorkoutTemplate[]> {
    const client = this.client
    try {
      const rows = await readPages((start, end) => client.from('workout_templates').select('*').eq('user_id', this.userId).order('created_at').order('id').range(start, end).abortSignal(signal))
      return rows.flatMap((row) => {
        const parsed = workoutTemplateSchema.safeParse({ id: row.id, name: row.name, kind: row.kind, minutes: Number(row.minutes), sets: setsFromRow(row.sets) })
        return parsed.success ? [parsed.data] : []
      })
    } catch (cause) {
      const code = cause instanceof Error && typeof cause.cause === 'object' && cause.cause !== null ? (cause.cause as { code?: unknown }).code : undefined
      if (code === 'PGRST205' || code === '42P01') return []
      throw cause
    }
  }

  /** Templates arrive in their own migration; until it is applied the diary still loads without them. */
  private async loadTemplates(signal: AbortSignal): Promise<MealTemplate[]> {
    const client = this.client
    try {
      const rows = await readPages((start, end) => client.from('meal_templates').select('*').eq('user_id', this.userId).order('created_at').order('id').range(start, end).abortSignal(signal))
      return rows.flatMap((row) => {
        const parsed = mealTemplateSchema.safeParse({ id: row.id, name: row.name, items: row.items })
        return parsed.success ? [parsed.data] : []
      })
    } catch (cause) {
      const code = cause instanceof Error && typeof cause.cause === 'object' && cause.cause !== null ? (cause.cause as { code?: unknown }).code : undefined
      if (code === 'PGRST205' || code === '42P01') return []
      throw cause
    }
  }

  private async insertChunks<Row>(rows: Row[], insert: (chunk: Row[]) => PromiseLike<{ data: { id: string }[] | null; error: PostgrestError | null }>, saved: () => void): Promise<void> {
    for (let start = 0; start < rows.length; start += IMPORT_CHUNK) {
      const chunk = rows.slice(start, start + IMPORT_CHUNK)
      const stored = result(await insert(chunk))
      if (stored.length !== chunk.length) throw new Error('Serwer nie potwierdził wszystkich wpisów.')
      for (let index = 0; index < chunk.length; index++) saved()
    }
  }

  private async importJournal(value: ImportPayload, onProgress?: (saved: number, total: number) => void): Promise<void> {
    const client = this.client
    const user_id = this.userId
    const total = importSize(value)
    let saved = 0
    const step = () => { saved++; onProgress?.(saved, total) }
    try {
      if (value.goalCycles.length) {
        const restored = result(await client.rpc('restore_goal_cycle_history', {
          p_cycles: value.goalCycles.map((cycle) => ({
            id: cycle.id, kind: cycle.kind, startDate: cycle.startDate, endDate: cycle.endDate,
            startWeightKg: cycle.startWeightKg, targetWeightKg: cycle.targetWeightKg,
            calorieGoal: cycle.calorieGoal, proteinGoal: cycle.proteinGoal, carbsGoal: cycle.carbsGoal,
            fatGoal: cycle.fatGoal, waterGoal: cycle.waterGoal, status: cycle.status,
            createdAt: cycle.createdAt, completedAt: cycle.completedAt,
          })),
        }))
        if (restored !== value.goalCycles.length) throw new Error('Serwer nie potwierdził całej historii cykli.')
        for (let index = 0; index < restored; index++) step()
      }
      await this.insertChunks(value.customFoods.map((food) => ({ user_id, id: food.id, food: foodSchema.parse(food) })),
        (chunk) => client.from('custom_foods').insert(chunk).select('id'), step)
      await this.insertChunks(value.mealTemplates.map((template) => ({ user_id, name: template.name, items: template.items })),
        (chunk) => client.from('meal_templates').insert(chunk).select('id'), step)
      await this.insertChunks(value.workoutTemplates.map((template) => ({ user_id, name: template.name, kind: template.kind, minutes: template.minutes, sets: template.sets })),
        (chunk) => client.from('workout_templates').insert(chunk).select('id'), step)
      await this.insertChunks((value.meals.length ? validMeals(value.meals) : []).map((meal) => ({ user_id, date: meal.date, meal: meal.meal, food: meal.food, portion: meal.portion })),
        (chunk) => client.from('meal_entries').insert(chunk).select('id'), step)
      await this.insertChunks(value.workouts.map((workout) => ({
        user_id, date: workout.date, name: workout.name, kind: workout.kind, minutes: workout.minutes,
        distance_km: workout.distanceKm, calories: workout.calories, effort: workout.effort,
        elevation_m: workout.elevationM, import_hash: workout.importHash, sets: workout.sets ?? [],
      })), (chunk) => client.from('workouts').insert(chunk).select('id'), step)
      await this.insertChunks(value.water.map((item) => ({ user_id, date: item.date, amount_ml: item.amountMl })),
        (chunk) => client.from('water_entries').insert(chunk).select('id'), step)
      await this.insertChunks(value.measurements.map((item) => ({
        user_id, date: item.date, weight_kg: item.weightKg,
        waist_cm: item.waistCm ?? null, hips_cm: item.hipsCm ?? null, body_fat_pct: item.bodyFatPct ?? null,
      })), (chunk) => client.from('measurements').insert(chunk).select('id'), step)
      if (value.profile) { await this.execute({ type: 'profile.save', value: value.profile }); step() }
      if (value.plan) { await this.execute({ type: 'plan.save', value: value.plan }); step() }
    } catch (cause) {
      throw new Error(`Zapisano ${saved} z ${total} pozycji, pozostałe nie zostały dodane. ${cause instanceof Error ? cause.message : ''} Możesz spróbować ponownie — zapisane już wpisy zostaną rozpoznane i pominięte.`.replace(/\s+/g, ' ').trim(), { cause })
    }
  }

  private async completeOnboarding(): Promise<void> {
    result(await this.client.from('profiles').update({ onboarding_completed_at: new Date().toISOString() })
      .eq('user_id', this.userId).is('onboarding_completed_at', null).select('user_id'))
  }

  async execute(command: Command): Promise<void> {
    const client = this.client
    const user_id = this.userId
    switch (command.type) {
      case 'profile.save': {
        const profile = profileSchema.parse(command.value)
        result(await client.rpc('save_flexa_profile', {
          p_display_name: profile.displayName, p_calorie_goal: profile.calorieGoal,
          p_protein_goal: profile.proteinGoal, p_carbs_goal: profile.carbsGoal,
          p_fat_goal: profile.fatGoal, p_water_goal: profile.waterGoal,
          p_weekly_minutes_goal: profile.weeklyMinutesGoal, p_target_weight: profile.targetWeight,
        }))
        break
      }
      case 'goals.start': {
        const cycle = goalCycleInputSchema.parse(command.value)
        result(await client.rpc('start_goal_cycle', {
          p_id: command.id, p_kind: cycle.kind, p_start_date: cycle.startDate, p_end_date: cycle.endDate,
          p_start_weight_kg: cycle.startWeightKg, p_target_weight_kg: cycle.targetWeightKg,
          p_calorie_goal: cycle.calorieGoal, p_protein_goal: cycle.proteinGoal,
          p_carbs_goal: cycle.carbsGoal, p_fat_goal: cycle.fatGoal, p_water_goal: cycle.waterGoal,
        }))
        break
      }
      case 'goals.skip': {
        result(await client.from('profiles').update({ goals_setup_done_at: new Date().toISOString() })
          .eq('user_id', user_id).is('goals_setup_done_at', null).select('user_id'))
        break
      }
      case 'meal.add':
        result(await client.from('meal_entries').insert({
          user_id, date: command.value.date, meal: command.value.meal,
          food: command.value.food, portion: command.value.portion,
        }).select('id').single()); break
      case 'meal.delete':
        result(await client.from('meal_entries').delete().eq('user_id', user_id).eq('id', command.id).select('id').single()); break
      case 'workout.add': {
        const value = command.value
        result(await client.from('workouts').insert({
          user_id, date: value.date, name: value.name, kind: value.kind, minutes: value.minutes,
          distance_km: value.distanceKm, calories: value.calories, effort: value.effort,
          elevation_m: value.elevationM, import_hash: value.importHash, sets: value.sets ?? [],
        }).select('id').single()); break
      }
      case 'workout.delete':
        result(await client.from('workouts').delete().eq('user_id', user_id).eq('id', command.id).select('id').single()); break
      case 'water.add':
        result(await client.from('water_entries').insert({
          user_id, date: command.value.date, amount_ml: command.value.amountMl,
        }).select('id').single()); break
      case 'water.delete':
        result(await client.from('water_entries').delete().eq('user_id', user_id).eq('id', command.id).select('id').single()); break
      case 'measurement.add':
        result(await client.from('measurements').upsert({
          user_id, date: command.value.date, weight_kg: command.value.weightKg,
          waist_cm: command.value.waistCm ?? null, hips_cm: command.value.hipsCm ?? null,
          body_fat_pct: command.value.bodyFatPct ?? null,
        }, { onConflict: 'user_id,date' }).select('id').single()); break
      case 'measurement.delete':
        result(await client.from('measurements').delete().eq('user_id', user_id).eq('id', command.id).select('id').single()); break
      case 'food.save':
        result(await client.from('custom_foods').upsert({
          user_id, id: command.value.id, food: foodSchema.parse(command.value),
        }).select('id').single()); break
      case 'plan.save': {
        const { answers, ...stored } = trainingPlanSchema.parse(command.value)
        if (needsHealthConsent(answers) && !answers.healthConsent) {
          throw new Error('Zaznacz zgodę na zapis informacji o zdrowiu albo usuń ograniczenia z odpowiedzi.')
        }
        result(await client.from('training_plans').upsert({ user_id, answers, plan: stored }, { onConflict: 'user_id' }).select('user_id').single())
        await this.completeOnboarding()
        break
      }
      case 'plan.delete':
        result(await client.from('training_plans').delete().eq('user_id', user_id).select('user_id')); break
      case 'onboarding.skip':
        await this.completeOnboarding(); break
      case 'meal.addMany': {
        const meals = validMeals(command.value)
        const stored = result(await client.from('meal_entries').insert(meals.map((meal) => ({
          user_id, date: meal.date, meal: meal.meal, food: meal.food, portion: meal.portion,
        }))).select('id'))
        if (stored.length !== meals.length) throw new Error('Serwer nie potwierdził wszystkich wpisów. Odśwież dane przed ponowną próbą.')
        break
      }
      case 'template.save': {
        const template = mealTemplateSchema.omit({ id: true }).parse(command.value)
        try {
          result(await client.from('meal_templates').insert({ user_id, name: template.name, items: template.items }).select('id').single())
        } catch (cause) {
          if (cause instanceof Error && cause.message.startsWith('Ten wpis już istnieje')) throw new Error(templateExists, { cause })
          throw cause
        }
        break
      }
      case 'template.delete':
        result(await client.from('meal_templates').delete().eq('user_id', user_id).eq('id', command.id).select('id').single()); break
      case 'wtemplate.save': {
        const template = workoutTemplateSchema.omit({ id: true }).parse(command.value)
        try {
          result(await client.from('workout_templates').insert({ user_id, name: template.name, kind: template.kind, minutes: template.minutes, sets: template.sets }).select('id').single())
        } catch (cause) {
          if (cause instanceof Error && cause.message.startsWith('Ten wpis już istnieje')) throw new Error(workoutTemplateExists, { cause })
          throw cause
        }
        break
      }
      case 'wtemplate.delete':
        result(await client.from('workout_templates').delete().eq('user_id', user_id).eq('id', command.id).select('id').single()); break
      case 'journal.import':
        await this.importJournal(command.value, command.onProgress); break
    }
  }
}

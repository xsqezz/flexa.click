import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'
import {
  foodSchema, journalSchema, profileSchema,
  type Food, type Journal, type Meal, type Measurement, type Profile, type Water, type Workout,
} from '../../../shared/domain'
import type { Database, ProfileRow } from './database.types'
import { readDemo, writeDemo } from './demo'

export type Command =
  | { type: 'profile.save'; value: Profile }
  | { type: 'meal.add'; value: Omit<Meal, 'id'> }
  | { type: 'meal.delete'; id: string }
  | { type: 'workout.add'; value: Omit<Workout, 'id'> }
  | { type: 'workout.delete'; id: string }
  | { type: 'water.add'; value: Omit<Water, 'id'> }
  | { type: 'water.delete'; id: string }
  | { type: 'measurement.add'; value: Omit<Measurement, 'id'> }
  | { type: 'measurement.delete'; id: string }
  | { type: 'food.save'; value: Food }

export interface JournalRepository {
  load(signal: AbortSignal): Promise<Journal>
  execute(command: Command): Promise<void>
}

export class DemoRepository implements JournalRepository {
  async load(): Promise<Journal> { return readDemo() }

  async execute(command: Command): Promise<void> {
    const journal = readDemo()
    switch (command.type) {
      case 'profile.save': journal.profile = profileSchema.parse(command.value); break
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
    }
    writeDemo(journal)
  }
}

function result<T>(response: { data: T | null; error: PostgrestError | null }): T {
  if (response.error) {
    if (response.error.code === '23505') throw new Error('Ten wpis już istnieje. Plik mógł zostać wcześniej zaimportowany.')
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
    const [profile, meals, workouts, water, measurements, foods] = await Promise.all([
      client.from('profiles').select('*').eq('user_id', user).abortSignal(signal).single(),
      readPages((start, end) => client.from('meal_entries').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      readPages((start, end) => client.from('workouts').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      readPages((start, end) => client.from('water_entries').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      readPages((start, end) => client.from('measurements').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
      readPages((start, end) => client.from('custom_foods').select('*').eq('user_id', user).order('created_at').order('id').range(start, end).abortSignal(signal)),
    ])
    return journalSchema.parse({
      profile: profileFromRow(result(profile)),
      meals: meals.map((row) => ({
        id: row.id, date: row.date, meal: row.meal, food: foodSchema.parse(row.food), portion: row.portion,
      })),
      workouts: workouts.map((row) => ({
        id: row.id, date: row.date, name: row.name, kind: row.kind, minutes: row.minutes,
        distanceKm: row.distance_km, calories: row.calories, effort: row.effort,
        elevationM: row.elevation_m, importHash: row.import_hash,
      })),
      water: water.map((row) => ({ id: row.id, date: row.date, amountMl: row.amount_ml })),
      measurements: measurements.map((row) => ({ id: row.id, date: row.date, weightKg: row.weight_kg })),
      customFoods: foods.map((row) => foodSchema.parse(row.food)),
    })
  }

  async execute(command: Command): Promise<void> {
    const client = this.client
    const user_id = this.userId
    switch (command.type) {
      case 'profile.save': {
        const profile = profileSchema.parse(command.value)
        result(await client.from('profiles').update({
          display_name: profile.displayName, calorie_goal: profile.calorieGoal,
          protein_goal: profile.proteinGoal, carbs_goal: profile.carbsGoal,
          fat_goal: profile.fatGoal, water_goal: profile.waterGoal,
          weekly_minutes_goal: profile.weeklyMinutesGoal, target_weight: profile.targetWeight,
        }).eq('user_id', user_id).select('user_id').single())
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
          elevation_m: value.elevationM, import_hash: value.importHash,
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
        }, { onConflict: 'user_id,date' }).select('id').single()); break
      case 'measurement.delete':
        result(await client.from('measurements').delete().eq('user_id', user_id).eq('id', command.id).select('id').single()); break
      case 'food.save':
        result(await client.from('custom_foods').upsert({
          user_id, id: command.value.id, food: foodSchema.parse(command.value),
        }).select('id').single()); break
    }
  }
}

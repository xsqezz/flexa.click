export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined }
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] }

export type ProfileRow = {
  user_id: string; display_name: string; calorie_goal: number; protein_goal: number
  carbs_goal: number; fat_goal: number; water_goal: number; weekly_minutes_goal: number
  target_weight: number | null; consent_version: string; consented_at: string
}
type BaseRow = { id: string; user_id: string; created_at: string }
export type MealRow = BaseRow & { date: string; meal: string; food: Json; portion: number }
export type WorkoutRow = BaseRow & {
  date: string; name: string; kind: string; minutes: number; distance_km: number | null
  calories: number | null; effort: number | null; elevation_m: number | null; import_hash: string | null
}
export type WaterRow = BaseRow & { date: string; amount_ml: number }
export type MeasurementRow = BaseRow & { date: string; weight_kg: number }
export type CustomFoodRow = BaseRow & { food: Json }
type NewRow<T extends BaseRow> = Omit<T, 'created_at' | 'id'> & { id?: string }

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Omit<ProfileRow, 'consented_at'> & { consented_at?: string }>
      meal_entries: Table<MealRow, NewRow<MealRow>>
      workouts: Table<WorkoutRow, NewRow<WorkoutRow>>
      water_entries: Table<WaterRow, NewRow<WaterRow>>
      measurements: Table<MeasurementRow, NewRow<MeasurementRow>>
      custom_foods: Table<CustomFoodRow, NewRow<CustomFoodRow>>
    }
    Views: Record<string, never>
    Functions: {
      consume_api_budget: {
        Args: { budget_key: string; request_limit: number; window_seconds: number }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

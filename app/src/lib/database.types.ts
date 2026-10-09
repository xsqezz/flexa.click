export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined }
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] }

export type ProfileRow = {
  user_id: string; display_name: string; calorie_goal: number; protein_goal: number
  carbs_goal: number; fat_goal: number; water_goal: number; weekly_minutes_goal: number
  target_weight: number | null; consent_version: string; consented_at: string
  onboarding_completed_at: string | null; goals_setup_done_at: string | null
}
export type GoalCycleRow = {
  id: string; user_id: string; kind: string; start_date: string; end_date: string
  start_weight_kg: number; target_weight_kg: number | null
  calorie_goal: number; protein_goal: number; carbs_goal: number; fat_goal: number
  water_goal: number; status: string; created_at: string; completed_at: string | null
}
export type TrainingPlanRow = {
  user_id: string; answers: Json; plan: Json; health_consent_at: string | null
  created_at: string; updated_at: string
}
type BaseRow = { id: string; user_id: string; created_at: string }
export type MealRow = BaseRow & { date: string; meal: string; food: Json; portion: number }
export type WorkoutRow = BaseRow & {
  date: string; name: string; kind: string; minutes: number; distance_km: number | null
  calories: number | null; effort: number | null; elevation_m: number | null; import_hash: string | null
  sets: Json
}
export type WaterRow = BaseRow & { date: string; amount_ml: number }
export type MeasurementRow = BaseRow & {
  date: string; weight_kg: number; waist_cm: number | null; hips_cm: number | null; body_fat_pct: number | null
}
export type CustomFoodRow = BaseRow & { food: Json }
export type MealTemplateRow = BaseRow & { name: string; items: Json }
export type WorkoutTemplateRow = BaseRow & { name: string; kind: string; minutes: number; sets: Json }
type NewRow<T extends BaseRow> = Omit<T, 'created_at' | 'id'> & { id?: string }

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Omit<ProfileRow, 'consented_at' | 'onboarding_completed_at' | 'goals_setup_done_at'>
        & { consented_at?: string; onboarding_completed_at?: string | null; goals_setup_done_at?: string | null }>
      goal_cycles: Table<GoalCycleRow, Omit<GoalCycleRow, 'created_at' | 'completed_at'> & { created_at?: string; completed_at?: string | null }>
      training_plans: Table<TrainingPlanRow, Pick<TrainingPlanRow, 'user_id' | 'answers' | 'plan'>>
      meal_entries: Table<MealRow, NewRow<MealRow>>
      workouts: Table<WorkoutRow, NewRow<WorkoutRow>>
      water_entries: Table<WaterRow, NewRow<WaterRow>>
      measurements: Table<MeasurementRow, NewRow<MeasurementRow>>
      custom_foods: Table<CustomFoodRow, NewRow<CustomFoodRow>>
      meal_templates: Table<MealTemplateRow, NewRow<MealTemplateRow>>
      workout_templates: Table<WorkoutTemplateRow, NewRow<WorkoutTemplateRow>>
    }
    Views: Record<string, never>
    Functions: {
      consume_api_budget: {
        Args: { budget_key: string; request_limit: number; window_seconds: number }
        Returns: boolean
      }
      start_goal_cycle: {
        Args: {
          p_id: string; p_kind: string; p_start_date: string; p_end_date: string
          p_start_weight_kg: number; p_target_weight_kg: number | null
          p_calorie_goal: number; p_protein_goal: number; p_carbs_goal: number
          p_fat_goal: number; p_water_goal: number
        }
        Returns: string
      }
      save_flexa_profile: {
        Args: {
          p_display_name: string; p_calorie_goal: number; p_protein_goal: number
          p_carbs_goal: number; p_fat_goal: number; p_water_goal: number
          p_weekly_minutes_goal: number; p_target_weight: number | null
        }
        Returns: boolean
      }
      restore_goal_cycle_history: {
        Args: { p_cycles: Json }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

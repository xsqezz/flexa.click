-- Sets and load in logged workouts, extra body measurements.
-- Both tables already have table-level grants (select/insert/update/delete for authenticated),
-- row-level security and realtime publication, which cover the new columns.

alter table public.workouts add column sets jsonb not null default '[]'::jsonb
  constraint workouts_sets_shape check (case
    when jsonb_typeof(sets) = 'array' then jsonb_array_length(sets) <= 200 and pg_column_size(sets) < 65536
    else false
  end);

alter table public.measurements
  add column waist_cm numeric constraint measurements_waist_range check (waist_cm between 40 and 250),
  add column hips_cm numeric constraint measurements_hips_range check (hips_cm between 40 and 250),
  add column body_fat_pct numeric constraint measurements_body_fat_range check (body_fat_pct between 2 and 70);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  calorie_goal numeric not null default 2200 check (calorie_goal between 500 and 10000),
  protein_goal numeric not null default 120 check (protein_goal between 0 and 500),
  carbs_goal numeric not null default 260 check (carbs_goal between 0 and 1000),
  fat_goal numeric not null default 70 check (fat_goal between 0 and 500),
  water_goal integer not null default 2500 check (water_goal between 500 and 6000),
  weekly_minutes_goal integer not null default 150 check (weekly_minutes_goal between 0 and 10000),
  target_weight numeric check (target_weight between 20 and 500),
  consent_version text not null,
  consented_at timestamptz not null default now()
);

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null check (date between '1900-01-01' and '2100-12-31'),
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food jsonb not null check (coalesce(
    jsonb_typeof(food) = 'object'
    and length(btrim(food->>'name')) between 1 and 200
    and food->>'source' in ('open-food-facts', 'usda', 'custom', 'demo')
    and jsonb_typeof(food->'nutrients'->'kcal') = 'number'
    and (food->'nutrients'->>'kcal')::numeric between 0 and 2000
  , false)),
  portion numeric not null check (portion > 0 and portion <= 10000),
  created_at timestamptz not null default now()
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null check (date between '1900-01-01' and '2100-12-31'),
  name text not null check (length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('run', 'ride', 'walk', 'strength', 'other')),
  minutes numeric not null check (minutes > 0 and minutes <= 1440),
  distance_km numeric check (distance_km between 0 and 2000),
  calories numeric check (calories between 0 and 30000),
  effort integer check (effort between 1 and 10),
  elevation_m numeric check (elevation_m between 0 and 100000),
  import_hash text check (import_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create unique index workouts_import_unique on public.workouts(user_id, import_hash)
  where import_hash is not null;

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null check (date between '1900-01-01' and '2100-12-31'),
  amount_ml integer not null check (amount_ml between 1 and 3000),
  created_at timestamptz not null default now()
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null check (date between '1900-01-01' and '2100-12-31'),
  weight_kg numeric not null check (weight_kg between 20 and 500),
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

create table public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food jsonb not null check (coalesce(
    jsonb_typeof(food) = 'object'
    and food->>'source' = 'custom'
    and length(btrim(food->>'name')) between 1 and 200
  , false)),
  created_at timestamptz not null default now()
);

create index meal_entries_user_date on public.meal_entries(user_id, date);
create index workouts_user_date on public.workouts(user_id, date);
create index water_entries_user_date on public.water_entries(user_id, date);
create index measurements_user_date on public.measurements(user_id, date);
create index custom_foods_user on public.custom_foods(user_id);

create function public.create_flexa_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data->>'privacy_consent', 'false') <> 'true'
     or coalesce(new.raw_user_meta_data->>'adult_confirmed', 'false') <> 'true'
     or new.raw_user_meta_data->>'consent_version' is distinct from '2026-10-06' then
    raise exception 'Explicit privacy consent and adult confirmation are required';
  end if;
  insert into public.profiles(user_id, display_name, consent_version)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), 'Użytkownik'), 60),
    new.raw_user_meta_data->>'consent_version'
  );
  return new;
end;
$$;
revoke all on function public.create_flexa_profile() from public;
create trigger flexa_user_created after insert on auth.users
  for each row execute function public.create_flexa_profile();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'meal_entries', 'workouts', 'water_entries', 'measurements', 'custom_foods'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy own_records on public.%I for all to authenticated
       using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    if table_name = 'profiles' then
      execute format('grant select on public.%I to authenticated', table_name);
    else
      execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    end if;
    execute format('grant all on public.%I to service_role', table_name);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
grant update(display_name, calorie_goal, protein_goal, carbs_goal, fat_goal,
  water_goal, weekly_minutes_goal, target_weight) on public.profiles to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.api_windows (
  key text primary key,
  started_at timestamptz not null,
  used integer not null
);
revoke all on private.api_windows from public, anon, authenticated;

create function public.consume_api_budget(
  budget_key text, request_limit integer, window_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare accepted integer;
begin
  if request_limit < 1 or window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration';
  end if;
  insert into private.api_windows as w(key, started_at, used)
  values (budget_key, now(), 1)
  on conflict (key) do update set
    used = case when w.started_at <= now() - make_interval(secs => window_seconds)
      then 1 else w.used + 1 end,
    started_at = case when w.started_at <= now() - make_interval(secs => window_seconds)
      then now() else w.started_at end
  where w.started_at <= now() - make_interval(secs => window_seconds) or w.used < request_limit
  returning used into accepted;
  return accepted is not null;
end;
$$;
revoke all on function public.consume_api_budget(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_budget(text, integer, integer) to service_role;

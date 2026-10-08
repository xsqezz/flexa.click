alter table public.profiles add column goals_setup_done_at timestamptz;
update public.profiles set goals_setup_done_at = now();
grant update(goals_setup_done_at) on public.profiles to authenticated;
revoke update(calorie_goal, protein_goal, carbs_goal, fat_goal, water_goal, target_weight)
  on public.profiles from authenticated;

create table public.goal_cycles (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reduction', 'maintenance', 'muscle_gain', 'manual')),
  start_date date not null check (start_date between '1900-01-01' and '2100-12-31'),
  end_date date not null check (end_date between '1900-01-01' and '2100-12-31' and end_date >= start_date),
  start_weight_kg numeric not null check (start_weight_kg between 20 and 500),
  target_weight_kg numeric check (target_weight_kg between 20 and 500),
  calorie_goal numeric not null check (calorie_goal between 500 and 10000),
  protein_goal numeric not null check (protein_goal between 0 and 500),
  carbs_goal numeric not null check (carbs_goal between 0 and 1000),
  fat_goal numeric not null check (fat_goal between 0 and 500),
  water_goal integer not null check (water_goal between 500 and 6000),
  status text not null check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint goal_cycles_completion check ((status = 'active') = (completed_at is null))
);
create unique index goal_cycles_one_active on public.goal_cycles(user_id) where status = 'active';
create index goal_cycles_user_start on public.goal_cycles(user_id, start_date desc, created_at desc);
alter table public.goal_cycles enable row level security;
create policy own_cycles on public.goal_cycles for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.goal_cycles from public, anon, authenticated;
grant select on public.goal_cycles to authenticated;
grant all on public.goal_cycles to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.goal_cycles;
  end if;
end;
$$;

create function public.start_goal_cycle(
  p_id uuid, p_kind text, p_start_date date, p_end_date date,
  p_start_weight_kg numeric, p_target_weight_kg numeric,
  p_calorie_goal numeric, p_protein_goal numeric, p_carbs_goal numeric,
  p_fat_goal numeric, p_water_goal integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  previous_start date;
  recorded_weight numeric;
begin
  if owner_id is null then raise exception 'Wymagane logowanie'; end if;
  if p_id is null or p_start_date is null or p_end_date is null
     or p_start_date > current_date + 1 or p_end_date < current_date - 1 then
    raise exception 'Nowy cykl musi obejmować bieżący dzień';
  end if;
  perform 1 from public.profiles where user_id = owner_id for update;
  if not found then raise exception 'Nie znaleziono profilu'; end if;
  if exists (select 1 from public.goal_cycles where id = p_id and user_id = owner_id) then
    return p_id;
  end if;

  insert into public.measurements(user_id, date, weight_kg)
    values (owner_id, p_start_date, p_start_weight_kg) on conflict(user_id, date) do nothing;
  select weight_kg into recorded_weight from public.measurements
    where user_id = owner_id and date = p_start_date;
  if recorded_weight is distinct from p_start_weight_kg then
    raise exception 'Dla daty początku jest już inny pomiar. Użyj zapisanej wagi lub popraw pomiar w Postępach.';
  end if;

  select start_date into previous_start from public.goal_cycles
    where user_id = owner_id and status = 'active' for update;
  if previous_start is not null and previous_start > p_start_date then
    raise exception 'Nowy cykl nie może zaczynać się przed poprzednim';
  end if;
  update public.goal_cycles
    set status = 'completed', completed_at = now(), end_date = least(end_date, greatest(start_date, p_start_date))
    where user_id = owner_id and status = 'active';
  insert into public.goal_cycles (
    id, user_id, kind, start_date, end_date, start_weight_kg, target_weight_kg,
    calorie_goal, protein_goal, carbs_goal, fat_goal, water_goal, status
  ) values (
    p_id, owner_id, p_kind, p_start_date, p_end_date, p_start_weight_kg, p_target_weight_kg,
    p_calorie_goal, p_protein_goal, p_carbs_goal, p_fat_goal, p_water_goal, 'active'
  );
  update public.profiles set
    calorie_goal = p_calorie_goal, protein_goal = p_protein_goal, carbs_goal = p_carbs_goal,
    fat_goal = p_fat_goal, water_goal = p_water_goal, target_weight = p_target_weight_kg,
    goals_setup_done_at = coalesce(goals_setup_done_at, now())
    where user_id = owner_id;
  return p_id;
end;
$$;
revoke all on function public.start_goal_cycle(uuid, text, date, date, numeric, numeric, numeric, numeric, numeric, numeric, integer)
  from public, anon;
grant execute on function public.start_goal_cycle(uuid, text, date, date, numeric, numeric, numeric, numeric, numeric, numeric, integer)
  to authenticated;

create function public.save_flexa_profile(
  p_display_name text, p_calorie_goal numeric, p_protein_goal numeric, p_carbs_goal numeric,
  p_fat_goal numeric, p_water_goal integer, p_weekly_minutes_goal integer, p_target_weight numeric
) returns boolean language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Wymagane logowanie'; end if;
  update public.profiles set display_name = p_display_name, calorie_goal = p_calorie_goal,
    protein_goal = p_protein_goal, carbs_goal = p_carbs_goal, fat_goal = p_fat_goal,
    water_goal = p_water_goal, weekly_minutes_goal = p_weekly_minutes_goal,
    target_weight = p_target_weight where user_id = owner_id;
  if not found then raise exception 'Nie znaleziono profilu'; end if;
  update public.goal_cycles set calorie_goal = p_calorie_goal, protein_goal = p_protein_goal,
    carbs_goal = p_carbs_goal, fat_goal = p_fat_goal, water_goal = p_water_goal,
    target_weight_kg = p_target_weight where user_id = owner_id and status = 'active'
      and end_date >= current_date;
  return true;
end;
$$;
revoke all on function public.save_flexa_profile(text, numeric, numeric, numeric, numeric, integer, integer, numeric)
  from public, anon;
grant execute on function public.save_flexa_profile(text, numeric, numeric, numeric, numeric, integer, integer, numeric)
  to authenticated;

create function public.restore_goal_cycle_history(p_cycles jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  restored integer := 0;
begin
  if owner_id is null then raise exception 'Wymagane logowanie'; end if;
  if jsonb_typeof(p_cycles) is distinct from 'array' or jsonb_array_length(p_cycles) > 1000 then
    raise exception 'Nieprawidłowa historia cykli';
  end if;
  perform 1 from public.profiles where user_id = owner_id for update;
  if not found then raise exception 'Nie znaleziono profilu'; end if;
  if exists (select 1 from public.goal_cycles where user_id = owner_id) then
    raise exception 'Historia cykli już istnieje. Import nie nadpisuje ani nie uruchamia cykli';
  end if;

  for item in select jsonb_array_elements(p_cycles) loop
    if item->>'status' is distinct from 'completed'
       or item->>'completedAt' is null
       or (item->>'endDate')::date > current_date + 1 then
      raise exception 'Import dopuszcza wyłącznie zakończone cykle';
    end if;
    insert into public.goal_cycles (
      id, user_id, kind, start_date, end_date, start_weight_kg, target_weight_kg,
      calorie_goal, protein_goal, carbs_goal, fat_goal, water_goal,
      status, created_at, completed_at
    ) values (
      (item->>'id')::uuid, owner_id, item->>'kind', (item->>'startDate')::date,
      (item->>'endDate')::date, (item->>'startWeightKg')::numeric, (item->>'targetWeightKg')::numeric,
      (item->>'calorieGoal')::numeric, (item->>'proteinGoal')::numeric, (item->>'carbsGoal')::numeric,
      (item->>'fatGoal')::numeric, (item->>'waterGoal')::integer,
      'completed', (item->>'createdAt')::timestamptz, (item->>'completedAt')::timestamptz
    );
    restored := restored + 1;
  end loop;
  return restored;
end;
$$;
revoke all on function public.restore_goal_cycle_history(jsonb) from public, anon;
grant execute on function public.restore_goal_cycle_history(jsonb) to authenticated;

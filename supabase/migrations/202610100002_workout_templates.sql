-- Custom workouts ("Moje treningi"): a named workout (kind, usual duration and optional sets) that the user logs again with one tap.
create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  kind text not null check (kind in ('run', 'ride', 'walk', 'strength', 'other')),
  minutes numeric not null check (minutes > 0 and minutes <= 1440),
  sets jsonb not null default '[]'::jsonb check (case
    when jsonb_typeof(sets) = 'array' then jsonb_array_length(sets) <= 200 and pg_column_size(sets) < 65536
    else false
  end),
  created_at timestamptz not null default now()
);
create unique index workout_templates_user_name on public.workout_templates(user_id, lower(btrim(name)));

alter table public.workout_templates enable row level security;
create policy own_records on public.workout_templates for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on table public.workout_templates from anon, authenticated;
grant select, insert, delete on public.workout_templates to authenticated;
grant all on public.workout_templates to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.workout_templates;
  end if;
end;
$$;
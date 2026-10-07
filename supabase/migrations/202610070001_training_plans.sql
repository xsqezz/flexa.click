alter table public.profiles add column onboarding_completed_at timestamptz;
grant update(onboarding_completed_at) on public.profiles to authenticated;

create table public.training_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null check (coalesce(
    jsonb_typeof(answers) = 'object'
    and octet_length(answers::text) <= 4000
    and jsonb_typeof(answers->'limitations') = 'array'
    and jsonb_typeof(answers->'cautiousStart') = 'boolean'
    and jsonb_typeof(answers->'healthConsent') = 'boolean'
  , false)),
  plan jsonb not null check (coalesce(
    jsonb_typeof(plan) = 'object'
    and jsonb_typeof(plan->'sessions') = 'array'
    and octet_length(plan::text) <= 200000
  , false)),
  health_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_plans_health_consent check (
    health_consent_at is not null
    or (jsonb_array_length(answers->'limitations') = 0 and answers->'cautiousStart' = 'false'::jsonb)
  )
);

create function public.prepare_training_plan()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.health_consent_at := case when new.answers->'healthConsent' = 'true'::jsonb then now() end;
  else
    new.created_at := old.created_at;
    new.health_consent_at := case when new.answers->'healthConsent' = 'true'::jsonb
      then coalesce(old.health_consent_at, now()) end;
  end if;
  return new;
end;
$$;
revoke all on function public.prepare_training_plan() from public;
create trigger training_plans_prepare before insert or update on public.training_plans
  for each row execute function public.prepare_training_plan();

alter table public.training_plans enable row level security;
create policy own_records on public.training_plans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on table public.training_plans from anon, authenticated;
grant select, insert, update, delete on public.training_plans to authenticated;
grant all on public.training_plans to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.training_plans;
  end if;
end;
$$;

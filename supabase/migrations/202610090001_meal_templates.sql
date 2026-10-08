-- Meal templates ("Zestawy"): a named list of products with portions that the user adds to a meal with one tap.
create table public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  items jsonb not null check (coalesce(case when jsonb_typeof(items) = 'array' then
    jsonb_array_length(items) between 1 and 30
    and octet_length(items::text) <= 60000
    and not jsonb_path_exists(items, '$[*] ? (
      !(exists(@.portion ? (@.type() == "number" && @ > 0 && @ <= 10000)))
      || !(exists(@.food.name ? (@.type() == "string")))
      || !(exists(@.food.source ? (@ == "open-food-facts" || @ == "usda" || @ == "custom" || @ == "demo")))
      || !(exists(@.food.unit ? (@ == "g" || @ == "ml")))
      || !(exists(@.food.nutrients.kcal ? (@.type() == "number" && @ >= 0 && @ <= 2000)))
    )')
  else false end, false)),
  created_at timestamptz not null default now()
);
create unique index meal_templates_user_name on public.meal_templates(user_id, lower(btrim(name)));

alter table public.meal_templates enable row level security;
create policy own_records on public.meal_templates for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on table public.meal_templates from anon, authenticated;
grant select, insert, delete on public.meal_templates to authenticated;
grant all on public.meal_templates to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.meal_templates;
  end if;
end;
$$;

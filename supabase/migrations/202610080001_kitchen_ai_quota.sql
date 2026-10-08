create table private.kitchen_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('vision', 'image')),
  day date not null default ((now() at time zone 'utc')::date),
  uses integer not null default 0 check (uses >= 0),
  primary key (user_id, kind, day)
);
revoke all on private.kitchen_ai_usage from public, anon, authenticated;

create function public.consume_kitchen_ai(p_kind text, p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  used integer;
begin
  if uid is null then
    raise exception 'Wymagane logowanie' using errcode = '28000';
  end if;
  if p_kind not in ('vision', 'image') or p_limit < 1 or p_limit > 200 then
    raise exception 'Nieprawidłowe parametry limitu' using errcode = '22023';
  end if;
  delete from private.kitchen_ai_usage where user_id = uid and day < ((now() at time zone 'utc')::date - 7);
  insert into private.kitchen_ai_usage as usage(user_id, kind, day, uses)
  values (uid, p_kind, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, kind, day) do update set uses = usage.uses + 1
  returning usage.uses into used;
  return used <= p_limit;
end;
$$;
revoke all on function public.consume_kitchen_ai(text, integer) from public, anon;
grant execute on function public.consume_kitchen_ai(text, integer) to authenticated;

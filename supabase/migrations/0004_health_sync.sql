-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run more than once.
-- Apple Health sync from an iPhone Shortcut.
--
-- How it's locked down:
--   * The Shortcut calls health_sync() with a long random sync key. Only a
--     SHA-256 hash of the key is stored, so the key can't be read back out.
--   * health_sync() is the only thing the public (anon) role may run. It
--     can only add or update your steps, weigh-ins and workouts for the user
--     that owns the key. It can't read anything, and nothing else opens up.
--   * create_sync_key() makes a new key (replacing the old one) and is only
--     open to you when signed in.

-- Workouts that came from Health carry an id so a re-sync updates, not duplicates.
alter table public.activities
  add column if not exists source      text,
  add column if not exists external_id text;
create unique index if not exists activities_user_external on public.activities (user_id, external_id);

-- Personal settings, one row per user (body weight goal for now).
create table if not exists public.profile (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  weight_goal numeric(5, 1) check (weight_goal between 50 and 700),
  updated_at  timestamptz not null default now()
);
alter table public.profile enable row level security;
drop policy if exists "own row" on public.profile;
create policy "own row" on public.profile for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.profile to authenticated;

create table if not exists public.sync_keys (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  key_hash    text not null unique,
  created_at  timestamptz not null default now(),
  last_used   timestamptz,
  last_result jsonb
);
alter table public.sync_keys enable row level security;
drop policy if exists "own row" on public.sync_keys;
create policy "own row" on public.sync_keys for select to authenticated using (user_id = auth.uid());
grant select on public.sync_keys to authenticated;

-- New sync key for the signed-in user. Returned once; only its hash is kept.
create or replace function public.create_sync_key()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  k text;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  -- gen_random_uuid() uses the server's strong random source: 244 random bits.
  k := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into sync_keys (user_id, key_hash)
  values (auth.uid(), encode(sha256(convert_to(k, 'UTF8')), 'hex'))
  on conflict (user_id) do update
    set key_hash = excluded.key_hash, created_at = now(), last_used = null, last_result = null;
  return k;
end
$$;
revoke all on function public.create_sync_key() from public, anon;
grant execute on function public.create_sync_key() to authenticated;

-- Called by the Shortcut. Each text argument is one entry per line:
--   p_steps     2026-11-10|8234            (date|steps)
--   p_weights   2026-11-10|182.4           (date|lb)
--   p_workouts  2026-11-10 17:39|Walking|42 (start|type|minutes)
-- Steps and weight replace that day's value. A Cycling workout on a day with
-- a logged Ride, or a strength workout on a day with a logged Lift, is
-- skipped (it's the plan session, already counted).
create or replace function public.health_sync(
  p_key      text,
  p_steps    text default '',
  p_weights  text default '',
  p_workouts text default ''
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid  uuid;
  line text;
  f    text[];
  d    date;
  n    numeric;
  raw  text;
  nm   text;
  s int := 0; b int := 0; w int := 0; skipped int := 0;
  res  jsonb;
begin
  select user_id into uid from sync_keys
   where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
  if uid is null then
    raise exception 'unknown sync key' using errcode = '28000';
  end if;
  if length(coalesce(p_steps, '')) + length(coalesce(p_weights, '')) + length(coalesce(p_workouts, '')) > 200000 then
    raise exception 'too much data in one sync';
  end if;

  -- steps
  foreach line in array string_to_array(coalesce(p_steps, ''), E'\n') loop
    f := string_to_array(btrim(line, E' \r\t'), '|');
    continue when coalesce(array_length(f, 1), 0) <> 2;
    begin d := btrim(f[1])::date; exception when others then continue; end;
    n := nullif(regexp_replace(f[2], '[^0-9.]', '', 'g'), '')::numeric;
    continue when n is null or n > 200000 or d > current_date + 1 or d < date '2015-01-01';
    insert into daily (user_id, day, steps, updated_at) values (uid, d, round(n), now())
    on conflict (user_id, day) do update set steps = excluded.steps, updated_at = now();
    s := s + 1;
  end loop;

  -- body weight
  foreach line in array string_to_array(coalesce(p_weights, ''), E'\n') loop
    f := string_to_array(btrim(line, E' \r\t'), '|');
    continue when coalesce(array_length(f, 1), 0) <> 2;
    begin d := btrim(f[1])::date; exception when others then continue; end;
    n := nullif(regexp_replace(f[2], '[^0-9.]', '', 'g'), '')::numeric;
    continue when n is null or n < 50 or n > 700 or d > current_date + 1;
    insert into daily (user_id, day, body_weight, updated_at) values (uid, d, round(n, 1), now())
    on conflict (user_id, day) do update set body_weight = excluded.body_weight, updated_at = now();
    b := b + 1;
  end loop;

  -- workouts
  foreach line in array string_to_array(coalesce(p_workouts, ''), E'\n') loop
    f := string_to_array(btrim(line, E' \r\t'), '|');
    continue when coalesce(array_length(f, 1), 0) <> 3;
    begin d := left(btrim(f[1]), 10)::date; exception when others then continue; end;
    n := nullif(regexp_replace(f[3], '[^0-9.]', '', 'g'), '')::numeric;
    continue when n is null or n < 1 or d > current_date + 1;
    raw := lower(btrim(f[2]));
    if (raw like '%cycling%' and exists (select 1 from sessions where user_id = uid and day = d and kind = 'ride'))
       or (raw like '%strength%' and exists (select 1 from sessions where user_id = uid and day = d and kind = 'lift')) then
      skipped := skipped + 1;
      continue;
    end if;
    nm := case
      when raw like '%walk%'      then 'Walk'
      when raw like '%run%'       then 'Run'
      when raw like '%hik%'       then 'Hike'
      when raw like '%yoga%'      then 'Yoga'
      when raw like '%swim%'      then 'Swim'
      when raw like '%cycling%'   then 'Cycling'
      when raw like '%strength%'  then 'Strength'
      when raw like '%cooldown%' or raw like '%recovery%' or raw like '%flexibility%' then 'Stretching'
      when raw = '' or raw like '%workout%' then 'Workout'
      else left(initcap(btrim(f[2])), 40)
    end;
    insert into activities (user_id, day, name, minutes, source, external_id)
    values (uid, d, nm, least(600, round(n)), 'health', 'hk:' || btrim(f[1]))
    on conflict (user_id, external_id) do update set name = excluded.name, minutes = excluded.minutes;
    w := w + 1;
  end loop;

  res := jsonb_build_object('ok', true, 'steps_days', s, 'weigh_ins', b, 'workouts', w, 'skipped', skipped);
  update sync_keys set last_used = now(), last_result = res where user_id = uid;
  return res;
end
$$;
revoke all on function public.health_sync(text, text, text, text) from public;
grant execute on function public.health_sync(text, text, text, text) to anon, authenticated;

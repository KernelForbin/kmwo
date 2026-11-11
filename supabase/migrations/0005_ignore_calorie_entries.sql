-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run more than once.
-- The Health sync was saving calorie/energy samples ("Cal") as workouts.
-- This removes those rows and makes health_sync() ignore any workout line
-- whose type is a unit or energy reading rather than a workout name.

-- 1. Remove the synced "Cal"-style entries (only rows that came from Health).
delete from public.activities
 where source = 'health'
   and (lower(btrim(name)) ~ '^(k?cal(orie)?s?|kj|kilojoules?|count|energy|active energy|basal energy)$'
        or btrim(name) ~ '^[0-9.,\s]*$');

-- 2. Same function as 0004, plus the ignore rule ("ignored" in the result).
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
  s int := 0; b int := 0; w int := 0; skipped int := 0; ignored int := 0;
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
    -- Not a workout: a unit or energy reading (e.g. "Cal"), or just a number.
    if raw ~ '^(k?cal(orie)?s?|kj|kilojoules?|count|energy|active energy|basal energy|lb|kg|min|mi|km)$'
       or raw ~ '^[0-9.,\s]*$' or raw like '%energy%' then
      ignored := ignored + 1;
      continue;
    end if;
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
      when raw like '%workout%'   then 'Workout'
      else left(initcap(btrim(f[2])), 40)
    end;
    insert into activities (user_id, day, name, minutes, source, external_id)
    values (uid, d, nm, least(600, round(n)), 'health', 'hk:' || btrim(f[1]))
    on conflict (user_id, external_id) do update set name = excluded.name, minutes = excluded.minutes;
    w := w + 1;
  end loop;

  res := jsonb_build_object('ok', true, 'steps_days', s, 'weigh_ins', b, 'workouts', w,
                            'skipped', skipped, 'ignored', ignored);
  update sync_keys set last_used = now(), last_result = res where user_id = uid;
  return res;
end
$$;
revoke all on function public.health_sync(text, text, text, text) from public;
grant execute on function public.health_sync(text, text, text, text) to anon, authenticated;

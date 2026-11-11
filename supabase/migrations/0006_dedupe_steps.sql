-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run more than once.
-- Steps were doubled: the Shortcut's "Group By Day" adds iPhone and Apple
-- Watch counts together. The Shortcut now sends raw step samples
--   start|end|steps|source      e.g. 2026-11-10 07:15:00|2026-11-10 07:22:41|612|Kenneth's Apple Watch
-- and this de-duplicates them the way Apple Health does: split time into
-- 15-minute blocks, and in any block where the Watch counted steps use the
-- Watch, otherwise the iPhone. (Checked against the Health export: matches
-- Health's daily totals on 312 of 315 days, the rest within 2 steps.)
-- The oldest day in a batch is skipped: a "last N days" window starts
-- mid-day, so that day is incomplete. Old date|steps lines still work.

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
  s int := 0; b int := 0; w int := 0; skipped int := 0; ignored int := 0; samples int := 0;
  ts_re constant text := '^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}(:\d{2})?$';
  res  jsonb;
begin
  select user_id into uid from sync_keys
   where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
  if uid is null then
    raise exception 'unknown sync key' using errcode = '28000';
  end if;
  if length(coalesce(p_steps, '')) + length(coalesce(p_weights, '')) + length(coalesce(p_workouts, '')) > 400000 then
    raise exception 'too much data in one sync';
  end if;

  -- steps, raw samples (start|end|steps|source): de-duplicate, then daily totals
  -- (The split line is "parts_arr", not "f": f is also a variable here.)
  with lines as (
    select string_to_array(btrim(l, E' \r\t'), '|') as parts_arr
      from unnest(string_to_array(coalesce(p_steps, ''), E'\n')) l
  ), samp as (
    select btrim(lines.parts_arr[1])::timestamp as st,
           greatest(btrim(lines.parts_arr[2])::timestamp, btrim(lines.parts_arr[1])::timestamp + interval '1 second') as en,
           nullif(regexp_replace(lines.parts_arr[3], '[^0-9.]', '', 'g'), '')::numeric as v,
           lines.parts_arr[4] ilike '%watch%' as watch
      from lines
     where coalesce(array_length(lines.parts_arr, 1), 0) = 4
       and btrim(lines.parts_arr[1]) ~ ts_re and btrim(lines.parts_arr[2]) ~ ts_re
  ), parts as (
    select bk, sp.watch,
           sp.v * extract(epoch from (least(sp.en, bk + interval '15 minutes') - greatest(sp.st, bk)))
                / extract(epoch from (sp.en - sp.st)) as share
      from samp sp
      cross join lateral generate_series(
        date_bin('15 minutes', sp.st, timestamp '2000-01-01'),
        sp.en - interval '1 microsecond', interval '15 minutes') bk
     where sp.v is not null and sp.v <= 100000 and sp.en - sp.st < interval '2 days'
  ), buckets as (
    select bk, sum(share) filter (where watch) as wa, sum(share) filter (where not watch) as ph
      from parts group by bk
  ), days as (
    select bk::date as day,
           round(sum(case when coalesce(wa, 0) > 0 then wa else coalesce(ph, 0) end)) as steps
      from buckets group by 1
  ), keep as (
    select * from days
     where day > (select min(day) from days)
       and day <= current_date + 1 and day >= date '2015-01-01' and steps <= 200000
  ), up as (
    insert into daily (user_id, day, steps, updated_at)
    select uid, day, steps, now() from keep
    on conflict (user_id, day) do update set steps = excluded.steps, updated_at = now()
    returning 1
  )
  select (select count(*) from up), (select count(*) from samp) into s, samples;

  -- steps, daily totals (date|steps), the older Shortcut format
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

  -- workouts (unchanged from 0005)
  foreach line in array string_to_array(coalesce(p_workouts, ''), E'\n') loop
    f := string_to_array(btrim(line, E' \r\t'), '|');
    continue when coalesce(array_length(f, 1), 0) <> 3;
    begin d := left(btrim(f[1]), 10)::date; exception when others then continue; end;
    n := nullif(regexp_replace(f[3], '[^0-9.]', '', 'g'), '')::numeric;
    continue when n is null or n < 1 or d > current_date + 1;
    raw := lower(btrim(f[2]));
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

  res := jsonb_build_object('ok', true, 'steps_days', s, 'step_samples', samples, 'weigh_ins', b,
                            'workouts', w, 'skipped', skipped, 'ignored', ignored);
  update sync_keys set last_used = now(), last_result = res where user_id = uid;
  return res;
end
$$;
revoke all on function public.health_sync(text, text, text, text) from public;
grant execute on function public.health_sync(text, text, text, text) to anon, authenticated;

-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run more than once.
-- 0005 only removed calorie entries that were still marked as synced from
-- Health and named exactly "Cal" etc. This also catches ones that were
-- re-saved from the day page, variants like "Active Calories" or "kcal",
-- and any such name that got saved to your workout list (workout_types).
-- The result lists every row it removed.

with bad as (
  select '(^|[^a-z])(k?cals?|calories?|kilocalories?|kj|kilojoules?)([^a-z]|$)' as re
), a as (
  delete from public.activities
   where lower(name) ~ (select re from bad)
      or lower(name) like '%energy%'
      or btrim(name) ~ '^[0-9.,\s]*$'
  returning 'workout on a day' as what, day, name
), t as (
  delete from public.workout_types
   where lower(name) ~ (select re from bad)
      or lower(name) like '%energy%'
      or btrim(name) ~ '^[0-9.,\s]*$'
  returning 'saved workout name' as what, null::date as day, name
)
select * from a
union all
select * from t
order by what, day;

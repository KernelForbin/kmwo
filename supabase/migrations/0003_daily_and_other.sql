-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run more than once.
-- Adds daily check-ins (steps, body weight), other workouts logged on a day
-- (walk, hike, yoga...), and the saved list of custom workout names.
-- Same access model as 0001/0002: RLS on, owner only, explicit grants.

-- One row per day: steps and/or a body weight check-in.
create table if not exists public.daily (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  steps       int check (steps between 0 and 200000),
  body_weight numeric(5, 1) check (body_weight between 50 and 700),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

-- Any number per day, outside the Lift/Ride plan.
create table if not exists public.activities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  name       text not null check (char_length(name) between 1 and 40),
  minutes    int check (minutes between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists activities_user_day on public.activities (user_id, day);

-- Custom workout names, saved the first time they are used.
create table if not exists public.workout_types (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.daily enable row level security;
alter table public.activities enable row level security;
alter table public.workout_types enable row level security;

drop policy if exists "own rows" on public.daily;
create policy "own rows" on public.daily
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on public.activities;
create policy "own rows" on public.activities
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on public.workout_types;
create policy "own rows" on public.workout_types
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.daily to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.workout_types to authenticated;

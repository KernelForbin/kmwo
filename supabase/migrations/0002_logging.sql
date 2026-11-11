-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run more than once.
-- Adds ride details and the short (10-minute home) flag to sessions, and a
-- sets table for lift logging. Same access model as 0001: RLS on, owner only,
-- explicit grants (auto-expose is off for this project).

alter table public.sessions
  add column if not exists short        boolean not null default false,
  add column if not exists ride_minutes int check (ride_minutes between 1 and 300),
  add column if not exists ride_type    text;

create table if not exists public.sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  exercise   text not null check (exercise in ('goblet_squat', 'bench', 'row')),
  set_no     int  not null check (set_no between 1 and 10),
  weight     numeric(6, 2) check (weight >= 0),
  reps       int check (reps between 0 and 100),
  easy       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, day, exercise, set_no)
);

create index if not exists sets_user_day on public.sets (user_id, day);

alter table public.sets enable row level security;

drop policy if exists "own rows" on public.sets;
create policy "own rows" on public.sets
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.sets to authenticated;

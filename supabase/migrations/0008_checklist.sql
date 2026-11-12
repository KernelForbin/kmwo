-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run more than once.
-- Daily checklist: took meds, drank Metamucil, and water in ml (100 ml steps).
-- Its own table so clearing a day's steps/weight never clears the checklist.
-- Same access model as 0001-0003: RLS on, owner only, explicit grants.

create table if not exists public.checklist (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  meds       boolean not null default false,
  metamucil  boolean not null default false,
  water_ml   int not null default 0 check (water_ml between 0 and 10000 and water_ml % 100 = 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.checklist enable row level security;

drop policy if exists "own rows" on public.checklist;
create policy "own rows" on public.checklist
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.checklist to authenticated;

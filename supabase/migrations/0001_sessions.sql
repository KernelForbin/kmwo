-- Run in Supabase: SQL Editor -> paste -> Run.
-- Project has "auto-expose new tables" OFF, so grants below are explicit.

create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  kind       text not null check (kind in ('lift', 'ride')),
  done       boolean not null default true,
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.sessions enable row level security;

create policy "own rows" on public.sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.sessions to authenticated;

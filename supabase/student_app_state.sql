-- Run once in the Supabase SQL editor (project leqbcbtlltvinizbkiya).
-- Keeps each student's saved words and daily streak so they follow the student to a new phone.
-- Until this is run the portal keeps working exactly as before (those two things stay on each device).
-- Row level security: a student can read/write ONLY their own row. No admin secret involved.

create table if not exists public.student_app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  words      jsonb not null default '{}'::jsonb,   -- { list: [saved words], del: { wordKey: deletedAtMs } }
  progress   jsonb not null default '{}'::jsonb,   -- { days: { 'YYYY-MM-DD': { m, w } }, m, w }
  updated_at timestamptz not null default now()
);

alter table public.student_app_state enable row level security;

drop policy if exists "own state read"   on public.student_app_state;
drop policy if exists "own state insert" on public.student_app_state;
drop policy if exists "own state update" on public.student_app_state;

create policy "own state read"   on public.student_app_state for select using (auth.uid() = user_id);
create policy "own state insert" on public.student_app_state for insert with check (auth.uid() = user_id);
create policy "own state update" on public.student_app_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.student_app_state to authenticated;

-- Learning path ("My path" map) for the student portal's practice chat.
--
-- ONE-TIME MANUAL STEP (run supabase/admin_auth.sql and supabase/speaking_practice.sql first):
-- paste this whole file into the Supabase SQL editor for project leqbcbtlltvinizbkiya
-- (https://supabase.com/dashboard/project/leqbcbtlltvinizbkiya/sql/new) and run it once.
-- Safe to re-run (if not exists / or replace / drop-then-create). Until it is run the portal works exactly as before:
-- students simply have no path, and the admin "Learning path" box tells you the setup is missing.
--
--   student_path   one row per unit of a student's course, in order (position), with a status
--                  (upcoming | current | done) and the focus-area keys (student_focus.key) that belong to the unit.
--
-- Access: a student can READ only their own rows. Everything else goes through admin_* RPCs gated by public.admin_ok().

create table if not exists public.student_path (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  position    int  not null,
  title       text not null,
  detail      text not null default '',
  status      text not null default 'upcoming' check (status in ('upcoming', 'current', 'done')),
  focus_keys  text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

create index if not exists student_path_user_idx on public.student_path (user_id, position);

alter table public.student_path enable row level security;
revoke all on public.student_path from anon, authenticated;
grant select on public.student_path to authenticated;

drop policy if exists "students read own path" on public.student_path;
create policy "students read own path" on public.student_path
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.admin_list_path(admin_secret text)
returns setof public.student_path
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  return query select * from public.student_path order by user_id, position;
end;
$$;

-- Replaces one student's whole path with the given array: [{"title": "...", "detail": "...", "status": "done|current|upcoming", "focus_keys": ["..."]}]
-- (the order of the array is the order of the path). Returns the saved rows.
create or replace function public.admin_set_path(admin_secret text, p_user_id uuid, p_units jsonb)
returns setof public.student_path
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  if p_units is null or jsonb_typeof(p_units) <> 'array' then
    raise exception 'p_units must be a JSON array';
  end if;
  if jsonb_array_length(p_units) > 80 then
    raise exception 'a path can have at most 80 units';
  end if;

  delete from public.student_path where user_id = p_user_id;

  insert into public.student_path (user_id, position, title, detail, status, focus_keys)
  select
    p_user_id,
    o.ord::int,
    left(trim(o.u->>'title'), 200),
    left(coalesce(o.u->>'detail', ''), 600),
    case when o.u->>'status' in ('upcoming', 'current', 'done') then o.u->>'status' else 'upcoming' end,
    coalesce(array(select left(k, 80) from jsonb_array_elements_text(case when jsonb_typeof(o.u->'focus_keys') = 'array' then o.u->'focus_keys' else '[]'::jsonb end) as k), '{}')
  from jsonb_array_elements(p_units) with ordinality as o(u, ord)
  where trim(coalesce(o.u->>'title', '')) <> '';

  return query select * from public.student_path where user_id = p_user_id order by position;
end;
$$;

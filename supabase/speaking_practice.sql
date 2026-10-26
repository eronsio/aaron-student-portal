-- NOTE (2026-10-26): run supabase/admin_auth.sql FIRST. The admin_* functions below check public.admin_ok(admin_secret)
-- (a signed-in admin, or the automation secret kept in the database) instead of a fixed secret written in this file.
-- Speaking-practice tables for the student portal's AI Companion.
--
-- ONE-TIME MANUAL STEP: paste this whole file into the Supabase SQL editor
-- for project leqbcbtlltvinizbkiya
-- (https://supabase.com/dashboard/project/leqbcbtlltvinizbkiya/sql/new)
-- and run it once. It is safe to re-run (everything is "if not exists" /
-- "or replace" / drop-then-create), so running it twice does no harm.
--
-- What this adds:
--   student_focus            one row per weak spot per student, taken from
--                            Aaron's lesson notes; the AI works these into practice
--   student_practice_profile per-student level + "instructions for the AI" + an
--                            on/off switch: the Speaking Practice tab only shows up
--                            for students who have a row here with enabled = true
--   practice_sessions        every AI practice session: transcript + report for Aaron
--
-- Access model (same idea as the rest of the app):
--   * Students (logged-in JWT) can READ their own focus rows / profile and
--     CREATE + UPDATE their own practice sessions, but only the transcript /
--     report / ended_at columns — they cannot touch reviewed_at.
--   * Everything else goes through admin_* security-definer RPCs gated by the
--     same admin_ok() check the other admin panels use.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists student_focus (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  key         text not null,                       -- stable slug, lets automation upsert idempotently
  area        text not null,                       -- short label, e.g. "gustar: me gusta / me gustan"
  category    text not null default 'grammar',     -- grammar | vocab | pronunciation | other
  detail      text not null default '',            -- what goes wrong and the correct pattern
  examples    jsonb not null default '[]'::jsonb,  -- [{"wrong": "...", "right": "..."}]
  priority    int  not null default 2 check (priority between 1 and 3),
  status      text not null default 'active' check (status in ('active', 'improving', 'resolved')),
  source      text not null default 'manual',      -- manual | notes | lesson | ai-practice
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists student_practice_profile (
  user_id     uuid primary key references profiles(id) on delete cascade,
  enabled     boolean not null default true,       -- Speaking Practice tab is shown only when true
  level       text not null default '',
  ai_notes    text not null default '',            -- teacher instructions for the AI; the student's browser can read this
  updated_at  timestamptz not null default now()
);

create table if not exists practice_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  mode          text not null default 'plan',
  context       text,
  targets       jsonb not null default '[]'::jsonb,   -- [{"key": "...", "area": "..."}] picked for this session
  transcript    jsonb not null default '[]'::jsonb,   -- [{"role": "user"|"assistant", "content": "...", "voice": true, "ts": "..."}]
  student_turns int  not null default 0,
  report        jsonb,                                -- null until analysed
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  reviewed_at   timestamptz                           -- set by Aaron ("Mark reviewed")
);

create index if not exists practice_sessions_user_started_idx
  on practice_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security + privileges
-- ---------------------------------------------------------------------------

alter table student_focus            enable row level security;
alter table student_practice_profile enable row level security;
alter table practice_sessions        enable row level security;

-- Start from nothing, then grant back only what students need.
revoke all on student_focus            from anon, authenticated;
revoke all on student_practice_profile from anon, authenticated;
revoke all on practice_sessions        from anon, authenticated;

grant select on student_focus            to authenticated;
grant select on student_practice_profile to authenticated;
grant select on practice_sessions        to authenticated;
grant insert (id, user_id, mode, context, targets, transcript, student_turns, started_at)
  on practice_sessions to authenticated;
grant update (transcript, student_turns, report, ended_at)
  on practice_sessions to authenticated;

drop policy if exists "students read own focus" on student_focus;
create policy "students read own focus" on student_focus
  for select to authenticated
  using (user_id = auth.uid() and status <> 'resolved');

drop policy if exists "students read own practice profile" on student_practice_profile;
create policy "students read own practice profile" on student_practice_profile
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "students read own sessions" on practice_sessions;
create policy "students read own sessions" on practice_sessions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "students start own sessions" on practice_sessions;
create policy "students start own sessions" on practice_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "students update own sessions" on practice_sessions;
create policy "students update own sessions" on practice_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Admin RPCs (same ADMIN_SECRET gate as every other admin_* function)
-- ---------------------------------------------------------------------------

create or replace function admin_list_focus(admin_secret text)
returns setof student_focus
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  return query select * from student_focus order by user_id, priority desc, created_at;
end;
$$;

-- Upsert by (user_id, key). The admin UI and the lesson-notes automation both
-- call this, so re-running it with the same key updates instead of duplicating.
create or replace function admin_upsert_focus(
  admin_secret text,
  p_user_id    uuid,
  p_key        text,
  p_area       text,
  p_category   text default 'grammar',
  p_detail     text default '',
  p_examples   jsonb default '[]'::jsonb,
  p_priority   int  default 2,
  p_status     text default 'active',
  p_source     text default 'manual'
)
returns student_focus
language plpgsql
security definer
set search_path = public
as $$
declare
  result student_focus;
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  insert into student_focus as f (user_id, key, area, category, detail, examples, priority, status, source)
  values (
    p_user_id, p_key, p_area,
    coalesce(p_category, 'grammar'), coalesce(p_detail, ''), coalesce(p_examples, '[]'::jsonb),
    coalesce(p_priority, 2), coalesce(p_status, 'active'), coalesce(p_source, 'manual')
  )
  on conflict (user_id, key) do update set
    area       = excluded.area,
    category   = excluded.category,
    detail     = excluded.detail,
    examples   = excluded.examples,
    priority   = excluded.priority,
    status     = excluded.status,
    source     = excluded.source,
    updated_at = now()
  returning f.* into result;
  return result;
end;
$$;

create or replace function admin_delete_focus(admin_secret text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  delete from student_focus where id = p_id;
end;
$$;

create or replace function admin_list_practice_profiles(admin_secret text)
returns setof student_practice_profile
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  return query select * from student_practice_profile;
end;
$$;

create or replace function admin_upsert_practice_profile(
  admin_secret text,
  p_user_id    uuid,
  p_level      text,
  p_ai_notes   text,
  p_enabled    boolean default true
)
returns student_practice_profile
language plpgsql
security definer
set search_path = public
as $$
declare
  result student_practice_profile;
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  insert into student_practice_profile as p (user_id, level, ai_notes, enabled)
  values (p_user_id, coalesce(p_level, ''), coalesce(p_ai_notes, ''), coalesce(p_enabled, true))
  on conflict (user_id) do update set
    level      = excluded.level,
    ai_notes   = excluded.ai_notes,
    enabled    = excluded.enabled,
    updated_at = now()
  returning p.* into result;
  return result;
end;
$$;

create or replace function admin_list_practice_sessions(
  admin_secret text,
  p_user_id    uuid default null,
  p_limit      int  default 150
)
returns setof practice_sessions
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  return query
    select * from practice_sessions s
    where (p_user_id is null or s.user_id = p_user_id)
    order by s.started_at desc
    limit greatest(1, least(coalesce(p_limit, 150), 500));
end;
$$;

-- Used by the admin-side "Analyze now" button for sessions that were never
-- analysed (student closed the tab mid-session, or the AI proxy wasn't
-- updated yet).
create or replace function admin_set_practice_report(admin_secret text, p_id uuid, p_report jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  update practice_sessions
     set report = p_report,
         ended_at = coalesce(ended_at, now())
   where id = p_id;
end;
$$;

create or replace function admin_mark_practice_reviewed(admin_secret text, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  update practice_sessions
     set reviewed_at = now()
   where user_id = p_user_id and reviewed_at is null;
end;
$$;

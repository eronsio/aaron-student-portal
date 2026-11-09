-- Adult mode for the speaking-practice tutor (2026-11-09).
--
-- ONE-TIME STEP: paste this whole file into the Supabase SQL editor for project leqbcbtlltvinizbkiya and run it. Safe to re-run.
-- Then redeploy the Edge Function ai-companion (supabase/functions/ai-companion/index.ts, JWT verification stays ON).
--
-- What it adds: student_practice_profile.adult (default false = "treat as under 18"). Only the teacher can change it, through
-- admin_upsert_practice_profile(..., p_adult). A student can read their own row but cannot update it (no update grant), so nobody
-- can unlock mature tutor styles for themselves. The ai-companion function reads this flag with the student's own token and, for anyone
-- not confirmed as an adult, appends a clean/age-appropriate rule that overrides whatever the browser sent.
--
-- Until this is run, nobody counts as an adult and every student's tutor stays clean (the safe default).

alter table public.student_practice_profile add column if not exists adult boolean not null default false;

-- The old 5-argument version must go first, otherwise a 5-argument call would match both versions.
drop function if exists public.admin_upsert_practice_profile(text, uuid, text, text, boolean);

create or replace function public.admin_upsert_practice_profile(
  admin_secret text,
  p_user_id    uuid,
  p_level      text,
  p_ai_notes   text,
  p_enabled    boolean default true,
  p_adult      boolean default null      -- null = leave the current value alone
)
returns public.student_practice_profile
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.student_practice_profile;
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  insert into public.student_practice_profile as p (user_id, level, ai_notes, enabled, adult)
  values (p_user_id, coalesce(p_level, ''), coalesce(p_ai_notes, ''), coalesce(p_enabled, true), coalesce(p_adult, false))
  on conflict (user_id) do update set
    level      = excluded.level,
    ai_notes   = excluded.ai_notes,
    enabled    = excluded.enabled,
    adult      = coalesce(p_adult, p.adult),
    updated_at = now()
  returning p.* into result;
  return result;
end;
$$;

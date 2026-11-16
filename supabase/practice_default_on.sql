-- Speaking-practice AI agent ON by default for every NEW Spanish student (Aaron, 2026-11-16: "activate the AI agent for all students by default unless I ask you not to").
-- Run once in the Supabase SQL editor (project leqbcbtlltvinizbkiya). Safe to re-run. Existing students were switched on separately through admin_upsert_practice_profile.
-- A new row is created with enabled = true and adult = false (the safe default: clean tutor until Aaron marks the student as 18+). Level and notes start empty and the
-- post-lesson sync fills them in. To switch someone off later, Aaron asks Claude (or unticks the box in Admin > Speaking Practice); the row is never touched again.

create or replace function public.practice_default_on()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'spanish' then
    insert into public.student_practice_profile (user_id, enabled) values (new.id, true) on conflict (user_id) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists practice_default_on on public.profiles;
create trigger practice_default_on after insert on public.profiles for each row execute function public.practice_default_on();

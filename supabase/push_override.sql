-- Manual push-notification override, per student (Claude sets it when Aaron asks, e.g. "remind Alicia to practice 20 minutes a day").
-- Run once in the Supabase SQL editor (project leqbcbtlltvinizbkiya). Safe to re-run. Needs push.sql + the send-push function (updated to read this table).
--
-- While an override is active for a student (their LOCAL date <= until_date) the hourly push job sends THAT message once a day at the student's
-- reminder hour (quiet hours 22:00-08:00 and "one push per local day" still apply) INSTEAD of the normal streak/daily/quiet/recap messages.
-- The day after until_date the normal pushes resume by themselves: nothing has to be scheduled or cleaned up.

create table if not exists public.push_override (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  message    text not null check (char_length(message) between 1 and 200),
  open_url   text not null default '/?open=practice',
  until_date date not null,
  created_at timestamptz not null default now()
);
alter table public.push_override enable row level security;
revoke all on public.push_override from anon, authenticated;

create or replace function public.admin_set_push_override(admin_secret text, p_user_id uuid, p_message text, p_until date, p_url text default '/?open=practice')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok(admin_secret) then raise exception 'unauthorized'; end if;
  insert into public.push_override (user_id, message, until_date, open_url, created_at)
  values (p_user_id, left(trim(p_message), 200), p_until, coalesce(nullif(p_url, ''), '/?open=practice'), now())
  on conflict (user_id) do update set message = excluded.message, until_date = excluded.until_date, open_url = excluded.open_url, created_at = now();
end; $$;

create or replace function public.admin_clear_push_override(admin_secret text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok(admin_secret) then raise exception 'unauthorized'; end if;
  delete from public.push_override where user_id = p_user_id;
end; $$;

create or replace function public.admin_list_push_overrides(admin_secret text)
returns table (user_id uuid, message text, open_url text, until_date date, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok(admin_secret) then raise exception 'unauthorized'; end if;
  return query select o.user_id, o.message, o.open_url, o.until_date, o.created_at from public.push_override o;
end; $$;

revoke all on function public.admin_set_push_override(text, uuid, text, date, text) from public;
revoke all on function public.admin_clear_push_override(text, uuid) from public;
revoke all on function public.admin_list_push_overrides(text) from public;
grant execute on function public.admin_set_push_override(text, uuid, text, date, text) to anon, authenticated;
grant execute on function public.admin_clear_push_override(text, uuid) to anon, authenticated;
grant execute on function public.admin_list_push_overrides(text) to anon, authenticated;

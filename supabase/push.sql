-- Push notifications (practice reminders) for the student portal.
--
-- ONE-TIME STEP 1 of 3 (run supabase/admin_auth.sql and speaking_practice.sql first): paste this whole file into the Supabase SQL editor for project
-- leqbcbtlltvinizbkiya (https://supabase.com/dashboard/project/leqbcbtlltvinizbkiya/sql/new) and run it. Safe to re-run.
-- Step 2: deploy the Edge Function `send-push` (supabase/functions/send-push/index.ts) with the default JWT verification ENABLED.
-- Step 3: run supabase/push_cron.sql (the hourly schedule). Until all three are done the portal shows no reminder option and nothing changes.
--
--   push_config         one row, server only: the VAPID key pair (made by the function on first use, never seen by anyone) + the schedule's shared secret
--   push_subscriptions  one row per student device that turned reminders on (their browser's push address + chosen reminder hour + time zone)
--   push_log            one row per notification sent (used to send at most one a day and to stop after a few unanswered ones)
-- A student can manage only their own subscriptions. Everything else is read/written by the function with the service role.

create table if not exists public.push_config (
  id            boolean primary key default true check (id),
  vapid_public  text,
  vapid_private text,
  cron_secret   text not null default encode(gen_random_bytes(24), 'hex')
);
insert into public.push_config (id) values (true) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  tz          text not null default 'UTC',
  remind_hour int  not null default 18 check (remind_hour between 6 and 22),
  enabled     boolean not null default true,
  ua          text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "own push read"   on public.push_subscriptions;
drop policy if exists "own push insert" on public.push_subscriptions;
drop policy if exists "own push update" on public.push_subscriptions;
drop policy if exists "own push delete" on public.push_subscriptions;
create policy "own push read"   on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own push insert" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "own push update" on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own push delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

create table if not exists public.push_log (
  id      bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null,
  sent_at timestamptz not null default now(),
  status  int  not null default 0,
  body    text not null default ''
);
create index if not exists push_log_user_idx on public.push_log (user_id, sent_at desc);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

-- For the admin nudge list: which students have reminders on, and what was sent last.
create or replace function public.admin_list_push(admin_secret text)
returns table (user_id uuid, enabled boolean, remind_hour int, tz text, last_sent timestamptz, last_kind text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_ok(admin_secret) then
    raise exception 'unauthorized';
  end if;
  return query
    select s.user_id,
           bool_or(s.enabled),
           max(s.remind_hour),
           max(s.tz),
           (select max(l.sent_at) from public.push_log l where l.user_id = s.user_id),
           (select l.kind from public.push_log l where l.user_id = s.user_id order by l.sent_at desc limit 1)
    from public.push_subscriptions s
    group by s.user_id;
end;
$$;

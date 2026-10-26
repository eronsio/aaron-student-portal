-- Admin access by real login instead of a shared secret.
--
-- WHY: every admin_* function used to check `admin_secret = '<a fixed string>'`, and that string was written
-- in the public script.js. Worse, the check was written `if admin_secret <> '...' then raise exception`, which is
-- NULL (= "don't raise") when the caller sends null, so a request with no secret at all got through.
--
-- WHAT THIS DOES (safe to re-run):
--   * app_admins     the Supabase accounts that are admins (Aaron's own login). No client can read or write it.
--   * admin_config   one row: a secret kept ONLY for scripts that cannot sign in (the hourly automation). Locked the same way.
--   * admin_ok(secret)  true for a signed-in admin OR the exact automation secret; false for everything else, null included.
--   * am_i_admin()   lets the portal ask "am I an admin?" with the signed-in user's token.
--   * Rewrites every public function that compares admin_secret to a fixed string so it calls admin_ok() instead.
--     The originals are saved in admin_fn_backup first (to roll back: run the saved definitions).
--
-- It reads the OLD secret out of the existing functions and keeps it as the automation secret, so nothing breaks
-- the moment you run it. Rotating that secret afterwards (admin_rotate_automation_secret.sql) is what kills the leaked one.

create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create table if not exists public.admin_config (
  id                boolean primary key default true check (id),
  automation_secret text not null check (length(automation_secret) >= 12)
);
alter table public.admin_config enable row level security;
revoke all on public.admin_config from anon, authenticated;

create table if not exists public.admin_fn_backup (
  id           bigserial primary key,
  fn_name      text not null,
  fn_args      text not null,
  definition   text not null,
  backed_up_at timestamptz not null default now()
);
alter table public.admin_fn_backup enable row level security;
revoke all on public.admin_fn_backup from anon, authenticated;

create or replace function public.admin_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid())
      or (coalesce(p_secret, '') <> ''
          and p_secret = (select c.automation_secret from public.admin_config c where c.id));
$$;
revoke all on function public.admin_ok(text) from public, anon, authenticated;

create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- The admin account(s): Aaron's own portal login.
insert into public.app_admins (user_id)
select u.id from auth.users u where lower(u.email) = 'aaronsiebertsio@gmail.com'
on conflict (user_id) do nothing;

-- Rewrite the functions.
do $$
declare
  r          record;
  pat        constant text := 'admin_secret\s*(<>|!=|is distinct from)\s*''[^'']+''';
  old_secret text;
  def        text;
  newdef     text;
  n          int := 0;
begin
  select (regexp_match(p.prosrc, 'admin_secret\s*(?:<>|!=|is distinct from)\s*''([^'']+)'''))[1]
    into old_secret
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosrc ~ pat
   limit 1;

  if old_secret is null then
    raise notice 'No function compares admin_secret to a fixed string: nothing to rewrite.';
    return;
  end if;

  insert into public.admin_config (automation_secret) values (old_secret) on conflict (id) do nothing;

  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
             from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prosrc ~ pat
  loop
    def := pg_get_functiondef(r.oid);
    insert into public.admin_fn_backup (fn_name, fn_args, definition) values (r.proname, r.args, def);
    newdef := regexp_replace(def, pat, 'not public.admin_ok(admin_secret)', 'g');
    if newdef = def or position(old_secret in newdef) > 0 then
      raise exception 'Could not safely rewrite %(%): it still mentions the shared secret', r.proname, r.args;
    end if;
    execute newdef;
    n := n + 1;
  end loop;

  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and position(old_secret in p.prosrc) > 0) then
    raise exception 'A public function still contains the shared secret after the rewrite';
  end if;
  raise notice 'Rewrote % functions to use admin_ok().', n;
end $$;

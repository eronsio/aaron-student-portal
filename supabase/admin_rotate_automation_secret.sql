-- Step 2 of the admin-auth change. Run ONLY after supabase/admin_auth.sql has been applied AND Aaron has signed in to the
-- portal with his own account and confirmed the admin tools work.
--
-- Replaces the automation secret (the only secret left; it exists for the hourly sync script, which cannot sign in) with a
-- fresh random one. This is what makes the old secret, which was written in the public script.js, stop working.
-- Afterwards: read the new value with  select automation_secret from public.admin_config;  and put it ONLY in the
-- local automation (scheduled task) — never in the repo or the website.
update public.admin_config
   set automation_secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 where id;

select 'automation secret rotated' as status;

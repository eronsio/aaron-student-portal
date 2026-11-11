-- Course catalog lockdown (2026-11-11).
--
-- PROBLEM: public.courses_catalog (the Spanish + Music course content) had UPDATE and DELETE policies for the PUBLIC role with the
-- condition `true`, and the anon role (anyone holding the site's public key) had UPDATE/DELETE/TRUNCATE grants. So anyone could overwrite or
-- delete every course. Reading must stay open ("Anyone can read courses"): students' browsers read the catalog.
--
-- WHAT THIS CHANGES: only a signed-in admin (public.am_i_admin()) can update or delete catalog rows, and anon loses all write rights.
-- Saving courses from the admin screens is NOT affected: it goes through the security-definer RPCs save_courses_admin /
-- save_music_courses_admin. The admin "reset courses" button (DELETE) keeps working for a signed-in admin.
-- Safe to re-run. Backup taken before this: ~/Downloads/Skool Music School backup/portal-courses-catalog-backup-2026-11-11.json

drop policy if exists "Admin can update courses" on public.courses_catalog;
drop policy if exists "Admin can delete courses" on public.courses_catalog;

create policy "Admin can update courses" on public.courses_catalog
  for update to authenticated using (public.am_i_admin()) with check (public.am_i_admin());
create policy "Admin can delete courses" on public.courses_catalog
  for delete to authenticated using (public.am_i_admin());

revoke insert, update, delete, truncate, references, trigger on public.courses_catalog from anon;
revoke truncate, references, trigger on public.courses_catalog from authenticated;

-- Public bucket for course images (anyone can view an image by URL; only the admin login can upload/replace/delete).
insert into storage.buckets (id, name, public)
values ('course-media', 'course-media', true)
on conflict (id) do update set public = true;

drop policy if exists "course media admin insert" on storage.objects;
create policy "course media admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-media' and public.am_i_admin());

drop policy if exists "course media admin update" on storage.objects;
create policy "course media admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'course-media' and public.am_i_admin())
  with check (bucket_id = 'course-media' and public.am_i_admin());

drop policy if exists "course media admin delete" on storage.objects;
create policy "course media admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-media' and public.am_i_admin());

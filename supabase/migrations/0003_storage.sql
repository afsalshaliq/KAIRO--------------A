-- KAIRO — private storage bucket + download authorization.
-- Bucket 'curriculum' is PRIVATE. Object paths look like:
--   <material_id>/<original-filename>
-- Access is granted only when the caller can access the owning material.

insert into storage.buckets (id, name, public)
values ('curriculum', 'curriculum', false)
on conflict (id) do update set public = false;

-- Map a storage object to its material by the leading path segment (material_id).
create or replace function storage_material_id(object_name text) returns uuid
language sql immutable set search_path = public, pg_temp as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

-- Admins may do anything in the curriculum bucket.
drop policy if exists curriculum_admin_all on storage.objects;
create policy curriculum_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'curriculum' and is_admin())
  with check (bucket_id = 'curriculum' and is_admin());

-- Teachers may DOWNLOAD (select) only objects whose material they can access.
-- Unpublished / unready / unassigned files therefore never download.
drop policy if exists curriculum_teacher_read on storage.objects;
create policy curriculum_teacher_read on storage.objects for select to authenticated
  using (
    bucket_id = 'curriculum'
    and teacher_can_access_material(storage_material_id(name))
  );
-- (No teacher insert/update/delete policy => teachers cannot write to the bucket.)

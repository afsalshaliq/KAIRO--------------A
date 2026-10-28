-- KAIRO — Row-Level Security & authorization functions.
-- Security-definer helpers have a fixed search_path and tight execute grants.
-- Negative authorization cases are exercised in tests/security.

-- ---------------------------------------------------------------------------
-- Authorization helper functions (SECURITY DEFINER, pinned search_path).
-- These read profiles/assignments WITHOUT triggering recursive RLS.
-- ---------------------------------------------------------------------------
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function is_active_teacher() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'teacher' and status = 'active'
  );
$$;

-- Can the current teacher access this material via a live (non-revoked) assignment
-- AND is the material ready + published?
create or replace function teacher_can_access_material(p_material uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from curriculum_materials m
    join teacher_assignments a
      on a.subject_id = m.subject_id
     and a.class_id = m.class_id
     and (m.section_id is null or a.section_id = m.section_id)
    where m.id = p_material
      and m.status = 'ready'
      and m.is_published = true
      and a.teacher_id = auth.uid()
      and a.is_revoked = false
      and is_active_teacher()
  );
$$;

revoke all on function auth_role(), is_admin(), is_active_teacher(), teacher_can_access_material(uuid) from public;
grant execute on function auth_role(), is_admin(), is_active_teacher(), teacher_can_access_material(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guard: teachers cannot escalate their own role or un-suspend themselves.
-- ---------------------------------------------------------------------------
create or replace function guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if is_admin() then
    return new;  -- admins may change role/status
  end if;
  if new.role is distinct from old.role or new.status is distinct from old.status then
    raise exception 'not authorized to modify role or status';
  end if;
  return new;
end $$;

drop trigger if exists trg_profile_guard on profiles;
create trigger trg_profile_guard before update on profiles
  for each row execute function guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------------
alter table profiles              enable row level security;
alter table classes               enable row level security;
alter table sections              enable row level security;
alter table subjects              enable row level security;
alter table teacher_assignments   enable row level security;
alter table curriculum_materials  enable row level security;
alter table material_chunks       enable row level security;
alter table document_processing_jobs enable row level security;
alter table chat_sessions         enable row level security;
alter table chat_messages         enable row level security;
alter table activities            enable row level security;
alter table worksheets            enable row level security;
alter table quizzes               enable row level security;
alter table generation_history    enable row level security;
alter table audit_logs            enable row level security;
alter table invitations           enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin());

drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());
-- (role/status changes by non-admins blocked by trg_profile_guard trigger.)

drop policy if exists profiles_admin_insert on profiles;
create policy profiles_admin_insert on profiles for insert to authenticated
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- Reference data: readable by any authenticated user; mutated only by admins.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['classes','sections','subjects'] loop
    execute format('drop policy if exists %1$s_read on %1$s', t);
    execute format('create policy %1$s_read on %1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_admin_write on %1$s', t);
    execute format('create policy %1$s_admin_write on %1$s for all to authenticated
                    using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- teacher_assignments — admin manages; teacher may read only their own.
-- ---------------------------------------------------------------------------
drop policy if exists assignments_read on teacher_assignments;
create policy assignments_read on teacher_assignments for select to authenticated
  using (is_admin() or teacher_id = auth.uid());

drop policy if exists assignments_admin_write on teacher_assignments;
create policy assignments_admin_write on teacher_assignments for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- curriculum_materials — admin full; teacher sees only accessible ones.
-- ---------------------------------------------------------------------------
drop policy if exists materials_admin_all on curriculum_materials;
create policy materials_admin_all on curriculum_materials for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists materials_teacher_read on curriculum_materials;
create policy materials_teacher_read on curriculum_materials for select to authenticated
  using (
    status = 'ready' and is_published = true and exists (
      select 1 from teacher_assignments a
      where a.teacher_id = auth.uid() and a.is_revoked = false
        and a.subject_id = curriculum_materials.subject_id
        and a.class_id = curriculum_materials.class_id
        and (curriculum_materials.section_id is null or a.section_id = curriculum_materials.section_id)
    ) and is_active_teacher()
  );

-- material_chunks: readable only when the parent material is accessible.
drop policy if exists chunks_admin_all on material_chunks;
create policy chunks_admin_all on material_chunks for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists chunks_teacher_read on material_chunks;
create policy chunks_teacher_read on material_chunks for select to authenticated
  using (teacher_can_access_material(material_id));

-- document_processing_jobs: admin/service only (teachers never touch).
drop policy if exists jobs_admin_all on document_processing_jobs;
create policy jobs_admin_all on document_processing_jobs for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- chat_sessions / chat_messages — strictly per-teacher private.
-- ---------------------------------------------------------------------------
drop policy if exists sessions_owner on chat_sessions;
create policy sessions_owner on chat_sessions for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and is_active_teacher());

drop policy if exists messages_owner on chat_messages;
create policy messages_owner on chat_messages for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and is_active_teacher());

-- ---------------------------------------------------------------------------
-- activities / worksheets / quizzes / generation_history — owner-only.
-- (Admin analytics must NOT grant read of private content — no admin policy here.)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['activities','worksheets','quizzes','generation_history'] loop
    execute format('drop policy if exists %1$s_owner on %1$s', t);
    execute format('create policy %1$s_owner on %1$s for all to authenticated
                    using (teacher_id = auth.uid())
                    with check (teacher_id = auth.uid() and is_active_teacher())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- audit_logs — admins may read; nobody may update/delete via RLS.
-- Inserts happen through security-definer functions / service role only.
-- ---------------------------------------------------------------------------
drop policy if exists audit_admin_read on audit_logs;
create policy audit_admin_read on audit_logs for select to authenticated
  using (is_admin());
-- (no insert/update/delete policies => blocked for all authenticated roles)

-- ---------------------------------------------------------------------------
-- invitations — admin only.
-- ---------------------------------------------------------------------------
drop policy if exists invitations_admin on invitations;
create policy invitations_admin on invitations for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Audit helper (callable by admins; writes an append-only row).
-- ---------------------------------------------------------------------------
create or replace function log_audit(p_action text, p_target text, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  insert into audit_logs(actor_id, action, target, meta)
  values (auth.uid(), p_action, p_target, coalesce(p_meta, '{}'::jsonb));
end $$;
revoke all on function log_audit(text, text, jsonb) from public;
grant execute on function log_audit(text, text, jsonb) to authenticated;

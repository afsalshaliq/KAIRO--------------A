-- KAIRO — Multi-tenant Row-Level Security & Authorization

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, pinned search_path)
-- ---------------------------------------------------------------------------

create or replace function auth_school_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select school_id from profiles where id = auth.uid();
$$;

create or replace function is_principal() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'principal')
      and status = 'active'
  );
$$;

create or replace function is_teacher_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'teacher_admin'
      and status = 'active'
  );
$$;

-- Overwrite is_admin to include 'principal' alongside 'admin' and 'super_admin'
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'principal', 'super_admin')
      and status = 'active'
  );
$$;

-- Overwrite is_active_teacher to include teacher_admin
create or replace function is_active_teacher() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('teacher', 'teacher_admin')
      and status = 'active'
  );
$$;

create or replace function has_teacher_admin_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from teacher_admin_permissions tap
    join profiles p on p.id = tap.teacher_id
    where tap.teacher_id = auth.uid()
      and tap.permission_code = p_permission
      and p.role = 'teacher_admin'
      and p.status = 'active'
  );
$$;

revoke all on function auth_school_id(), is_principal(), is_teacher_admin(), has_teacher_admin_permission(text) from public;
grant execute on function auth_school_id(), is_principal(), is_teacher_admin(), has_teacher_admin_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Update profile privilege guard trigger for multi-tenancy & teacher_admin
-- ---------------------------------------------------------------------------
create or replace function guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  caller_school uuid;
begin
  -- No privileged field changed → allow (e.g. updating full_name, phone, avatar)
  if new.role is not distinct from old.role
     and new.status is not distinct from old.status
     and new.school_id is not distinct from old.school_id then
    return new;
  end if;

  -- Super admin has unrestricted power
  if is_super_admin() then
    return new;
  end if;

  -- Principals / school admins
  if is_admin() then
    caller_school := auth_school_id();
    
    -- Cannot touch accounts outside own school
    if caller_school is not null and (old.school_id is distinct from caller_school or new.school_id is distinct from caller_school) then
      raise exception 'principals cannot modify accounts outside their own school';
    end if;

    -- Principals cannot modify super_admin or other principals
    if old.role in ('super_admin', 'admin', 'principal') then
      raise exception 'principals cannot modify administrator accounts';
    end if;

    -- Principals can only set role to teacher or teacher_admin
    if new.role not in ('teacher', 'teacher_admin') then
      raise exception 'principals cannot grant administrator roles';
    end if;

    return new;
  end if;

  raise exception 'not authorized to modify role or status';
end $$;

-- ---------------------------------------------------------------------------
-- Enable RLS on new tables
-- ---------------------------------------------------------------------------
alter table schools enable row level security;
alter table school_domains enable row level security;
alter table permissions enable row level security;
alter table teacher_admin_permissions enable row level security;
alter table timetables enable row level security;
alter table teacher_requests enable row level security;
alter table announcements enable row level security;
alter table notifications enable row level security;
alter table ai_configurations enable row level security;
alter table ai_usage enable row level security;
alter table biometric_credentials enable row level security;

-- ---------------------------------------------------------------------------
-- profiles policy updates (multi-tenant isolation)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (
    id = auth.uid()
    or is_super_admin()
    or (
      -- Same school check
      (school_id is not null and school_id = auth_school_id())
      and (
        is_admin()
        or is_teacher_admin()
        or has_teacher_admin_permission('school.teacher.view')
        or role in ('admin', 'principal') -- teachers can see their principal
      )
    )
    or (school_id is null and auth_school_id() is null and is_admin()) -- legacy/test fallback
  );

drop policy if exists profiles_self_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (
    id = auth.uid()
    or is_super_admin()
    or (is_admin() and school_id is not distinct from auth_school_id())
  )
  with check (
    id = auth.uid()
    or is_super_admin()
    or (is_admin() and school_id is not distinct from auth_school_id())
  );

-- ---------------------------------------------------------------------------
-- schools policies
-- ---------------------------------------------------------------------------
drop policy if exists schools_select on schools;
create policy schools_select on schools for select to authenticated
  using (is_super_admin() or id = auth_school_id());

drop policy if exists schools_super_all on schools;
create policy schools_super_all on schools for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- permissions policies
-- ---------------------------------------------------------------------------
drop policy if exists permissions_read on permissions;
create policy permissions_read on permissions for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- teacher_admin_permissions policies
-- ---------------------------------------------------------------------------
drop policy if exists tap_select on teacher_admin_permissions;
create policy tap_select on teacher_admin_permissions for select to authenticated
  using (
    is_super_admin()
    or (school_id = auth_school_id() and (is_admin() or teacher_id = auth.uid()))
  );

drop policy if exists tap_manage on teacher_admin_permissions;
create policy tap_manage on teacher_admin_permissions for all to authenticated
  using (is_super_admin() or (is_admin() and school_id = auth_school_id()))
  with check (is_super_admin() or (is_admin() and school_id = auth_school_id()));

-- ---------------------------------------------------------------------------
-- timetables policies
-- ---------------------------------------------------------------------------
drop policy if exists timetables_select on timetables;
create policy timetables_select on timetables for select to authenticated
  using (
    is_super_admin()
    or (
      school_id = auth_school_id()
      and (
        is_admin()
        or is_teacher_admin()
        or teacher_id = auth.uid()
        or has_teacher_admin_permission('school.timetable.view')
      )
    )
  );

drop policy if exists timetables_manage on timetables;
create policy timetables_manage on timetables for all to authenticated
  using (
    is_super_admin()
    or (school_id = auth_school_id() and (is_admin() or has_teacher_admin_permission('school.timetable.manage')))
  )
  with check (
    is_super_admin()
    or (school_id = auth_school_id() and (is_admin() or has_teacher_admin_permission('school.timetable.manage')))
  );

-- ---------------------------------------------------------------------------
-- teacher_requests policies
-- ---------------------------------------------------------------------------
drop policy if exists requests_select on teacher_requests;
create policy requests_select on teacher_requests for select to authenticated
  using (
    is_super_admin()
    or (
      school_id = auth_school_id()
      and (
        teacher_id = auth.uid()
        or is_admin()
        or has_teacher_admin_permission('school.request.review')
      )
    )
  );

drop policy if exists requests_insert on teacher_requests;
create policy requests_insert on teacher_requests for insert to authenticated
  with check (
    is_super_admin()
    or (
      teacher_id = auth.uid()
      and (school_id = auth_school_id() or auth_school_id() is null)
      and is_active_teacher()
    )
  );

drop policy if exists requests_update on teacher_requests;
create policy requests_update on teacher_requests for update to authenticated
  using (
    is_super_admin()
    or (
      school_id = auth_school_id()
      and (
        is_admin()
        or has_teacher_admin_permission('school.request.review')
        or (teacher_id = auth.uid() and status = 'pending')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- announcements policies
-- ---------------------------------------------------------------------------
drop policy if exists announcements_select on announcements;
create policy announcements_select on announcements for select to authenticated
  using (
    is_super_admin()
    or (
      school_id = auth_school_id()
      and (is_admin() or is_published = true)
    )
  );

drop policy if exists announcements_manage on announcements;
create policy announcements_manage on announcements for all to authenticated
  using (is_super_admin() or (is_admin() and school_id = auth_school_id()))
  with check (is_super_admin() or (is_admin() and school_id = auth_school_id()));

-- ---------------------------------------------------------------------------
-- notifications policies
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select to authenticated
  using (user_id = auth.uid() or is_super_admin());

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ai_configurations policies
-- ---------------------------------------------------------------------------
drop policy if exists ai_config_select on ai_configurations;
create policy ai_config_select on ai_configurations for select to authenticated
  using (
    is_super_admin()
    or (school_id = auth_school_id() and (is_admin() or is_active_teacher()))
  );

drop policy if exists ai_config_manage on ai_configurations;
create policy ai_config_manage on ai_configurations for all to authenticated
  using (is_super_admin() or (is_admin() and school_id = auth_school_id()))
  with check (is_super_admin() or (is_admin() and school_id = auth_school_id()));

-- ---------------------------------------------------------------------------
-- ai_usage policies
-- ---------------------------------------------------------------------------
drop policy if exists ai_usage_select on ai_usage;
create policy ai_usage_select on ai_usage for select to authenticated
  using (
    is_super_admin()
    or (school_id = auth_school_id() and (is_admin() or teacher_id = auth.uid()))
  );

drop policy if exists ai_usage_insert on ai_usage;
create policy ai_usage_insert on ai_usage for insert to authenticated
  with check (
    is_super_admin()
    or (teacher_id = auth.uid() and (school_id = auth_school_id() or auth_school_id() is null))
  );

-- ---------------------------------------------------------------------------
-- biometric_credentials policies
-- ---------------------------------------------------------------------------
drop policy if exists biometrics_select on biometric_credentials;
create policy biometrics_select on biometric_credentials for select to authenticated
  using (user_id = auth.uid() or is_super_admin());

drop policy if exists biometrics_manage on biometric_credentials;
create policy biometrics_manage on biometric_credentials for all to authenticated
  using (
    is_super_admin()
    or (user_id = auth.uid() and (school_id = auth_school_id() or auth_school_id() is null))
  )
  with check (
    is_super_admin()
    or (user_id = auth.uid() and (school_id = auth_school_id() or auth_school_id() is null))
  );

-- ---------------------------------------------------------------------------
-- audit_logs policies (tenant-scoped)
-- ---------------------------------------------------------------------------
drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select to authenticated
  using (
    is_super_admin()
    or (
      school_id = auth_school_id()
      and (is_admin() or has_teacher_admin_permission('school.audit.view'))
    )
  );

-- ---------------------------------------------------------------------------
-- Update curriculum_materials and classes to enforce tenant boundary
-- ---------------------------------------------------------------------------
drop policy if exists materials_admin_all on curriculum_materials;
create policy materials_admin_all on curriculum_materials for all to authenticated
  using (
    is_super_admin()
    or (is_admin() and (school_id is not distinct from auth_school_id()))
    or (has_teacher_admin_permission('school.material.upload') and school_id = auth_school_id())
  )
  with check (
    is_super_admin()
    or (is_admin() and (school_id is not distinct from auth_school_id()))
    or (has_teacher_admin_permission('school.material.upload') and school_id = auth_school_id())
  );

-- KAIRO — super_admin authorization.
--
-- Role hierarchy:  super_admin  >  admin (principal)  >  teacher
--
-- Design: is_admin() now returns true for BOTH admin and super_admin, so every
-- existing admin RLS policy and control automatically applies to super admins
-- too. is_super_admin() gates only the ELEVATED powers (managing principals).

-- ---------------------------------------------------------------------------
-- Helper functions.
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
      and status = 'active'
  );
$$;

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  );
$$;

revoke all on function is_super_admin() from public;
grant execute on function is_super_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Privilege guard: who may change a profile's role or status.
--   super_admin : anyone (full control, including other admins).
--   admin       : teachers only, and may never grant an elevated role.
--   everyone    : nobody (may still edit their own non-privileged fields).
-- Runs on top of RLS; the service role (Edge Functions) bypasses it and does
-- its own equivalent checks.
-- ---------------------------------------------------------------------------
create or replace function guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- No privileged field changed → allow (e.g. a user editing their full_name).
  if new.role is not distinct from old.role
     and new.status is not distinct from old.status then
    return new;
  end if;

  -- A privileged field (role and/or status) is changing.
  if is_super_admin() then
    return new;  -- full control over every account
  end if;

  if is_admin() then
    -- Principals manage TEACHERS only, and cannot mint administrators.
    if old.role <> 'teacher' then
      raise exception 'principals cannot modify administrator accounts';
    end if;
    if new.role <> 'teacher' then
      raise exception 'principals cannot grant administrator roles';
    end if;
    return new;
  end if;

  raise exception 'not authorized to modify role or status';
end $$;

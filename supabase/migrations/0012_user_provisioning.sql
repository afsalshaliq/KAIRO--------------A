-- KAIRO — Migration 0012: User Provisioning & Canonical Super Admin Profile
-- Preserves canonical Super Admin UUID: 10e528c9-c6b1-417f-8c23-1427466fc0e0
-- Idempotent, forward-only migration.

do $$
begin
  -- If auth.users has the canonical superadmin account, ensure public.profiles row is synchronized
  if exists (select 1 from auth.users where id = '10e528c9-c6b1-417f-8c23-1427466fc0e0') then
    insert into public.profiles (
      id,
      email,
      full_name,
      role,
      status,
      school_id,
      department
    )
    values (
      '10e528c9-c6b1-417f-8c23-1427466fc0e0',
      'superadmin@kairo.in',
      'Global Super Admin',
      'super_admin',
      'active',
      null,
      'Platform Administration'
    )
    on conflict (id) do update set
      email = excluded.email,
      role = 'super_admin',
      status = 'active',
      school_id = null;
  end if;
end $$;

-- Verify index on profiles(email) for fast lookup and unicity
create index if not exists idx_profiles_email on public.profiles(lower(email));

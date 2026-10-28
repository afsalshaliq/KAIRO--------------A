-- KAIRO — Multi-tenant schema extensions
-- Provides complete tenant isolation for schools, school domains, RBAC permissions,
-- timetables, announcements, requests, notifications, AI configurations, and biometric auth.

-- ---------------------------------------------------------------------------
-- schools & school_domains
-- ---------------------------------------------------------------------------
create table if not exists schools (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  domain          text unique,
  is_active       boolean not null default true,
  logo_url        text,
  primary_color   text not null default '#4f46e5',
  secondary_color text not null default '#06b6d4',
  settings        jsonb not null default '{"ai_enabled": true, "face_auth_enabled": true, "teacher_admin_enabled": true}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists school_domains (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  hostname   text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Add school_id & extended profile fields to profiles
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists school_id uuid references schools(id) on delete set null;
alter table profiles add column if not exists phone text not null default '';
alter table profiles add column if not exists address text not null default '';
alter table profiles add column if not exists avatar_url text not null default '';
alter table profiles add column if not exists degree text not null default '';
alter table profiles add column if not exists degree_certificate_url text not null default '';
alter table profiles add column if not exists department text not null default 'General';
alter table profiles add column if not exists joining_date date not null default current_date;

create index if not exists idx_profiles_school on profiles(school_id);

-- ---------------------------------------------------------------------------
-- Add school_id to core educational tables
-- ---------------------------------------------------------------------------
alter table classes add column if not exists school_id uuid references schools(id) on delete cascade;
create index if not exists idx_classes_school on classes(school_id);
-- In multi-tenant, distinct schools can each have Grade 1-5 in the same academic year
alter table classes drop constraint if exists classes_grade_academic_year_key;
do $$ begin
  alter table classes add constraint classes_school_grade_year_key unique (school_id, grade, academic_year);
exception when others then null; end $$;

alter table curriculum_materials add column if not exists school_id uuid references schools(id) on delete cascade;
create index if not exists idx_materials_school on curriculum_materials(school_id);

alter table teacher_assignments add column if not exists school_id uuid references schools(id) on delete cascade;
create index if not exists idx_assignments_school on teacher_assignments(school_id);

alter table chat_sessions add column if not exists school_id uuid references schools(id) on delete cascade;
alter table activities add column if not exists school_id uuid references schools(id) on delete cascade;
alter table worksheets add column if not exists school_id uuid references schools(id) on delete cascade;
alter table quizzes add column if not exists school_id uuid references schools(id) on delete cascade;
alter table generation_history add column if not exists school_id uuid references schools(id) on delete cascade;
alter table invitations add column if not exists school_id uuid references schools(id) on delete cascade;
alter table audit_logs add column if not exists school_id uuid references schools(id) on delete set null;

create index if not exists idx_audit_school on audit_logs(school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Granular permissions & teacher admin permissions
-- ---------------------------------------------------------------------------
create table if not exists permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text not null default '',
  category    text not null,
  created_at  timestamptz not null default now()
);

create table if not exists teacher_admin_permissions (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  teacher_id      uuid not null references profiles(id) on delete cascade,
  permission_code text not null references permissions(code) on delete cascade,
  granted_by      uuid references profiles(id) on delete set null,
  granted_at      timestamptz not null default now(),
  unique (teacher_id, permission_code)
);
create index if not exists idx_tap_teacher on teacher_admin_permissions(teacher_id);
create index if not exists idx_tap_school on teacher_admin_permissions(school_id);

-- ---------------------------------------------------------------------------
-- Timetable
-- ---------------------------------------------------------------------------
create table if not exists timetables (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  class_id      uuid not null references classes(id) on delete cascade,
  section_id    uuid not null references sections(id) on delete cascade,
  subject_id    uuid not null references subjects(id) on delete cascade,
  teacher_id    uuid not null references profiles(id) on delete cascade,
  day_of_week   int not null check (day_of_week between 1 and 7),
  period_number int not null check (period_number between 1 and 10),
  start_time    text not null,
  end_time      text not null,
  room          text not null default '',
  academic_year text not null default '2025-2026',
  created_at    timestamptz not null default now(),
  unique (school_id, class_id, section_id, day_of_week, period_number)
);
create index if not exists idx_timetables_teacher on timetables(teacher_id, day_of_week);
create index if not exists idx_timetables_school on timetables(school_id);

-- ---------------------------------------------------------------------------
-- Teacher requests (Leave, Extra Period, Schedule, Teacher Admin)
-- ---------------------------------------------------------------------------
create table if not exists teacher_requests (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  teacher_id   uuid not null references profiles(id) on delete cascade,
  type         text not null check (type in ('leave', 'extra_period', 'schedule', 'teacher_admin')),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  title        text not null,
  details      jsonb not null default '{}'::jsonb,
  reviewed_by  uuid references profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_notes text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_requests_school on teacher_requests(school_id, status);
create index if not exists idx_requests_teacher on teacher_requests(teacher_id);

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists announcements (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references schools(id) on delete cascade,
  title             text not null,
  content           text not null,
  audience          text not null default 'all' check (audience in ('all', 'teacher_admins', 'department', 'specific')),
  target_department text,
  is_published      boolean not null default false,
  published_at      timestamptz,
  published_by      uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_announcements_school on announcements(school_id, is_published);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications(user_id, is_read);
create index if not exists idx_notifications_school on notifications(school_id);

-- ---------------------------------------------------------------------------
-- AI configuration & usage
-- ---------------------------------------------------------------------------
create table if not exists ai_configurations (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references schools(id) on delete cascade,
  provider             text not null default 'kairo_managed',
  model                text not null default 'claude-sonnet-3-5',
  allow_teacher_keys   boolean not null default false,
  encrypted_api_key    text,
  custom_system_prompt text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (school_id)
);

create table if not exists ai_usage (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  teacher_id  uuid not null references profiles(id) on delete cascade,
  tokens_used int not null default 0,
  feature     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ai_usage_school on ai_usage(school_id);

-- ---------------------------------------------------------------------------
-- Biometric credentials (hashed templates only, no raw biometric video/image)
-- ---------------------------------------------------------------------------
create table if not exists biometric_credentials (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  template_hash    text not null,
  consent_given    boolean not null default true,
  consent_at       timestamptz not null default now(),
  is_active        boolean not null default true,
  last_verified_at timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id)
);
create index if not exists idx_biometrics_school on biometric_credentials(school_id);

-- ---------------------------------------------------------------------------
-- Trigger: updated_at for new tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['schools','teacher_requests','announcements','ai_configurations']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s
                    for each row execute function set_updated_at()', t);
  end loop;
end $$;

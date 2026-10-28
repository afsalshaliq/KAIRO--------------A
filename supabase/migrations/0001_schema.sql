-- KAIRO — Core schema for Royal School CBSE, Classes 1-5
-- Normalized schema. Identity references Supabase Auth user ids (auth.users).
-- No secrets in migrations. RLS policies live in 0002_rls.sql.

-- pgcrypto is available on Supabase; tolerate its absence elsewhere
-- (gen_random_uuid() is core Postgres since v13).
do $$ begin
  create extension if not exists "pgcrypto";
exception when others then null; end $$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'teacher');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('active', 'suspended', 'deactivated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type material_status as enum ('uploaded', 'processing', 'ready', 'failed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('queued', 'processing', 'done', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type resource_type as enum ('explanation', 'summary', 'lesson_plan', 'activity', 'worksheet', 'quiz');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user. Role is server-controlled.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  role        user_role not null default 'teacher',
  status      account_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- classes — restricted to grades 1..5 by CHECK constraint (trusted, not UI).
-- ---------------------------------------------------------------------------
create table if not exists classes (
  id           uuid primary key default gen_random_uuid(),
  grade        int not null check (grade between 1 and 5),
  academic_year text not null,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (grade, academic_year)
);

create table if not exists sections (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 8),
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (class_id, name)
);

create table if not exists subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- teacher_assignments — controls access to materials & AI features.
-- ---------------------------------------------------------------------------
create table if not exists teacher_assignments (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles(id) on delete cascade,
  class_id    uuid not null references classes(id) on delete cascade,
  section_id  uuid not null references sections(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  is_revoked  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (teacher_id, section_id, subject_id)
);
create index if not exists idx_assignments_teacher on teacher_assignments(teacher_id) where is_revoked = false;

-- ---------------------------------------------------------------------------
-- curriculum_materials — uploaded docs. file_path points to private storage.
-- ---------------------------------------------------------------------------
create table if not exists curriculum_materials (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  class_id      uuid not null references classes(id) on delete restrict,
  section_id    uuid references sections(id) on delete set null,
  subject_id    uuid not null references subjects(id) on delete restrict,
  chapter       text not null default '',
  academic_year text not null,
  file_path     text not null,            -- private storage object path
  mime_type     text not null,
  byte_size     bigint not null check (byte_size >= 0),
  status        material_status not null default 'uploaded',
  is_published  boolean not null default false,
  uploaded_by   uuid not null references profiles(id) on delete restrict,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_materials_subject_class on curriculum_materials(class_id, subject_id);
-- A material is only visible to teachers when ready AND published (enforced in RLS).

create table if not exists material_chunks (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references curriculum_materials(id) on delete cascade,
  chunk_index int not null,
  content     text not null,
  page_ref    int,
  embedding   jsonb,  -- vector stored as jsonb when pgvector unavailable
  created_at  timestamptz not null default now(),
  unique (material_id, chunk_index)
);
create index if not exists idx_chunks_material on material_chunks(material_id);

create table if not exists document_processing_jobs (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references curriculum_materials(id) on delete cascade,
  status      job_status not null default 'queued',
  attempts    int not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI conversations
-- ---------------------------------------------------------------------------
create table if not exists chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles(id) on delete cascade,
  material_id uuid references curriculum_materials(id) on delete set null,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now()
);
create index if not exists idx_sessions_teacher on chat_sessions(teacher_id);

create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  teacher_id  uuid not null references profiles(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  citations   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_messages_session on chat_messages(session_id);

-- ---------------------------------------------------------------------------
-- Generated resources
-- ---------------------------------------------------------------------------
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles(id) on delete cascade,
  material_id uuid references curriculum_materials(id) on delete set null,
  title       text not null,
  grade       int not null check (grade between 1 and 5),
  subject     text not null,
  topic       text not null default '',
  payload     jsonb not null,   -- validated against activity schema before insert
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_activities_teacher on activities(teacher_id);

create table if not exists worksheets (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles(id) on delete cascade,
  material_id uuid references curriculum_materials(id) on delete set null,
  title       text not null,
  grade       int not null check (grade between 1 and 5),
  subject     text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_worksheets_teacher on worksheets(teacher_id);

create table if not exists quizzes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles(id) on delete cascade,
  material_id uuid references curriculum_materials(id) on delete set null,
  title       text not null,
  grade       int not null check (grade between 1 and 5),
  subject     text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_quizzes_teacher on quizzes(teacher_id);

-- Unified history view of everything a teacher has generated.
create table if not exists generation_history (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references profiles(id) on delete cascade,
  resource_type resource_type not null,
  resource_id   uuid,              -- points at activities/worksheets/quizzes when applicable
  material_id   uuid references curriculum_materials(id) on delete set null,
  title         text not null,
  summary       text not null default '',
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_history_teacher on generation_history(teacher_id, created_at desc);

-- ---------------------------------------------------------------------------
-- audit_logs — append-only; writable only by security-definer functions / service role.
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles(id) on delete set null,
  action     text not null,
  target     text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on audit_logs(created_at desc);

create table if not exists invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  full_name   text not null default '',
  role        user_role not null default 'teacher',
  token_hash  text not null,          -- hash of invite token; raw token never stored
  accepted_at timestamptz,
  expires_at  timestamptz not null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_invitations_email on invitations(lower(email));

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','curriculum_materials','document_processing_jobs',
                           'activities','worksheets','quizzes','generation_history']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s
                    for each row execute function set_updated_at()', t);
  end loop;
end $$;

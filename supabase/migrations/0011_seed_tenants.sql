-- KAIRO — Seed tenants, domains, and RBAC permissions

-- ---------------------------------------------------------------------------
-- Seed RBAC permissions
-- ---------------------------------------------------------------------------
insert into permissions (code, name, description, category) values
  ('school.teacher.view', 'View Teachers', 'View teacher profiles within the school', 'Teachers'),
  ('school.teacher.create', 'Create Teachers', 'Add new teachers to the school roster', 'Teachers'),
  ('school.teacher.update', 'Update Teachers', 'Edit teacher details and assignments', 'Teachers'),
  ('school.teacher.delete', 'Delete Teachers', 'Deactivate or remove teacher accounts', 'Teachers'),
  ('school.teacher_admin.view', 'View Teacher Admins', 'View teacher admin list and privileges', 'Administration'),
  ('school.teacher_admin.manage', 'Manage Teacher Admins', 'Grant or revoke teacher administrative permissions', 'Administration'),
  ('school.class.view', 'View Classes', 'Inspect class sections and enrolled courses', 'Academics'),
  ('school.class.manage', 'Manage Classes', 'Create and modify classes and sections', 'Academics'),
  ('school.timetable.view', 'View Timetable', 'View school-wide timetable and schedules', 'Timetable'),
  ('school.timetable.manage', 'Manage Timetable', 'Create, update, and reassign timetable periods', 'Timetable'),
  ('school.material.view', 'View Materials', 'View teacher learning materials', 'Learning'),
  ('school.material.upload', 'Upload Materials', 'Upload curriculum and teacher learning materials', 'Learning'),
  ('school.material.delete', 'Delete Materials', 'Archive or delete learning materials', 'Learning'),
  ('school.announcement.create', 'Create Announcements', 'Draft school announcements', 'Communication'),
  ('school.announcement.publish', 'Publish Announcements', 'Publish official announcements to teachers', 'Communication'),
  ('school.request.create', 'Create Requests', 'Submit leave, extra period, and schedule requests', 'Requests'),
  ('school.request.review', 'Review Requests', 'Approve or reject teacher requests', 'Requests'),
  ('school.audit.view', 'View Audit Logs', 'Inspect school-level audit event trail', 'Audit')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category;

-- ---------------------------------------------------------------------------
-- Seed primary tenants (Royal School and Oxford School)
-- ---------------------------------------------------------------------------
insert into schools (id, name, slug, domain, is_active, primary_color, secondary_color, settings)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Royal School',
    'royal',
    'royal.kairo.com',
    true,
    '#4f46e5',
    '#06b6d4',
    '{"ai_enabled": true, "face_auth_enabled": true, "teacher_admin_enabled": true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Oxford School',
    'oxford',
    'oxford.kairo.com',
    true,
    '#0284c7',
    '#10b981',
    '{"ai_enabled": true, "face_auth_enabled": false, "teacher_admin_enabled": true}'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  domain = excluded.domain;

-- ---------------------------------------------------------------------------
-- Seed school domains
-- ---------------------------------------------------------------------------
insert into school_domains (school_id, hostname, is_primary) values
  ('00000000-0000-0000-0000-000000000001', 'royal.kairo.com', true),
  ('00000000-0000-0000-0000-000000000001', 'royal.localhost', false),
  ('00000000-0000-0000-0000-000000000002', 'oxford.kairo.com', true),
  ('00000000-0000-0000-0000-000000000002', 'oxford.localhost', false)
on conflict (hostname) do nothing;

-- ---------------------------------------------------------------------------
-- Default AI Configurations
-- ---------------------------------------------------------------------------
insert into ai_configurations (school_id, provider, model, allow_teacher_keys, custom_system_prompt)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'kairo_managed',
    'claude-sonnet-3-5',
    true,
    'You are Kairo AI Pedagogical Assistant for Royal School teachers. Focus exclusively on pedagogy, lesson plans, teaching strategies, and curriculum explanations.'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'kairo_managed',
    'claude-sonnet-3-5',
    false,
    'You are Kairo AI Pedagogical Assistant for Oxford School teachers.'
  )
on conflict (school_id) do nothing;

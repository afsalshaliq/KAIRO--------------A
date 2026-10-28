-- KAIRO — reference seed data (safe, non-secret). Idempotent.
-- NOTE: contains NO administrator account and NO credentials.
-- Provision the first admin via scripts/provision-first-admin.mjs.

insert into subjects (name) values
  ('English'), ('Mathematics'), ('Science'),
  ('Social Studies'), ('Hindi'), ('General Knowledge')
on conflict (name) do nothing;

-- Classes 1..5 for the current academic year.
insert into classes (grade, academic_year)
select g, '2025-2026' from generate_series(1,5) as g
on conflict (grade, academic_year) do nothing;

-- Section A for each class.
insert into sections (class_id, name)
select c.id, 'A' from classes c where c.academic_year = '2025-2026'
on conflict (class_id, name) do nothing;

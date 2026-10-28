-- KAIRO — add the super_admin role value.
-- MUST be its own migration: Postgres forbids using a newly added enum value in
-- the same transaction that adds it, so the policy/trigger changes that
-- reference 'super_admin' live in 0006 (a separate transaction).
alter type user_role add value if not exists 'super_admin';

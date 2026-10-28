-- KAIRO — Add principal and teacher_admin roles to user_role enum
-- Separate migration so new enum values commit before being referenced in functions/policies.

alter type user_role add value if not exists 'principal';
alter type user_role add value if not exists 'teacher_admin';

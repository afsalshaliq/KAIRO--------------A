-- KAIRO — object-level authorization hardening (IDOR / BOLA).
--
-- Every per-teacher table already restricts rows to `teacher_id = auth.uid()`,
-- so one teacher can never READ another's data. However, the WITH CHECK clauses
-- validated only the OWNER of the new row, never the objects it REFERENCES. A
-- teacher could therefore:
--   * save an activity / worksheet / quiz / history row pointing at a material
--     outside their assignment scope, or
--   * write a chat message into another teacher's session (session_id was not
--     checked), or bind a chat session to an out-of-scope material.
-- These are broken object-level authorization (IDOR) — a teacher referencing
-- objects they have no legitimate relationship to. This migration closes them.
-- The legitimate write paths (ai-generate / process-document) run with the
-- service role and bypass RLS, so this only constrains direct client writes.

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER, pinned search_path).
-- ---------------------------------------------------------------------------

-- May the current teacher reference this material in their own content?
-- The boundary is the LIVE ASSIGNMENT only — deliberately NOT ready+published
-- (unlike teacher_can_access_material), so a later publish/unpublish toggle
-- never breaks a legitimate save of content generated moments earlier.
create or replace function teacher_assigned_to_material(p_material uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from curriculum_materials m
    join teacher_assignments a
      on a.subject_id = m.subject_id
     and a.class_id = m.class_id
     and (m.section_id is null or a.section_id = m.section_id)
    where m.id = p_material
      and a.teacher_id = auth.uid()
      and a.is_revoked = false
      and is_active_teacher()
  );
$$;

-- Does the current teacher own this chat session?
create or replace function teacher_owns_session(p_session uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from chat_sessions s
    where s.id = p_session and s.teacher_id = auth.uid()
  );
$$;

revoke all on function teacher_assigned_to_material(uuid), teacher_owns_session(uuid) from public;
grant execute on function teacher_assigned_to_material(uuid), teacher_owns_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- chat_sessions — owner-only, and a referenced material must be in scope.
-- ---------------------------------------------------------------------------
drop policy if exists sessions_owner on chat_sessions;
create policy sessions_owner on chat_sessions for all to authenticated
  using (teacher_id = auth.uid())
  with check (
    teacher_id = auth.uid() and is_active_teacher()
    and (material_id is null or teacher_assigned_to_material(material_id))
  );

-- ---------------------------------------------------------------------------
-- chat_messages — owner-only, and the message's session must belong to the
-- caller (closes cross-session message injection).
-- ---------------------------------------------------------------------------
drop policy if exists messages_owner on chat_messages;
create policy messages_owner on chat_messages for all to authenticated
  using (teacher_id = auth.uid())
  with check (
    teacher_id = auth.uid() and is_active_teacher()
    and teacher_owns_session(session_id)
  );

-- ---------------------------------------------------------------------------
-- activities / worksheets / quizzes / generation_history — owner-only, and a
-- referenced material must be within the teacher's assignment scope.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['activities','worksheets','quizzes','generation_history'] loop
    execute format('drop policy if exists %1$s_owner on %1$s', t);
    execute format('create policy %1$s_owner on %1$s for all to authenticated
                    using (teacher_id = auth.uid())
                    with check (
                      teacher_id = auth.uid() and is_active_teacher()
                      and (material_id is null or teacher_assigned_to_material(material_id))
                    )', t);
  end loop;
end $$;

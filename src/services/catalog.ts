import { requireSupabase } from "@/lib/supabase";
import type { ClassRow, Section, Subject, Assignment, Profile } from "@/types/db";

export async function listClasses(): Promise<ClassRow[]> {
  const { data, error } = await requireSupabase()
    .from("classes").select("*").order("grade");
  if (error) throw error;
  return data as ClassRow[];
}

export async function listSections(classId?: string): Promise<Section[]> {
  let q = requireSupabase().from("sections").select("*").order("name");
  if (classId) q = q.eq("class_id", classId);
  const { data, error } = await q;
  if (error) throw error;
  return data as Section[];
}

export async function listSubjects(): Promise<Subject[]> {
  const { data, error } = await requireSupabase().from("subjects").select("*").order("name");
  if (error) throw error;
  return data as Subject[];
}

export async function createClass(grade: number, academicYear: string): Promise<ClassRow> {
  const { data, error } = await requireSupabase()
    .from("classes").insert({ grade, academic_year: academicYear }).select().single();
  if (error) throw error;
  return data as ClassRow;
}

export async function createSection(classId: string, name: string): Promise<Section> {
  const { data, error } = await requireSupabase()
    .from("sections").insert({ class_id: classId, name }).select().single();
  if (error) throw error;
  return data as Section;
}

export async function setClassArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await requireSupabase().from("classes").update({ is_archived: archived }).eq("id", id);
  if (error) throw error;
}

// ---- assignments ----------------------------------------------------------
export async function listAssignments(): Promise<Assignment[]> {
  const { data, error } = await requireSupabase()
    .from("teacher_assignments").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Assignment[];
}

export async function createAssignment(a: {
  teacherId: string; classId: string; sectionId: string; subjectId: string;
}): Promise<Assignment> {
  const { data, error } = await requireSupabase().from("teacher_assignments")
    .insert({ teacher_id: a.teacherId, class_id: a.classId, section_id: a.sectionId, subject_id: a.subjectId })
    .select().single();
  if (error) throw error;
  return data as Assignment;
}

export async function setAssignmentRevoked(id: string, revoked: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from("teacher_assignments").update({ is_revoked: revoked }).eq("id", id);
  if (error) throw error;
}

export async function listTeachers(): Promise<Profile[]> {
  const { data, error } = await requireSupabase()
    .from("profiles").select("*").eq("role", "teacher").order("full_name");
  if (error) throw error;
  return data as Profile[];
}

/** Administrators (principals + super admins). Readable by admins via RLS. */
export async function listAdmins(): Promise<Profile[]> {
  const { data, error } = await requireSupabase()
    .from("profiles").select("*").in("role", ["super_admin", "admin"]).order("full_name");
  if (error) throw error;
  return data as Profile[];
}

/** Assignments visible to the signed-in teacher (RLS restricts to their own). */
export async function myAssignments(): Promise<Assignment[]> {
  const { data, error } = await requireSupabase()
    .from("teacher_assignments").select("*").eq("is_revoked", false);
  if (error) throw error;
  return data as Assignment[];
}

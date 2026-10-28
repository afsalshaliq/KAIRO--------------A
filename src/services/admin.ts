import { requireSupabase } from "@/lib/supabase";
import type { AuditLog, Role, Profile } from "@/types/db";
import { getRetentionCutoffDate } from "./audit";

/**
 * Admin-only server operations go through the `admin` Edge Function, which runs
 * with the service role and re-verifies the caller is an admin. The browser
 * never holds the service-role key.
 */
async function invokeAdmin<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke("admin", { body: { action, ...payload } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const inviteTeacher = (
  email: string,
  fullName: string,
  opts?: { schoolId?: string; password?: string; department?: string }
) =>
  invokeAdmin<{ ok: true; invited: string }>("invite_teacher", { email, fullName, ...opts });

export const resendInvite = (email: string) =>
  invokeAdmin<{ ok: true }>("resend_invite", { email });

export const setTeacherStatus = (
  teacherId: string,
  status: "active" | "suspended" | "deactivated",
) => invokeAdmin<{ ok: true }>("set_status", { teacherId, status });

export const sendPasswordRecovery = (email: string) =>
  invokeAdmin<{ ok: true }>("password_recovery", { email });

// ---- super-admin only: manage administrators ------------------------------
export const inviteAdmin = (email: string, fullName: string) =>
  invokeAdmin<{ ok: true; invited: string }>("invite_admin", { email, fullName });

/** Change any account's status (super admin may target admins too). */
export const setUserStatus = (
  userId: string,
  status: "active" | "suspended" | "deactivated",
) => invokeAdmin<{ ok: true }>("set_status", { userId, status });

/** Promote/demote an account. Super admin only. */
export const setUserRole = (
  userId: string,
  role: Role,
) => invokeAdmin<{ ok: true }>("set_role", { userId, role });

/** Update permitted user attributes with audit logging */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "phone" | "address" | "department" | "school_id">>
): Promise<Profile> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { data: user } = await sb.auth.getUser();
  if (user?.user?.id) {
    try {
      await sb.from("audit_logs").insert({
        actor_id: user.user.id,
        action: "user.update",
        target: userId,
        school_id: data.school_id || user.user.user_metadata?.school_id || null,
        meta: { updated_fields: Object.keys(updates) },
      });
    } catch {
      // audit logging is non-blocking
    }
  }

  return data as Profile;
}

/** Create/Provision user across tenants securely via the admin Edge Function. */
export async function createGlobalUser(payload: {
  email: string;
  fullName: string;
  role: Role;
  schoolId: string | null;
  department?: string;
  phone?: string;
  password?: string;
}): Promise<Profile> {
  const email = payload.email.trim().toLowerCase();
  const fullName = payload.fullName.trim();

  // If in dev preview mode (VITE_DEV_AUTH=1) without backend, return mock profile
  if (import.meta.env.VITE_DEV_AUTH === "1") {
    return {
      id: `dev-${payload.role}-${Date.now()}`,
      email,
      full_name: fullName,
      role: payload.role,
      status: "active",
      school_id: payload.role === "super_admin" ? null : payload.schoolId,
      phone: payload.phone || "",
      address: "",
      avatar_url: "",
      degree: "",
      degree_certificate_url: "",
      department: payload.department || "General",
      joining_date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Secure server-side provisioning via Edge Function running with service role
  const res = await invokeAdmin<{ ok: true; user: Profile }>("create_user", {
    email,
    fullName,
    role: payload.role,
    schoolId: payload.role === "super_admin" ? null : payload.schoolId,
    department: payload.department || "General",
    phone: payload.phone || "",
    password: payload.password,
  });

  return res.user;
}

export async function listAudit(limit = 50, schoolId?: string | null): Promise<AuditLog[]> {
  const sb = requireSupabase();
  const retentionCutoff = getRetentionCutoffDate();
  let query = sb
    .from("audit_logs")
    .select(`
      *,
      profiles:actor_id (full_name, role)
    `)
    .gte("created_at", retentionCutoff)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (schoolId) {
    query = query.eq("school_id", schoolId);
  }

  const { data, error } = await query;
  if (error) {
    let fallback = sb
      .from("audit_logs")
      .select("*")
      .gte("created_at", retentionCutoff)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (schoolId) {
      fallback = fallback.eq("school_id", schoolId);
    }

    const { data: fbData, error: fbErr } = await fallback;
    if (fbErr) throw fbErr;
    return (fbData || []) as AuditLog[];
  }

  return (data || []).map((r: any) => ({
    ...r,
    actor_name: r.profiles?.full_name || r.actor_name || "System",
    actor_role: r.profiles?.role || r.actor_role || "SYSTEM",
  })) as AuditLog[];
}

export interface AdminMetrics {
  teachers: number; active: number; suspended: number;
  classes: number; sections: number; assignments: number;
  materialsPublished: number; processing: number;
  activities: number; worksheets: number; quizzes: number;
}

/** Real DB-backed dashboard counts (no hardcoded metrics). */
export async function adminMetrics(schoolId?: string | null): Promise<AdminMetrics> {
  const sb = requireSupabase();
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (schoolId && ["profiles", "classes", "curriculum_materials", "activities", "worksheets", "quizzes"].includes(table)) {
      q = q.eq("school_id", schoolId);
    }
    if (filter) q = filter(q);
    const { count: c, error } = await q;
    if (error) throw error;
    return c ?? 0;
  };
  const [teachers, active, suspended, classes, sections, assignments, materialsPublished, processing, activities, worksheets, quizzes] =
    await Promise.all([
      count("profiles", (q) => q.eq("role", "teacher")),
      count("profiles", (q) => q.eq("role", "teacher").eq("status", "active")),
      count("profiles", (q) => q.eq("role", "teacher").eq("status", "suspended")),
      count("classes"),
      count("sections"),
      count("teacher_assignments", (q) => q.eq("is_revoked", false)),
      count("curriculum_materials", (q) => q.eq("is_published", true)),
      count("curriculum_materials", (q) => q.eq("status", "processing")),
      count("activities"),
      count("worksheets"),
      count("quizzes"),
    ]);
  return { teachers, active, suspended, classes, sections, assignments, materialsPublished, processing, activities, worksheets, quizzes };
}

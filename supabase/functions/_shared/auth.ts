// Server-side auth helpers. These run with the SERVICE ROLE key, which is only
// ever present in the Edge Function runtime — never shipped to the browser.
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type Role = "super_admin" | "admin" | "principal" | "teacher_admin" | "teacher";
export type Status = "active" | "suspended" | "deactivated";

export interface Caller {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: Status;
  school_id: string | null;
}

/** A client that bypasses RLS. Guard every use with explicit authorization checks. */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "Supabase server environment is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Resolve the authenticated caller from the request's bearer token and load
 * their *server-side* profile. Role and status come from the DB, never from
 * anything the client sent — client-side role claims are not trusted.
 */
export async function getCaller(
  req: Request,
  svc: SupabaseClient,
): Promise<Caller | null> {
  const authz = req.headers.get("Authorization") ?? "";
  const token = authz.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: userData, error } = await svc.auth.getUser(token);
  if (error || !userData?.user) return null;

  const { data: profile } = await svc
    .from("profiles")
    .select("id,email,full_name,role,status,school_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile) return null;
  return profile as Caller;
}

export async function requireAdmin(
  req: Request,
  svc: SupabaseClient,
): Promise<Caller> {
  const caller = await getCaller(req, svc);
  if (!caller) throw new HttpError(401, "Not authenticated.");
  // A super_admin or principal/admin passes here.
  const isPrivilegedAdmin =
    caller.role === "admin" ||
    caller.role === "principal" ||
    caller.role === "super_admin";
  if (!isPrivilegedAdmin || caller.status !== "active") {
    throw new HttpError(403, "Administrator access required.");
  }
  return caller;
}

/** Elevated: only an active super_admin may manage other administrators. */
export async function requireSuperAdmin(
  req: Request,
  svc: SupabaseClient,
): Promise<Caller> {
  const caller = await getCaller(req, svc);
  if (!caller) throw new HttpError(401, "Not authenticated.");
  if (caller.role !== "super_admin" || caller.status !== "active") {
    throw new HttpError(403, "Super administrator access required.");
  }
  return caller;
}

export async function requireActiveTeacher(
  req: Request,
  svc: SupabaseClient,
): Promise<Caller> {
  const caller = await getCaller(req, svc);
  if (!caller) throw new HttpError(401, "Not authenticated.");
  if (caller.role !== "teacher" || caller.status !== "active") {
    throw new HttpError(403, "Active teacher access required.");
  }
  return caller;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Append-only audit entry. Service role bypasses RLS; audit_logs has no write policy. */
export async function audit(
  svc: SupabaseClient,
  actorId: string | null,
  action: string,
  target: string | null,
  meta: Record<string, unknown> = {},
  schoolId?: string | null,
): Promise<void> {
  const finalSchoolId = schoolId || (meta?.school_id as string | undefined) || null;
  await svc.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target,
    meta,
    school_id: finalSchoolId,
  });
}

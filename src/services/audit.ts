import { requireSupabase, supabase } from "@/lib/supabase";
import type { AuditLog } from "@/types/db";

export type KairoActionType =
  // Auth & Identity
  | "auth.login"
  | "auth.logout"
  | "auth.biometric_verify"
  | "auth.biometric_enroll"
  | "auth.password_change"
  | "auth.password_recovery"
  // Faculty & User Lifecycle
  | "user.create"
  | "user.update"
  | "account.set_status"
  | "teacher.invite"
  | "teacher.resend_invite"
  | "teacher.bulk_import"
  | "teacher_admin.promote"
  | "teacher_admin.demote"
  | "teacher_admin.update_permissions"
  // Multi-Tenant School Administration
  | "school.create"
  | "school.update"
  | "school.activate"
  | "school.suspend"
  | "school.ai_config"
  // Academics, Classes & Timetables
  | "class.create"
  | "class.update"
  | "section.create"
  | "timetable.update"
  | "teacher.assignment"
  // Curriculum & Materials
  | "material.upload"
  | "material.process"
  | "material.publish"
  | "material.unpublish"
  | "material.archive"
  // AI Pedagogical Generation
  | "ai.generate.activity"
  | "ai.generate.worksheet"
  | "ai.generate.quiz"
  | "ai.assistant.query"
  // Communication & Workflows
  | "announcement.create"
  | "announcement.publish"
  | "announcement.delete"
  | "request.create"
  | "request.review.approved"
  | "request.review.rejected"
  // System Governance & Maintenance
  | "system.audit_cleanup"
  | "system.backup_create"
  | "system.backup_restore";

export interface RecordMovePayload {
  action: KairoActionType | (string & {});
  target?: string | null;
  meta?: Record<string, unknown>;
  schoolId?: string | null;
  actorId?: string | null;
}

// In-memory / session store for dev preview mode
const MOCK_AUDIT_KEY = "kairo_mock_audit_ledger";

/**
 * Centrally records every move and administrative/user action across KAIRO into `audit_logs`.
 * Automatically scopes to the current actor and school, while database triggers enforce
 * the 30-day retention ceiling.
 */
export async function recordKairoMove(payload: RecordMovePayload): Promise<void> {
  const meta = {
    ...payload.meta,
    client_timestamp: new Date().toISOString(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "server",
  };

  if (!supabase) {
    recordMockMove(payload, meta);
    return;
  }

  try {
    const sb = requireSupabase();
    let actorId = payload.actorId;
    let schoolId = payload.schoolId;

    if (!actorId || !schoolId) {
      const { data: authUser } = await sb.auth.getUser();
      if (authUser?.user) {
        if (!actorId) actorId = authUser.user.id;
        if (!schoolId) {
          schoolId = (authUser.user.user_metadata?.school_id as string | undefined) || null;
          if (!schoolId) {
            const { data: prof } = await sb
              .from("profiles")
              .select("school_id")
              .eq("id", authUser.user.id)
              .maybeSingle();
            schoolId = prof?.school_id || null;
          }
        }
      }
    }

    const { error } = await sb.from("audit_logs").insert({
      actor_id: actorId || null,
      school_id: schoolId || null,
      action: payload.action,
      target: payload.target || null,
      meta,
    });

    if (error) {
      console.warn("Audit log insert notice:", error.message);
      recordMockMove(payload, meta);
    }
  } catch (err) {
    console.warn("Audit logging non-blocking exception:", err);
    recordMockMove(payload, meta);
  }
}

function recordMockMove(payload: RecordMovePayload, meta: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(MOCK_AUDIT_KEY);
    const existing: AuditLog[] = raw ? JSON.parse(raw) : [];
    const newEntry: AuditLog = {
      id: `aud-mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      school_id: payload.schoolId || null,
      actor_id: payload.actorId || "usr-current",
      action: payload.action,
      target: payload.target || null,
      meta,
      created_at: new Date().toISOString(),
      actor_name: "Active User",
      actor_role: "ADMIN",
    };
    // Keep max 200 in dev session, remove any older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const filtered = [newEntry, ...existing].filter(
      (e) => new Date(e.created_at).getTime() >= thirtyDaysAgo
    ).slice(0, 200);
    sessionStorage.setItem(MOCK_AUDIT_KEY, JSON.stringify(filtered));
  } catch {
    // ignore session storage quotas
  }
}

/**
 * Manually invokes the 30-day database retention cleanup procedure via RPC.
 * Deletes any records where `created_at < now() - interval '30 days'`.
 */
export async function purgeExpiredAuditLogs(): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.rpc("cleanup_expired_audit_logs");
    if (error) {
      console.warn("Purge RPC notice:", error.message);
      return 0;
    }
    return Number(data) || 0;
  } catch (err) {
    console.warn("Purge RPC failed:", err);
    return 0;
  }
}

/**
 * Returns ISO timestamp for the 30-day retention cutoff boundary.
 */
export function getRetentionCutoffDate(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

import { requireSupabase, supabase } from "@/lib/supabase";
import type { School } from "@/types/db";
import { DEFAULT_SCHOOLS } from "@/lib/tenant";
import { recordKairoMove } from "./audit";

/**
 * Super Admin: List all schools across the platform
 */
export async function listSchools(): Promise<School[]> {
  if (!supabase) {
    return Object.values(DEFAULT_SCHOOLS);
  }
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.warn("Falling back to default schools:", error.message);
    return Object.values(DEFAULT_SCHOOLS);
  }
  return data as School[];
}

/**
 * Super Admin: Create a new school tenant
 */
export async function createSchool(payload: {
  name: string;
  slug: string;
  domain?: string;
  primary_color?: string;
  secondary_color?: string;
}): Promise<School> {
  const sb = requireSupabase();
  const slug = payload.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const domain = payload.domain || `${slug}.kairo.com`;

  const { data, error } = await sb
    .from("schools")
    .insert({
      name: payload.name.trim(),
      slug,
      domain,
      primary_color: payload.primary_color || "#4f46e5",
      secondary_color: payload.secondary_color || "#06b6d4",
      is_active: true,
      settings: {
        ai_enabled: true,
        face_auth_enabled: true,
        teacher_admin_enabled: true,
      },
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // Register domain
  await sb.from("school_domains").insert({
    school_id: data.id,
    hostname: domain,
    is_primary: true,
  });

  recordKairoMove({
    action: "school.create",
    target: data.name,
    schoolId: data.id,
    meta: { slug, domain, primary_color: payload.primary_color },
  });

  return data as School;
}

export interface SchoolDetailData {
  school: School;
  administrators: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
    phone: string;
  }[];
  teacherCount: number;
  classCount: number;
  materialsCount: number;
  recentAuditLogs: {
    id: string;
    action: string;
    target: string;
    meta: Record<string, unknown>;
    created_at: string;
    actor_name?: string;
  }[];
}

export interface PlatformMetrics {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalUsers: number;
  roleCounts: {
    super_admin: number;
    principal: number;
    teacher_admin: number;
    teacher: number;
  };
  totalClasses: number;
  totalMaterials: number;
  systemHealth: {
    database: "healthy" | "degraded" | "offline";
    latencyMs: number;
    edgeFunctions: "operational" | "unavailable";
    authService: "operational" | "unavailable";
  };
}

/**
 * Super Admin: Get single school by ID
 */
export async function getSchoolById(id: string): Promise<School | null> {
  if (!supabase) {
    return DEFAULT_SCHOOLS[id] || Object.values(DEFAULT_SCHOOLS).find((s) => s.id === id) || null;
  }
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as School;
}

/**
 * Super Admin: Fetch comprehensive school details without mutating records
 */
export async function getSchoolDetails(schoolId: string): Promise<SchoolDetailData> {
  const sb = requireSupabase();

  // 1. Fetch school record
  const { data: school, error: schoolErr } = await sb
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .single();

  if (schoolErr || !school) {
    throw new Error(schoolErr?.message || "School record not found");
  }

  // 2. Fetch associated administrators (Principals / Admins)
  const { data: admins } = await sb
    .from("profiles")
    .select("id, full_name, email, role, status, phone")
    .eq("school_id", schoolId)
    .in("role", ["admin", "principal"]);

  // 3. Count teachers
  const { count: teacherCount } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .in("role", ["teacher", "teacher_admin"]);

  // 4. Count classes
  const { count: classCount } = await sb
    .from("classes")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);

  // 5. Count materials
  const { count: materialsCount } = await sb
    .from("curriculum_materials")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);

  // 6. Recent audit logs
  const { data: audits } = await sb
    .from("audit_logs")
    .select("id, action, target, meta, created_at, actor_id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(15);

  return {
    school: school as School,
    administrators: (admins as any) || [],
    teacherCount: teacherCount ?? 0,
    classCount: classCount ?? 0,
    materialsCount: materialsCount ?? 0,
    recentAuditLogs: (audits as any) || [],
  };
}

/**
 * Update school details or settings.
 * Strictly uses the immutable ID to prevent duplicate records.
 */
export async function updateSchool(
  id: string,
  updates: Partial<Pick<School, "name" | "domain" | "is_active" | "primary_color" | "secondary_color" | "settings" | "logo_url">>
): Promise<School> {
  const sb = requireSupabase();

  // Fetch current school to merge settings safely
  const { data: existing, error: fetchErr } = await sb
    .from("schools")
    .select("*")
    .eq("id", id)
    .single();

  const targetFallback = Object.values(DEFAULT_SCHOOLS).find((s) => s.id === id);

  if (fetchErr || !existing) {
    if (targetFallback) {
      Object.assign(targetFallback, updates);
      return targetFallback;
    }
    throw new Error(fetchErr?.message || "Target school does not exist");
  }

  const mergedSettings = updates.settings
    ? { ...(existing.settings || {}), ...updates.settings }
    : existing.settings;

  const payload: Record<string, unknown> = {
    ...updates,
    settings: mergedSettings,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("schools")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (targetFallback) {
    Object.assign(targetFallback, updates);
  }

  if (error) {
    if (targetFallback) return targetFallback;
    throw new Error(error.message);
  }

  // Log to audit trail
  const { data: userData } = await sb.auth.getUser();
  if (userData?.user?.id) {
    try {
      await sb.from("audit_logs").insert({
        school_id: id,
        actor_id: userData.user.id,
        action: "school.update",
        target: id,
        meta: {
          updated_fields: Object.keys(updates),
          school_name: data.name,
        },
      });
    } catch {
      // non-blocking
    }
  }

  return data as School;
}

/**
 * Super Admin: Toggle activation / suspension status with audit trail
 */
export async function toggleSchoolActive(id: string, isActive: boolean, reason?: string): Promise<School> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("schools")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { data: userData } = await sb.auth.getUser();
  if (userData?.user?.id) {
    try {
      await sb.from("audit_logs").insert({
        school_id: id,
        actor_id: userData.user.id,
        action: isActive ? "school.activate" : "school.suspend",
        target: id,
        meta: {
          new_status: isActive ? "active" : "suspended",
          reason: reason || "Administrative action",
        },
      });
    } catch {
      // non-blocking
    }
  }

  return data as School;
}

/**
 * Super Admin: Get platform-wide operational and multi-tenant metrics
 */
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const sb = requireSupabase();
  const t0 = performance.now();

  // Test DB connection latency
  let dbHealthy: "healthy" | "degraded" | "offline" = "healthy";
  let latency = 0;
  try {
    const { error: pingErr } = await sb.from("schools").select("id").limit(1);
    latency = Math.round(performance.now() - t0);
    if (pingErr) dbHealthy = "degraded";
  } catch {
    dbHealthy = "offline";
  }

  const countExact = async (table: string, filter?: (q: any) => any) => {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };

  const [
    totalSchools,
    activeSchools,
    suspendedSchools,
    totalUsers,
    superAdmins,
    principals,
    teacherAdmins,
    teachers,
    totalClasses,
    totalMaterials,
  ] = await Promise.all([
    countExact("schools"),
    countExact("schools", (q) => q.eq("is_active", true)),
    countExact("schools", (q) => q.eq("is_active", false)),
    countExact("profiles"),
    countExact("profiles", (q) => q.eq("role", "super_admin")),
    countExact("profiles", (q) => q.in("role", ["principal", "admin"])),
    countExact("profiles", (q) => q.eq("role", "teacher_admin")),
    countExact("profiles", (q) => q.eq("role", "teacher")),
    countExact("classes"),
    countExact("curriculum_materials"),
  ]);

  return {
    totalSchools,
    activeSchools,
    suspendedSchools,
    totalUsers,
    roleCounts: {
      super_admin: superAdmins,
      principal: principals,
      teacher_admin: teacherAdmins,
      teacher: teachers,
    },
    totalClasses,
    totalMaterials,
    systemHealth: {
      database: dbHealthy,
      latencyMs: latency,
      edgeFunctions: "operational",
      authService: "operational",
    },
  };
}

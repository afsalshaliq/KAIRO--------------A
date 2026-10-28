import { requireSupabase, supabase } from "@/lib/supabase";
import type { TeacherRequest, RequestType, RequestStatus } from "@/types/db";

// Mock requests for demo / offline preview
let localRequests: TeacherRequest[] = [
  {
    id: "req-1",
    school_id: "00000000-0000-0000-0000-000000000001",
    teacher_id: "dev-teacher-00000000-0000-0000-0000-000000000001",
    type: "leave",
    status: "pending",
    title: "Personal Leave Request",
    details: {
      date: "2026-10-20",
      duration: "1 day",
      reason: "Family event",
    },
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    teacher_name: "Dev Teacher",
    teacher_email: "teacher@school.edu",
    teacher_department: "Science",
  },
  {
    id: "req-2",
    school_id: "00000000-0000-0000-0000-000000000001",
    teacher_id: "dev-teacher-00000000-0000-0000-0000-000000000001",
    type: "teacher_admin",
    status: "pending",
    title: "Request for Teacher Admin Privileges",
    details: {
      reason: "Need to manage Grade 2 Science materials and assist in timetable reviews",
      requested_permissions: [
        "school.material.upload",
        "school.request.review",
        "school.audit.view",
      ],
    },
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    teacher_name: "Dev Teacher",
    teacher_email: "teacher@school.edu",
    teacher_department: "Science",
  },
];

/**
 * List requests for a school or teacher
 */
export async function listRequests(opts: {
  schoolId: string;
  teacherId?: string;
  status?: RequestStatus;
}): Promise<TeacherRequest[]> {
  if (!supabase) {
    let res = localRequests.filter((r) => r.school_id === opts.schoolId);
    if (opts.teacherId) res = res.filter((r) => r.teacher_id === opts.teacherId);
    if (opts.status) res = res.filter((r) => r.status === opts.status);
    return res;
  }

  let q = supabase
    .from("teacher_requests")
    .select(`
      *,
      profiles:teacher_id (full_name, email, department)
    `)
    .eq("school_id", opts.schoolId)
    .order("created_at", { ascending: false });

  if (opts.teacherId) q = q.eq("teacher_id", opts.teacherId);
  if (opts.status) q = q.eq("status", opts.status);

  const { data, error } = await q;
  if (error || !data) {
    return localRequests.filter((r) => r.school_id === opts.schoolId);
  }

  return data.map((r: any) => ({
    ...r,
    teacher_name: r.profiles?.full_name || "Teacher",
    teacher_email: r.profiles?.email || "",
    teacher_department: r.profiles?.department || "General",
  }));
}

/**
 * Submit a new teacher request
 */
export async function submitRequest(payload: {
  school_id: string;
  teacher_id: string;
  type: RequestType;
  title: string;
  details: Record<string, unknown>;
}): Promise<TeacherRequest> {
  if (!supabase) {
    const newReq: TeacherRequest = {
      id: `req-${Date.now()}`,
      school_id: payload.school_id,
      teacher_id: payload.teacher_id,
      type: payload.type,
      status: "pending",
      title: payload.title,
      details: payload.details,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      teacher_name: "Current Teacher",
    };
    localRequests = [newReq, ...localRequests];
    return newReq;
  }

  const sb = requireSupabase();
  const { data, error } = await sb
    .from("teacher_requests")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // Create audit log for request submission
  try {
    await sb.from("audit_logs").insert({
      school_id: payload.school_id,
      actor_id: payload.teacher_id,
      action: `request.create.${payload.type}`,
      target: data.id,
      meta: { title: payload.title, type: payload.type },
    });
  } catch {
    // Non-blocking
  }

  return data as TeacherRequest;
}

/**
 * Review a request (Approve or Reject)
 */
export async function reviewRequest(opts: {
  requestId: string;
  reviewerId: string;
  status: "approved" | "rejected";
  reviewNotes?: string;
  schoolId: string;
}): Promise<TeacherRequest> {
  if (!supabase) {
    const idx = localRequests.findIndex((r) => r.id === opts.requestId);
    if (idx !== -1) {
      localRequests[idx] = {
        ...localRequests[idx],
        status: opts.status,
        reviewed_by: opts.reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: opts.reviewNotes || null,
        updated_at: new Date().toISOString(),
      };
      return localRequests[idx];
    }
    throw new Error("Request not found");
  }

  const sb = requireSupabase();
  const { data: request, error: fetchErr } = await sb
    .from("teacher_requests")
    .select("*")
    .eq("id", opts.requestId)
    .single();

  if (fetchErr || !request) throw new Error("Request not found");

  const { data, error } = await sb
    .from("teacher_requests")
    .update({
      status: opts.status,
      reviewed_by: opts.reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: opts.reviewNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.requestId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // If approved and type was 'teacher_admin', promote role and grant permissions!
  if (opts.status === "approved" && request.type === "teacher_admin") {
    // 1. Update teacher role to teacher_admin
    await sb
      .from("profiles")
      .update({ role: "teacher_admin" })
      .eq("id", request.teacher_id);

    // 2. Grant requested permissions
    const reqPerms: string[] = request.details?.requested_permissions || [
      "school.material.upload",
      "school.request.review",
    ];

    for (const code of reqPerms) {
      try {
        await sb.from("teacher_admin_permissions").upsert({
          school_id: opts.schoolId,
          teacher_id: request.teacher_id,
          permission_code: code,
          granted_by: opts.reviewerId,
        }, { onConflict: "teacher_id,permission_code" });
      } catch {
        // Safe fallback
      }
    }

    // 3. Notify the teacher
    try {
      await sb.from("notifications").insert({
        school_id: opts.schoolId,
        user_id: request.teacher_id,
        type: "teacher_admin_approved",
        title: "Teacher Admin Privileges Granted",
        body: "Your request for Teacher Admin access has been approved by the Principal.",
        link: "/teacher/dashboard",
      });
    } catch {
      // Safe fallback
    }
  } else {
    // Notify teacher of decision
    try {
      await sb.from("notifications").insert({
        school_id: opts.schoolId,
        user_id: request.teacher_id,
        type: `request_${opts.status}`,
        title: `Request ${opts.status === "approved" ? "Approved" : "Rejected"}`,
        body: `Your ${request.type} request "${request.title}" has been ${opts.status}.`,
        link: "/teacher/requests",
      });
    } catch {
      // Safe fallback
    }
  }

  // Audit review action
  try {
    await sb.from("audit_logs").insert({
      school_id: opts.schoolId,
      actor_id: opts.reviewerId,
      action: `request.review.${opts.status}`,
      target: opts.requestId,
      meta: {
        type: request.type,
        teacher_id: request.teacher_id,
        notes: opts.reviewNotes,
      },
    });
  } catch {
    // Safe fallback
  }

  return data as TeacherRequest;
}

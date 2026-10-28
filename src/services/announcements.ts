import { requireSupabase, supabase } from "@/lib/supabase";
import type { Announcement, AnnouncementAudience } from "@/types/db";

// Fallback announcements for mock / demo
let localAnnouncements: Announcement[] = [
  {
    id: "ann-1",
    school_id: "00000000-0000-0000-0000-000000000001",
    title: "Term 2 Pedagogical Alignment Workshop",
    content: "All teaching staff are invited to the CBSE pedagogical alignment workshop this Friday at 3:00 PM in the Main Auditorium. We will review curriculum progress and AI-assisted lesson delivery.",
    audience: "all",
    target_department: null,
    is_published: true,
    published_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    published_by: "dev-principal",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    publisher_name: "Principal's Office",
  },
  {
    id: "ann-2",
    school_id: "00000000-0000-0000-0000-000000000001",
    title: "Teacher Admin Monthly Strategy Briefing",
    content: "Teacher Admins: Please ensure all pending curriculum materials are approved before the mid-term evaluations. Thank you for your leadership.",
    audience: "teacher_admins",
    target_department: null,
    is_published: true,
    published_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    published_by: "dev-principal",
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    publisher_name: "Principal's Office",
  },
];

/**
 * List announcements for a school, filtered for the viewer's role and department
 */
export async function listAnnouncements(opts: {
  schoolId: string;
  isPublishedOnly?: boolean;
  userRole?: string;
  department?: string;
}): Promise<Announcement[]> {
  if (!supabase) {
    let list = localAnnouncements.filter((a) => a.school_id === opts.schoolId);
    if (opts.isPublishedOnly) {
      list = list.filter((a) => a.is_published);
    }
    if (opts.userRole === "teacher") {
      list = list.filter(
        (a) =>
          a.audience === "all" ||
          (a.audience === "department" && a.target_department === opts.department)
      );
    }
    return list;
  }

  let q = supabase
    .from("announcements")
    .select(`
      *,
      profiles:published_by (full_name)
    `)
    .eq("school_id", opts.schoolId)
    .order("created_at", { ascending: false });

  if (opts.isPublishedOnly) {
    q = q.eq("is_published", true);
  }

  const { data, error } = await q;
  if (error || !data) {
    return localAnnouncements.filter((a) => a.school_id === opts.schoolId);
  }

  let results: Announcement[] = data.map((r: any) => ({
    ...r,
    publisher_name: r.profiles?.full_name || "Principal's Office",
  }));

  // Audience filtering for teachers
  if (opts.userRole === "teacher") {
    results = results.filter(
      (a) =>
        a.audience === "all" ||
        (a.audience === "department" && a.target_department === opts.department)
    );
  }

  return results;
}

/**
 * Create a new announcement (Principal only)
 */
export async function createAnnouncement(payload: {
  school_id: string;
  title: string;
  content: string;
  audience: AnnouncementAudience;
  target_department?: string | null;
  publish_now?: boolean;
  published_by?: string;
}): Promise<Announcement> {
  const isPub = !!payload.publish_now;
  const now = new Date().toISOString();

  if (!supabase) {
    const ann: Announcement = {
      id: `ann-${Date.now()}`,
      school_id: payload.school_id,
      title: payload.title,
      content: payload.content,
      audience: payload.audience,
      target_department: payload.target_department || null,
      is_published: isPub,
      published_at: isPub ? now : null,
      published_by: payload.published_by || null,
      created_at: now,
      updated_at: now,
      publisher_name: "Principal",
    };
    localAnnouncements = [ann, ...localAnnouncements];
    return ann;
  }

  const sb = requireSupabase();
  const { data, error } = await sb
    .from("announcements")
    .insert({
      school_id: payload.school_id,
      title: payload.title,
      content: payload.content,
      audience: payload.audience,
      target_department: payload.target_department || null,
      is_published: isPub,
      published_at: isPub ? now : null,
      published_by: payload.published_by || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // Audit announcement creation
  try {
    await sb.from("audit_logs").insert({
      school_id: payload.school_id,
      actor_id: payload.published_by || null,
      action: isPub ? "announcement.publish" : "announcement.create",
      target: data.id,
      meta: { title: payload.title, audience: payload.audience },
    });
  } catch { /* ignore audit logging errors */ }

  return data as Announcement;
}

/**
 * Publish an existing draft announcement
 */
export async function publishAnnouncement(
  id: string,
  schoolId: string,
  publisherId: string
): Promise<void> {
  const now = new Date().toISOString();
  if (!supabase) {
    const item = localAnnouncements.find((a) => a.id === id);
    if (item) {
      item.is_published = true;
      item.published_at = now;
      item.published_by = publisherId;
    }
    return;
  }

  const sb = requireSupabase();
  const { error } = await sb
    .from("announcements")
    .update({
      is_published: true,
      published_at: now,
      published_by: publisherId,
      updated_at: now,
    })
    .eq("id", id)
    .eq("school_id", schoolId);

  if (error) throw new Error(error.message);

  try {
    await sb.from("audit_logs").insert({
      school_id: schoolId,
      actor_id: publisherId,
      action: "announcement.publish",
      target: id,
      meta: { id },
    });
  } catch { /* ignore audit logging errors */ }
}

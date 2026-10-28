import { requireSupabase, supabase } from "@/lib/supabase";
import type { Notification } from "@/types/db";

const localNotifications: Notification[] = [
  {
    id: "notif-1",
    school_id: "00000000-0000-0000-0000-000000000001",
    user_id: "dev-teacher-00000000-0000-0000-0000-000000000001",
    type: "announcement",
    title: "New School Announcement",
    body: "Principal published 'Term 2 Pedagogical Alignment Workshop'.",
    link: "/teacher/announcements",
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "notif-2",
    school_id: "00000000-0000-0000-0000-000000000001",
    user_id: "dev-teacher-00000000-0000-0000-0000-000000000001",
    type: "material_ready",
    title: "New Curriculum Chapter Ready",
    body: "CBSE Class 1 Science Chapter 3 is approved and ready for lesson generation.",
    link: "/teacher/materials",
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

export async function listNotifications(userId: string): Promise<Notification[]> {
  if (!supabase) {
    return localNotifications;
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) {
    return localNotifications;
  }
  return data as Notification[];
}

export async function markAsRead(id: string): Promise<void> {
  if (!supabase) {
    const item = localNotifications.find((n) => n.id === id);
    if (item) item.is_read = true;
    return;
  }

  await requireSupabase()
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
}

export async function markAllAsRead(userId: string): Promise<void> {
  if (!supabase) {
    localNotifications.forEach((n) => (n.is_read = true));
    return;
  }

  await requireSupabase()
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

import { requireSupabase, supabase } from "@/lib/supabase";
import type { TimetableRow } from "@/types/db";

export interface TimetableSummary {
  today: TimetableRow[];
  previousClass: TimetableRow | null;
  currentClass: TimetableRow | null;
  nextClass: TimetableRow | null;
}

// Fallback mock timetable for demo / offline mode
export const MOCK_TIMETABLE: TimetableRow[] = [
  {
    id: "tt-1",
    school_id: "00000000-0000-0000-0000-000000000001",
    class_id: "c-1",
    section_id: "s-1",
    subject_id: "sub-1",
    teacher_id: "t-1",
    day_of_week: 1, // Monday
    period_number: 1,
    start_time: "09:00",
    end_time: "10:00",
    room: "Room 101",
    academic_year: "2025-2026",
    created_at: new Date().toISOString(),
    className: "Class 1",
    sectionName: "A",
    subjectName: "English",
  },
  {
    id: "tt-2",
    school_id: "00000000-0000-0000-0000-000000000001",
    class_id: "c-2",
    section_id: "s-2",
    subject_id: "sub-2",
    teacher_id: "t-1",
    day_of_week: 1,
    period_number: 2,
    start_time: "10:00",
    end_time: "11:00",
    room: "Room 102",
    academic_year: "2025-2026",
    created_at: new Date().toISOString(),
    className: "Class 2",
    sectionName: "B",
    subjectName: "Science",
  },
  {
    id: "tt-3",
    school_id: "00000000-0000-0000-0000-000000000001",
    class_id: "c-3",
    section_id: "s-3",
    subject_id: "sub-3",
    teacher_id: "t-1",
    day_of_week: 1,
    period_number: 3,
    start_time: "11:15",
    end_time: "12:15",
    room: "Room 103",
    academic_year: "2025-2026",
    created_at: new Date().toISOString(),
    className: "Class 3",
    sectionName: "A",
    subjectName: "Mathematics",
  },
];

/**
 * List weekly timetable for a teacher in a school
 */
export async function listTeacherTimetable(
  teacherId: string,
  schoolId: string
): Promise<TimetableRow[]> {
  if (!supabase) {
    return MOCK_TIMETABLE;
  }

  const { data, error } = await supabase
    .from("timetables")
    .select(`
      *,
      classes (grade),
      sections (name),
      subjects (name)
    `)
    .eq("teacher_id", teacherId)
    .eq("school_id", schoolId)
    .order("day_of_week", { ascending: true })
    .order("period_number", { ascending: true });

  if (error || !data) {
    return MOCK_TIMETABLE;
  }

  return data.map((r: any) => ({
    ...r,
    className: r.classes ? `Class ${r.classes.grade}` : "Class",
    sectionName: r.sections?.name || "A",
    subjectName: r.subjects?.name || "Subject",
  }));
}

/**
 * List school-wide timetable for classes/sections (for Principal & Teacher Admins)
 */
export async function listSchoolTimetable(schoolId: string): Promise<TimetableRow[]> {
  if (!supabase) {
    return MOCK_TIMETABLE;
  }

  const { data, error } = await supabase
    .from("timetables")
    .select(`
      *,
      classes (grade),
      sections (name),
      subjects (name),
      profiles:teacher_id (full_name)
    `)
    .eq("school_id", schoolId)
    .order("day_of_week", { ascending: true })
    .order("period_number", { ascending: true });

  if (error || !data) {
    return MOCK_TIMETABLE;
  }

  return data.map((r: any) => ({
    ...r,
    className: r.classes ? `Class ${r.classes.grade}` : "Class",
    sectionName: r.sections?.name || "A",
    subjectName: r.subjects?.name || "Subject",
    teacherName: r.profiles?.full_name || "Teacher",
  }));
}

/**
 * Calculate previous, current, and next class for today
 */
export function computeScheduleStatus(timetable: TimetableRow[]): TimetableSummary {
  const now = new Date();
  let dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (dayOfWeek === 0) dayOfWeek = 7;

  // Filter for today's periods (or default to Monday for weekends/demo)
  let todayClasses = timetable.filter((t) => t.day_of_week === dayOfWeek);
  if (todayClasses.length === 0 && timetable.length > 0) {
    todayClasses = timetable.filter((t) => t.day_of_week === 1);
  }

  todayClasses.sort((a, b) => a.period_number - b.period_number);

  // Parse time
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let currentClass: TimetableRow | null = null;
  let previousClass: TimetableRow | null = null;
  let nextClass: TimetableRow | null = null;

  for (let i = 0; i < todayClasses.length; i++) {
    const item = todayClasses[i];
    const [startH, startM] = item.start_time.split(":").map(Number);
    const [endH, endM] = item.end_time.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (currentMinutes >= startMin && currentMinutes < endMin) {
      currentClass = item;
      previousClass = i > 0 ? todayClasses[i - 1] : null;
      nextClass = i < todayClasses.length - 1 ? todayClasses[i + 1] : null;
      break;
    } else if (currentMinutes < startMin && !nextClass) {
      nextClass = item;
      previousClass = i > 0 ? todayClasses[i - 1] : null;
      break;
    }
  }

  if (!currentClass && !nextClass && todayClasses.length > 0) {
    // If after last class, previous is the last class
    previousClass = todayClasses[todayClasses.length - 1];
  }

  return {
    today: todayClasses,
    previousClass,
    currentClass,
    nextClass,
  };
}

/**
 * Save or update a timetable entry
 */
export async function saveTimetableEntry(payload: {
  school_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  room: string;
  academic_year?: string;
}): Promise<TimetableRow> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("timetables")
    .upsert(
      {
        ...payload,
        academic_year: payload.academic_year || "2025-2026",
      },
      { onConflict: "school_id,class_id,section_id,day_of_week,period_number" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as TimetableRow;
}

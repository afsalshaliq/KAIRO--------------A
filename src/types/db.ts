export type Role = "super_admin" | "admin" | "principal" | "teacher_admin" | "teacher";
export type AccountStatus = "active" | "suspended" | "deactivated";
export type MaterialStatus = "uploaded" | "processing" | "ready" | "failed" | "archived";

export interface SchoolSettings {
  ai_enabled: boolean;
  face_auth_enabled: boolean;
  teacher_admin_enabled: boolean;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  timezone?: string;
  subscription_tier?: string;
  max_students?: number;
}

export interface School {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  settings: SchoolSettings;
  created_at: string;
  updated_at: string;
}

export interface SchoolDomain {
  id: string;
  school_id: string;
  hostname: string;
  is_primary: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: AccountStatus;
  school_id: string | null;
  phone: string;
  address: string;
  avatar_url: string;
  degree: string;
  degree_certificate_url: string;
  department: string;
  joining_date: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
}

export interface TeacherAdminPermission {
  id: string;
  school_id: string;
  teacher_id: string;
  permission_code: string;
  granted_by: string | null;
  granted_at: string;
}

export interface ClassRow {
  id: string;
  school_id?: string | null;
  grade: number;
  academic_year: string;
  is_archived: boolean;
  created_at: string;
}

export interface Section {
  id: string;
  class_id: string;
  name: string;
  is_archived: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  school_id?: string | null;
  teacher_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  is_revoked: boolean;
  created_at: string;
}

export interface Material {
  id: string;
  school_id?: string | null;
  title: string;
  class_id: string;
  section_id: string | null;
  subject_id: string;
  chapter: string;
  academic_year: string;
  file_path: string;
  mime_type: string;
  byte_size: number;
  status: MaterialStatus;
  is_published: boolean;
  uploaded_by: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimetableRow {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number; // 1 = Monday .. 7 = Sunday
  period_number: number; // 1 .. 10
  start_time: string;
  end_time: string;
  room: string;
  academic_year: string;
  created_at: string;
  // Joined fields
  className?: string;
  sectionName?: string;
  subjectName?: string;
  teacherName?: string;
}

export type RequestType = "leave" | "extra_period" | "schedule" | "teacher_admin";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface TeacherRequest {
  id: string;
  school_id: string;
  teacher_id: string;
  type: RequestType;
  status: RequestStatus;
  title: string;
  details: {
    date?: string;
    duration?: string;
    reason?: string;
    attachment_url?: string;
    current_period?: number;
    requested_period?: number;
    requested_permissions?: string[];
    [key: string]: unknown;
  };
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  teacher_name?: string;
  teacher_email?: string;
  teacher_department?: string;
}

export type AnnouncementAudience = "all" | "teacher_admins" | "department" | "specific";

export interface Announcement {
  id: string;
  school_id: string;
  title: string;
  content: string;
  audience: AnnouncementAudience;
  target_department: string | null;
  is_published: boolean;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  publisher_name?: string;
}

export interface Notification {
  id: string;
  school_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AIConfiguration {
  id: string;
  school_id: string;
  provider: string;
  model: string;
  allow_teacher_keys: boolean;
  encrypted_api_key?: string | null;
  custom_system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIUsage {
  id: string;
  school_id: string;
  teacher_id: string;
  tokens_used: number;
  feature: string;
  created_at: string;
}

export interface BiometricCredential {
  id: string;
  school_id: string;
  user_id: string;
  template_hash: string;
  consent_given: boolean;
  consent_at: string;
  is_active: boolean;
  last_verified_at: string | null;
  created_at: string;
}

export interface HistoryRow {
  id: string;
  school_id?: string | null;
  teacher_id: string;
  resource_type: "explanation" | "summary" | "lesson_plan" | "activity" | "worksheet" | "quiz";
  resource_id: string | null;
  material_id: string | null;
  title: string;
  summary: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  school_id?: string | null;
  actor_id: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
  actor_role?: string;
}

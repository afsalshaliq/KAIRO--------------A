import type { Profile } from "@/types/db";

export const PERMISSIONS = {
  TEACHER_VIEW: "school.teacher.view",
  TEACHER_CREATE: "school.teacher.create",
  TEACHER_UPDATE: "school.teacher.update",
  TEACHER_DELETE: "school.teacher.delete",

  TEACHER_ADMIN_VIEW: "school.teacher_admin.view",
  TEACHER_ADMIN_MANAGE: "school.teacher_admin.manage",

  CLASS_VIEW: "school.class.view",
  CLASS_MANAGE: "school.class.manage",

  TIMETABLE_VIEW: "school.timetable.view",
  TIMETABLE_MANAGE: "school.timetable.manage",

  MATERIAL_VIEW: "school.material.view",
  MATERIAL_UPLOAD: "school.material.upload",
  MATERIAL_DELETE: "school.material.delete",

  ANNOUNCEMENT_CREATE: "school.announcement.create",
  ANNOUNCEMENT_PUBLISH: "school.announcement.publish",

  REQUEST_CREATE: "school.request.create",
  REQUEST_REVIEW: "school.request.review",

  AUDIT_VIEW: "school.audit.view",
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Checks whether a given profile has authorization for a specific permission.
 * - super_admin: grants all permissions globally.
 * - principal / admin: grants all school-level permissions.
 * - teacher_admin: grants granted permissions + standard teacher capabilities.
 * - teacher: grants standard teacher capabilities.
 */
export function hasPermission(
  profile: Profile | null,
  permission: PermissionCode | string,
  grantedPermissions: string[] = []
): boolean {
  if (!profile || profile.status !== "active") return false;

  // Global Super Admin has all powers
  if (profile.role === "super_admin") return true;

  // Principal / School Admin has all school permissions
  if (profile.role === "admin" || profile.role === "principal") return true;

  // Teacher Admin has explicit granted permissions
  if (profile.role === "teacher_admin") {
    if (grantedPermissions.includes(permission)) return true;
  }

  // Baseline teacher permissions
  const teacherBase: string[] = [
    PERMISSIONS.MATERIAL_VIEW,
    PERMISSIONS.REQUEST_CREATE,
    PERMISSIONS.TIMETABLE_VIEW,
  ];

  if (teacherBase.includes(permission)) return true;

  return false;
}

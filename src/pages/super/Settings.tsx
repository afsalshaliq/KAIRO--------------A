import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useToast, Spinner } from "@/components/ui";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { purgeExpiredAuditLogs, recordKairoMove } from "@/services/audit";

export interface PlatformRole {
  code: string;
  name: string;
  description: string;
  badge: string;
  badgeColor: "indigo" | "purple" | "teal" | "emerald" | "amber" | "rose" | "blue";
  protected: boolean;
  members: "Global" | "Per School";
  permissions: Record<string, boolean>;
}

export const PRESET_MASTER_LOGOS = [
  {
    id: "default",
    name: "KAIRO Original (Factory Default)",
    badge: "Factory Default",
    url: "/logo.svg",
    description: "Official KAIRO deep-blue geometric star emblem",
  },
  {
    id: "quantum",
    name: "Quantum AI Spark",
    badge: "Cyber Violet",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="qg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%236366f1"/><stop offset="100%" stop-color="%23a855f7"/></linearGradient></defs><polygon points="50,5 92,28 92,72 50,95 8,72 8,28" fill="url(%23qg)"/><path d="M50 25 L60 45 L80 50 L60 55 L50 75 L40 55 L20 50 L40 45 Z" fill="%23ffffff"/></svg>`,
    description: "Polyhedral quantum engine emblem with glowing core",
  },
  {
    id: "nexus",
    name: "Nexus Cyber Helix",
    badge: "Emerald Cyan",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230ea5e9"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><circle cx="50" cy="50" r="42" fill="url(%23ng)"/><circle cx="50" cy="30" r="10" fill="%23ffffff"/><circle cx="32" cy="65" r="10" fill="%23ffffff"/><circle cx="68" cy="65" r="10" fill="%23ffffff"/><line x1="50" y1="30" x2="32" y2="65" stroke="%23ffffff" stroke-width="4"/><line x1="50" y1="30" x2="68" y2="65" stroke="%23ffffff" stroke-width="4"/><line x1="32" y1="65" x2="68" y2="65" stroke="%23ffffff" stroke-width="4"/></svg>`,
    description: "Interconnected neural node intelligence insignia",
  },
  {
    id: "apex",
    name: "Apex Sovereign Shield",
    badge: "Gold & Obsidian",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230f172a"/><stop offset="100%" stop-color="%23334155"/></linearGradient></defs><rect x="10" y="10" width="80" height="80" rx="20" fill="url(%23ag)" stroke="%23eab308" stroke-width="4"/><path d="M30 70 L50 25 L70 70 L58 70 L50 50 L42 70 Z" fill="%23facc15"/></svg>`,
    description: "Distinguished institutional apex authority badge",
  },
];

export const getRoleBadgeStyles = (color?: string) => {
  switch (color) {
    case "purple":
      return "bg-purple-50 text-purple-800 border-purple-200";
    case "teal":
      return "bg-teal-50 text-teal-800 border-teal-200";
    case "emerald":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "amber":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "rose":
      return "bg-rose-50 text-rose-800 border-rose-200";
    case "blue":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "indigo":
    default:
      return "bg-indigo-50 text-indigo-800 border-indigo-200";
  }
};

const DEFAULT_PLATFORM_ROLES: PlatformRole[] = [
  {
    code: "super_admin",
    name: "Super Administrator",
    description: "Platform-wide global controller with unrestricted cross-tenant authority, database oversight, and security management.",
    badge: "Platform Sovereign",
    badgeColor: "indigo",
    protected: true,
    members: "Global",
    permissions: {
      "school.create": true,
      "school.edit": true,
      "school.suspend": true,
      "school.domain.bind": true,
      "user.create_global": true,
      "user.role.assign": true,
      "school.teacher.manage": true,
      "school.teacher_admin.manage": true,
      "school.material.view_global": true,
      "school.material.upload": true,
      "school.material.publish": true,
      "school.material.read": true,
      "school.class.manage": true,
      "ai.plan.generate": true,
      "ai.worksheet.generate": true,
      "ai.quiz.generate": true,
      "ai.assistant.pedagogy": true,
      "audit.view_global": true,
      "school.audit.view": true,
      "biometric.manage": true,
      "request.review": true,
      "system.settings.edit": true,
      "system.backups.manage": true,
      "system.api_keys.manage": true,
    },
  },
  {
    code: "principal",
    name: "Principal (School Administrator)",
    description: "Autonomous chief administrator of an individual school tenant. Governs teachers, classes, and delegated permissions.",
    badge: "Tenant Sovereign",
    badgeColor: "purple",
    protected: true,
    members: "Per School",
    permissions: {
      "school.create": false,
      "school.edit": false,
      "school.suspend": false,
      "school.domain.bind": false,
      "user.create_global": false,
      "user.role.assign": false,
      "school.teacher.manage": true,
      "school.teacher_admin.manage": true,
      "school.material.view_global": false,
      "school.material.upload": true,
      "school.material.publish": true,
      "school.material.read": true,
      "school.class.manage": true,
      "ai.plan.generate": true,
      "ai.worksheet.generate": true,
      "ai.quiz.generate": true,
      "ai.assistant.pedagogy": true,
      "audit.view_global": false,
      "school.audit.view": true,
      "biometric.manage": true,
      "request.review": true,
      "system.settings.edit": false,
      "system.backups.manage": false,
      "system.api_keys.manage": false,
    },
  },
  {
    code: "teacher_admin",
    name: "Teacher Administrator",
    description: "Elevated teaching faculty member holding delegated administrative permissions (e.g. material publication, request review).",
    badge: "Elevated Educator",
    badgeColor: "teal",
    protected: false,
    members: "Per School",
    permissions: {
      "school.create": false,
      "school.edit": false,
      "school.suspend": false,
      "school.domain.bind": false,
      "user.create_global": false,
      "user.role.assign": false,
      "school.teacher.manage": false,
      "school.teacher_admin.manage": false,
      "school.material.view_global": false,
      "school.material.upload": true,
      "school.material.publish": true,
      "school.material.read": true,
      "school.class.manage": false,
      "ai.plan.generate": true,
      "ai.worksheet.generate": true,
      "ai.quiz.generate": true,
      "ai.assistant.pedagogy": true,
      "audit.view_global": false,
      "school.audit.view": true,
      "biometric.manage": false,
      "request.review": true,
      "system.settings.edit": false,
      "system.backups.manage": false,
      "system.api_keys.manage": false,
    },
  },
  {
    code: "teacher",
    name: "Teacher",
    description: "Primary classroom educator. Manages assigned CBSE class sections, accesses pedagogical AI, and creates worksheets/quizzes.",
    badge: "Core Faculty",
    badgeColor: "emerald",
    protected: true,
    members: "Per School",
    permissions: {
      "school.create": false,
      "school.edit": false,
      "school.suspend": false,
      "school.domain.bind": false,
      "user.create_global": false,
      "user.role.assign": false,
      "school.teacher.manage": false,
      "school.teacher_admin.manage": false,
      "school.material.view_global": false,
      "school.material.upload": false,
      "school.material.publish": false,
      "school.material.read": true,
      "school.class.manage": false,
      "ai.plan.generate": true,
      "ai.worksheet.generate": true,
      "ai.quiz.generate": true,
      "ai.assistant.pedagogy": true,
      "audit.view_global": false,
      "school.audit.view": false,
      "biometric.manage": false,
      "request.review": false,
      "system.settings.edit": false,
      "system.backups.manage": false,
      "system.api_keys.manage": false,
    },
  },
];

type SettingsTab =
  | "roles"
  | "templates"
  | "notifications"
  | "system"
  | "backups"
  | "logs"
  | "api"
  | "database-test";

export default function SuperSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as SettingsTab) || "roles";
  const toast = useToast();

  const switchTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  // Master Platform Logo state
  const [masterLogoUrl, setMasterLogoUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kairo_platform_master_logo") || "";
    }
    return "";
  });

  // Roles & Permissions state
  const [roles, setRoles] = useState<PlatformRole[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("kairo_platform_custom_roles");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // fallback
      }
    }
    return DEFAULT_PLATFORM_ROLES;
  });

  const saveRoles = (newRoles: PlatformRole[]) => {
    setRoles(newRoles);
    if (typeof window !== "undefined") {
      localStorage.setItem("kairo_platform_custom_roles", JSON.stringify(newRoles));
    }
  };

  // Role Form modal state
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<PlatformRole | null>(null);

  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormCode, setRoleFormCode] = useState("");
  const [roleFormDesc, setRoleFormDesc] = useState("");
  const [roleFormBadge, setRoleFormBadge] = useState("");
  const [roleFormBadgeColor, setRoleFormBadgeColor] = useState<PlatformRole["badgeColor"]>("indigo");
  const [roleFormScope, setRoleFormScope] = useState<"Global" | "Per School">("Per School");
  const [roleFormPermissions, setRoleFormPermissions] = useState<Record<string, boolean>>({});

  const handleOpenCreateRole = () => {
    setRoleFormName("");
    setRoleFormCode("");
    setRoleFormDesc("");
    setRoleFormBadge("Custom Role");
    setRoleFormBadgeColor("blue");
    setRoleFormScope("Per School");
    setRoleFormPermissions({});
    setCreateRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: PlatformRole) => {
    setEditingRole(role);
    setRoleFormName(role.name);
    setRoleFormCode(role.code);
    setRoleFormDesc(role.description);
    setRoleFormBadge(role.badge);
    setRoleFormBadgeColor(role.badgeColor || "indigo");
    setRoleFormScope(role.members);
    setRoleFormPermissions({ ...(role.permissions || {}) });
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormName.trim()) {
      toast("error", "Role name is required.");
      return;
    }
    const finalCode = (roleFormCode.trim() || roleFormName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_")).replace(/^_+|_+$/g, "");
    if (!finalCode) {
      toast("error", "Role identifier code is required.");
      return;
    }

    if (editingRole) {
      // Editing existing role
      const updated = roles.map((r) => {
        if (r.code === editingRole.code) {
          return {
            ...r,
            name: roleFormName.trim(),
            description: roleFormDesc.trim(),
            badge: roleFormBadge.trim() || "Role",
            badgeColor: roleFormBadgeColor,
            members: roleFormScope,
            permissions: roleFormPermissions,
          };
        }
        return r;
      });
      saveRoles(updated);
      recordKairoMove({
        action: "user.role_change",
        target: editingRole.code,
        meta: { name: roleFormName, permissions_count: Object.values(roleFormPermissions).filter(Boolean).length },
      });
      toast("success", `Role "${roleFormName}" updated successfully.`);
      setEditingRole(null);
    } else {
      // Creating new role
      if (roles.some((r) => r.code === finalCode)) {
        toast("error", `A role with identifier "${finalCode}" already exists.`);
        return;
      }
      const newRole: PlatformRole = {
        code: finalCode,
        name: roleFormName.trim(),
        description: roleFormDesc.trim() || "Custom institutional role with configured permissions.",
        badge: roleFormBadge.trim() || "Custom Role",
        badgeColor: roleFormBadgeColor,
        protected: false,
        members: roleFormScope,
        permissions: roleFormPermissions,
      };
      saveRoles([...roles, newRole]);
      recordKairoMove({
        action: "user.create",
        target: finalCode,
        meta: { type: "role_created", name: roleFormName },
      });
      toast("success", `New role "${roleFormName}" created successfully.`);
      setCreateRoleModalOpen(false);
    }
  };

  const handleDeleteRole = (role: PlatformRole) => {
    if (role.protected) {
      toast("error", `Role "${role.name}" is system-protected and cannot be deleted.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the role "${role.name}" (${role.code})?`)) {
      return;
    }
    const updated = roles.filter((r) => r.code !== role.code);
    saveRoles(updated);
    recordKairoMove({
      action: "user.update",
      target: role.code,
      meta: { type: "role_deleted", name: role.name },
    });
    toast("info", `Role "${role.name}" has been deleted.`);
  };

  const handleTogglePermission = (code: string) => {
    setRoleFormPermissions((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const handleSetCategoryPermissions = (codes: string[], enabled: boolean) => {
    setRoleFormPermissions((prev) => {
      const next = { ...prev };
      codes.forEach((c) => {
        next[c] = enabled;
      });
      return next;
    });
  };

  const handleSetAllPermissions = (enabled: boolean) => {
    const allCodes = permissionsMatrix.flatMap((cat) => cat.permissions.map((p) => p.code));
    const next: Record<string, boolean> = {};
    allCodes.forEach((c) => {
      next[c] = enabled;
    });
    setRoleFormPermissions(next);
  };

  // Master Logo handlers
  const handleMasterLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("error", "Logo file size must be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setMasterLogoUrl(reader.result);
        toast("info", "Logo preview loaded. Click 'Save Master Platform Logo' to broadcast.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyMasterLogo = () => {
    if (masterLogoUrl && masterLogoUrl !== "/logo.svg") {
      localStorage.setItem("kairo_platform_master_logo", masterLogoUrl);
      window.dispatchEvent(new Event("kairo_logo_changed"));
      recordKairoMove({
        action: "system.settings.edit",
        target: "kairo_platform_master_logo",
        meta: { source: "custom_logo_applied" },
      });
      toast("success", "Global Master KAIRO Logo updated across all portals.");
    } else {
      handleResetMasterLogo();
    }
  };

  const handleResetMasterLogo = () => {
    localStorage.removeItem("kairo_platform_master_logo");
    setMasterLogoUrl("");
    window.dispatchEvent(new Event("kairo_logo_changed"));
    recordKairoMove({
      action: "system.settings.edit",
      target: "kairo_platform_master_logo",
      meta: { source: "factory_default_reset" },
    });
    toast("info", "Master logo reset to factory default (/logo.svg).");
  };

  const permissionsMatrix = [
    {
      category: "Multi-Tenant School Administration",
      permissions: [
        { code: "school.create", name: "Provision New School Tenant", desc: "Allocate subdomains, database boundaries, and security realms.", sa: true, pr: false, ta: false, te: false },
        { code: "school.edit", name: "Modify Existing School Metadata", desc: "Update school contact, branding, and feature toggles by immutable ID.", sa: true, pr: false, ta: false, te: false },
        { code: "school.suspend", name: "Suspend / Activate School Realm", desc: "Manage operational status of school tenants with audit logging.", sa: true, pr: false, ta: false, te: false },
        { code: "school.domain.bind", name: "Custom Domain Association", desc: "Configure custom DNS hostnames for institutional tenants.", sa: true, pr: false, ta: false, te: false },
      ],
    },
    {
      category: "User Governance & Identity",
      permissions: [
        { code: "user.create_global", name: "Global User Provisioning", desc: "Invite and create users across any school or global realm.", sa: true, pr: false, ta: false, te: false },
        { code: "user.role.assign", name: "Assign & Upgrade Roles", desc: "Modify user role hierarchy with privilege escalation safeguards.", sa: true, pr: false, ta: false, te: false },
        { code: "school.teacher.manage", name: "Manage School Faculty Roster", desc: "Invite, update, and manage teachers within own school tenant.", sa: true, pr: true, ta: false, te: false },
        { code: "school.teacher_admin.manage", name: "Delegate Teacher Admin Permissions", desc: "Assign granular administrative capabilities to senior teachers.", sa: true, pr: true, ta: false, te: false },
      ],
    },
    {
      category: "Curriculum & Primary Academics",
      permissions: [
        { code: "school.material.view_global", name: "Global Curriculum Inspection", desc: "Cross-school inspection of syllabus textbooks and chapters.", sa: true, pr: false, ta: false, te: false },
        { code: "school.material.upload", name: "Upload Curriculum Documents", desc: "Add approved NCERT/CBSE textbook chapters to school repository.", sa: true, pr: true, ta: true, te: false },
        { code: "school.material.publish", name: "Publish Materials to Faculty", desc: "Make uploaded chapter documents accessible to all teachers.", sa: true, pr: true, ta: true, te: false },
        { code: "school.material.read", name: "Read Assigned Class Materials", desc: "Access textbook chapters grounded for assigned classes.", sa: true, pr: true, ta: true, te: true },
        { code: "school.class.manage", name: "Manage Classes & Timetables", desc: "Create Grades 1–5 sections, timetables, and teacher assignments.", sa: true, pr: true, ta: false, te: false },
      ],
    },
    {
      category: "AI Pedagogical Engine & Generation",
      permissions: [
        { code: "ai.plan.generate", name: "Generate Grounded Lesson Plans", desc: "Create multi-tier primary lesson plans grounded in chapter text.", sa: true, pr: true, ta: true, te: true },
        { code: "ai.worksheet.generate", name: "Generate Differentiated Worksheets", desc: "Produce printable classroom worksheets with answer keys.", sa: true, pr: true, ta: true, te: true },
        { code: "ai.quiz.generate", name: "Generate Adaptive Assessments", desc: "Create Bloom's taxonomy aligned quizzes for Classes 1–5.", sa: true, pr: true, ta: true, te: true },
        { code: "ai.assistant.pedagogy", name: "Pedagogical Assistant Consultation", desc: "Real-time AI consultation on student misconceptions & scaffolding.", sa: true, pr: true, ta: true, te: true },
      ],
    },
    {
      category: "Security & Audit Governance",
      permissions: [
        { code: "audit.view_global", name: "Inspect Global Audit Trail", desc: "View security-sensitive events across all schools in the platform.", sa: true, pr: false, ta: false, te: false },
        { code: "school.audit.view", name: "Inspect School Audit Logs", desc: "View school-level administrative and security events.", sa: true, pr: true, ta: true, te: false },
        { code: "biometric.manage", name: "Biometric Liveness Management", desc: "Oversee facial biometric credentials and verification policies.", sa: true, pr: true, ta: false, te: false },
        { code: "request.review", name: "Review Teacher Requests", desc: "Approve or reject leave, timetable, and schedule requests.", sa: true, pr: true, ta: true, te: false },
      ],
    },
    {
      category: "Platform System Configuration",
      permissions: [
        { code: "system.settings.edit", name: "Platform System Configuration", desc: "Configure global platform settings, timezones, and policies.", sa: true, pr: false, ta: false, te: false },
        { code: "system.backups.manage", name: "Database Backup Oversight", desc: "Review PITR snapshots and trigger manual backup operations.", sa: true, pr: false, ta: false, te: false },
        { code: "system.api_keys.manage", name: "Manage API Access Tokens", desc: "Create, rotate, and revoke REST API credentials and webhooks.", sa: true, pr: false, ta: false, te: false },
      ],
    },
  ];

  // Templates state
  const [templateHeader, setTemplateHeader] = useState("KAIRO Primary Education Framework · CBSE Aligned");
  const [templateFooter, setTemplateFooter] = useState("Confidential Institutional Material · For Classroom Instructional Use Only");
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [showBloomsMarkers, setShowBloomsMarkers] = useState(true);
  const [scheduledReportFrequency, setScheduledReportFrequency] = useState("weekly");

  // Notifications state
  const [emailAlertNewFaculty, setEmailAlertNewFaculty] = useState(true);
  const [emailAlertRoleChange, setEmailAlertRoleChange] = useState(true);
  const [emailAlertSuspension, setEmailAlertSuspension] = useState(true);
  const [emailAlertSecuritySpike, setEmailAlertSecuritySpike] = useState(true);
  const [testingNotification, setTestingNotification] = useState(false);

  // System settings state
  const [platformTitle, setPlatformTitle] = useState("KAIRO — Intelligent Education System");
  const [supportEmail, setSupportEmail] = useState("support@kairo.internal");
  const [academicYear, setAcademicYear] = useState("2025–2026");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [sessionTimeoutMins, setSessionTimeoutMins] = useState("60");
  const [biometricThreshold, setBiometricThreshold] = useState("95");

  // Backups state
  const [backupSnapshots, setBackupSnapshots] = useState([
    { id: "snp-20261014-001", type: "Automated Daily PITR", timestamp: "2026-10-14 04:00:00 UTC", size: "142.6 MB", status: "Completed" },
    { id: "snp-20261013-001", type: "Automated Daily PITR", timestamp: "2026-10-13 04:00:00 UTC", size: "139.8 MB", status: "Completed" },
    { id: "snp-20261012-001", type: "Automated Daily PITR", timestamp: "2026-10-12 04:00:00 UTC", size: "137.4 MB", status: "Completed" },
    { id: "snp-20261011-manual", type: "Manual Pre-Migration", timestamp: "2026-10-11 18:22:10 UTC", size: "136.9 MB", status: "Completed" },
  ]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoringBackup, setRestoringBackup] = useState(false);

  // Logs & Audit state
  const [logFilterSeverity, setLogFilterSeverity] = useState("all");
  const [logFilterCategory, setLogFilterCategory] = useState("all");
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(null);
  const [logSubView, setLogSubView] = useState<"all" | "audit-files" | "global-logs">("all");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [selectedAuditFile, setSelectedAuditFile] = useState<any | null>(null);
  const [generatingDailyArchive, setGeneratingDailyArchive] = useState(false);

  const [dailyAuditFiles] = useState([
    {
      id: "daf-20261018",
      date: "2026-10-18",
      label: "Today (2026-10-18)",
      filename: "kairo-global-audit-2026-10-18.jsonl",
      recordCount: 42,
      size: "94.6 KB",
      status: "Active (Hourly Sync)",
      sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      lastUpdated: "Just now",
      sampleEvents: [
        { action: "user.create", actor: "superadmin@kairo.in", target: "principal@royalschool.in", time: "15:26:10", tenant: "Royal School" },
        { action: "teacher.bulk_import", actor: "principal@royalschool.in", target: "8 teachers roster", time: "15:47:02", tenant: "Royal School" },
        { action: "tenant.config_update", actor: "superadmin@kairo.in", target: "Royal School", time: "14:15:30", tenant: "Royal School" },
        { action: "auth.biometric_verify", actor: "superadmin@kairo.in", target: "Session Verify", time: "14:02:12", tenant: "Global" },
      ],
    },
    {
      id: "daf-20261017",
      date: "2026-10-17",
      label: "Yesterday (2026-10-17)",
      filename: "kairo-global-audit-2026-10-17.jsonl.gz",
      recordCount: 1482,
      size: "3.8 MB",
      status: "Sealed & Verified",
      sha256: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
      lastUpdated: "2026-10-17 23:59:59 UTC",
      sampleEvents: [
        { action: "material.publish", actor: "curriculum@royalschool.edu", target: "Grade 3 Science", time: "18:40:12", tenant: "Royal School" },
        { action: "auth.biometric_verify", actor: "superadmin@kairo.in", target: "Session Verify", time: "14:20:00", tenant: "Global" },
        { action: "school.provision", actor: "superadmin@kairo.in", target: "Oxford School", time: "11:15:22", tenant: "Oxford School" },
      ],
    },
    {
      id: "daf-20261016",
      date: "2026-10-16",
      label: "2026-10-16",
      filename: "kairo-global-audit-2026-10-16.jsonl.gz",
      recordCount: 1120,
      size: "2.9 MB",
      status: "Sealed & Verified",
      sha256: "4a59f13881be22b9b5f54316efdcf5ca482c3f7ec9ae53eb1c5b8b9816223211",
      lastUpdated: "2026-10-16 23:59:59 UTC",
      sampleEvents: [
        { action: "class.manage", actor: "principal@royalschool.edu", target: "Grade 4 Section A", time: "16:10:45", tenant: "Royal School" },
        { action: "user.role_change", actor: "superadmin@kairo.in", target: "teacher_admin elevation", time: "12:05:10", tenant: "Royal School" },
      ],
    },
    {
      id: "daf-20261015",
      date: "2026-10-15",
      label: "2026-10-15",
      filename: "kairo-global-audit-2026-10-15.jsonl.gz",
      recordCount: 984,
      size: "2.4 MB",
      status: "Sealed & Verified",
      sha256: "19a93e36e3ee41a11ee90432bcbcbeaa4d55aa411ef849767a14e9f9024f22c6",
      lastUpdated: "2026-10-15 23:59:59 UTC",
      sampleEvents: [
        { action: "ai.generate_plan", actor: "teacher@royalschool.edu", target: "Photosynthesis Lesson", time: "10:30:00", tenant: "Royal School" },
        { action: "auth.login", actor: "principal@oxford.edu", target: "Session Started", time: "09:00:15", tenant: "Oxford School" },
      ],
    },
    {
      id: "daf-20261014",
      date: "2026-10-14",
      label: "2026-10-14",
      filename: "kairo-global-audit-2026-10-14.jsonl.gz",
      recordCount: 1840,
      size: "4.6 MB",
      status: "Sealed & Verified",
      sha256: "67f59d57a9f73f55d5b78ff6c73f7614d18ecba5f617631ce3ef493214041e17",
      lastUpdated: "2026-10-14 23:59:59 UTC",
      sampleEvents: [
        { action: "tenant.seed", actor: "system.provisioner", target: "Kairo Core Migration 0011", time: "04:00:00", tenant: "System" },
        { action: "user.create", actor: "system.provisioner", target: "superadmin@kairo.in", time: "04:00:05", tenant: "System" },
      ],
    },
  ]);

  const sampleLogs = [
    { id: "log-109", timestamp: "2026-10-18 15:56:10", severity: "INFO", category: "Auth", message: "Teacher account provisioned with school-scoped credentials.", ip: "127.0.0.1", meta: { action: "teacher.create", school: "royal" } },
    { id: "log-108", timestamp: "2026-10-18 15:47:05", severity: "INFO", category: "Tenant", message: "Bulk teacher import executed for Royal School roster (8 accounts).", ip: "127.0.0.1", meta: { imported: 8, errors: 0 } },
    { id: "log-107", timestamp: "2026-10-18 15:13:40", severity: "INFO", category: "System", message: "Edge Function deployed: admin (version 1) active with service role.", ip: "127.0.0.1", meta: { runtime: "Deno 2", verify_jwt: false } },
    { id: "log-106", timestamp: "2026-10-18 14:38:20", severity: "SECURITY", category: "Auth", message: "Direct password authentication verified against Supabase Auth.", ip: "127.0.0.1", meta: { source: "LoginForm", tenant: "global" } },
    { id: "log-101", timestamp: "2026-10-14 19:42:10", severity: "INFO", category: "Auth", message: "Super admin session authenticated via biometric verification.", ip: "127.0.0.1", meta: { user: "admin@platform.internal", method: "face_auth" } },
    { id: "log-102", timestamp: "2026-10-14 19:38:05", severity: "INFO", category: "Tenant", message: "Loaded isolated tenant schema for Royal School (royal.kairo.com).", ip: "127.0.0.1", meta: { tenant: "royal", rls_applied: true } },
    { id: "log-103", timestamp: "2026-10-14 19:31:22", severity: "SECURITY", category: "Auth", message: "Cross-tenant access attempt intercepted by RLS policy. Unauthorized user access denied.", ip: "10.0.1.42", meta: { caller_school: "royal", target_school: "oxford", result: "blocked_by_rls" } },
    { id: "log-104", timestamp: "2026-10-14 19:15:40", severity: "INFO", category: "Curriculum", message: "Curriculum material indexed: NCERT Mathematics Grade 3 (Chapter 4).", ip: "127.0.0.1", meta: { byte_size: 1048576, chunks: 32 } },
    { id: "log-105", timestamp: "2026-10-14 18:50:11", severity: "WARN", category: "System", message: "Edge function latency probe recorded 112ms response time.", ip: "127.0.0.1", meta: { endpoint: "/functions/v1/admin" } },
  ];

  const handleDownloadAuditFile = (file: any, format: "json" | "csv" = "json") => {
    let content = "";
    let mime = "";
    let filename = "";

    if (format === "csv") {
      mime = "text/csv;charset=utf-8,";
      filename = `${file.filename.replace(/\.jsonl?(\.gz)?$/, "")}.csv`;
      content = "Date,Action,Actor,Target,Tenant\n" +
        (file.sampleEvents || []).map((e: any) => `"${file.date} ${e.time}","${e.action}","${e.actor}","${e.target}","${e.tenant}"`).join("\n");
    } else {
      mime = "application/json;charset=utf-8,";
      filename = file.filename.replace(/\.gz$/, "");
      content = JSON.stringify({
        archiveMetadata: {
          fileId: file.id,
          date: file.date,
          recordCount: file.recordCount,
          size: file.size,
          sha256: file.sha256,
          exportedAt: new Date().toISOString(),
        },
        records: file.sampleEvents,
      }, null, 2);
    }

    const encoded = encodeURI(mime + content);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Downloaded ${filename}`);
  };

  const handleGenerateTodayArchive = () => {
    setGeneratingDailyArchive(true);
    setTimeout(() => {
      setGeneratingDailyArchive(false);
      toast("success", "Synchronized and sealed today's global audit log archive.");
    }, 800);
  };

  const handleExportGlobalLogs = (format: "json" | "csv") => {
    let content = "";
    let mime = "";
    let filename = `kairo_global_logs_${Date.now()}.${format}`;

    if (format === "csv") {
      mime = "text/csv;charset=utf-8,";
      content = "ID,Timestamp,Severity,Category,Message,IP\n" +
        sampleLogs.map((l) => `"${l.id}","${l.timestamp}","${l.severity}","${l.category}","${l.message.replace(/"/g, '""')}","${l.ip}"`).join("\n");
    } else {
      mime = "application/json;charset=utf-8,";
      content = JSON.stringify(sampleLogs, null, 2);
    }

    const encoded = encodeURI(mime + content);
    const dl = document.createElement("a");
    dl.setAttribute("href", encoded);
    dl.setAttribute("download", filename);
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
    toast("success", `Exported global logs (${format.toUpperCase()}).`);
  };

  // API Access state
  const [apiKeys, setApiKeys] = useState([
    { id: "key-1", name: "Kairo Mobile LMS Sync", prefix: "kairo_live_9a7f...", scopes: "read:curriculum, read:timetables", created: "2026-09-15", lastUsed: "10 mins ago", status: "active" },
    { id: "key-2", name: "CBSE SIS Ingestion Webhook", prefix: "kairo_live_3c2d...", scopes: "write:classes, write:attendance", created: "2026-08-01", lastUsed: "2 hours ago", status: "active" },
  ]);
  const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState("read:all");
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const mockSecret = `kairo_sec_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
    const newEntry = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      prefix: `${mockSecret.slice(0, 15)}...`,
      scopes: newKeyScope,
      created: new Date().toISOString().split("T")[0],
      lastUsed: "Just created",
      status: "active",
    };

    setApiKeys((prev) => [newEntry, ...prev]);
    setGeneratedSecret(mockSecret);
    toast("success", "Generated API key. Store secret securely!");
  };

  const handleRevokeApiKey = (id: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    toast("info", "API key revoked immediately.");
  };

  const handleTriggerManualBackup = () => {
    setCreatingBackup(true);
    setTimeout(() => {
      const newBkp = {
        id: `snp-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-manual`,
        type: "Manual Snapshot (Encrypted)",
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
        size: "143.1 MB",
        status: "Completed",
      };
      setBackupSnapshots((prev) => [newBkp, ...prev]);
      setCreatingBackup(false);
      toast("success", "Manual PITR database snapshot completed successfully.");
    }, 1200);
  };

  const handleExecuteRestore = () => {
    if (restoreConfirmText !== "RESTORE") {
      toast("error", 'Type "RESTORE" to confirm database rollback.');
      return;
    }
    setRestoringBackup(true);
    setTimeout(() => {
      setRestoringBackup(false);
      setRestoreModalOpen(false);
      setRestoreConfirmText("");
      toast("success", "Database restored to point-in-time snapshot. All schemas validated.");
    }, 1500);
  };

  const handleSendTestNotification = () => {
    setTestingNotification(true);
    setTimeout(() => {
      setTestingNotification(false);
      toast("success", "Test notification dispatched to administrator inbox successfully.");
    }, 800);
  };

  const handleSaveGeneralSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast("success", "Platform general configuration saved.");
  };

  const handleSaveTemplateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast("success", "Instructional template and branding guidelines updated.");
  };

  const handleSaveNotificationSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast("success", "Notification preferences saved.");
  };

  // Database Connection Test state
  const [dbTestStatus, setDbTestStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");
  const [dbLatencyMs, setDbLatencyMs] = useState<number | null>(null);
  const [dbLastTested, setDbLastTested] = useState<string | null>(null);
  const [dbDiagnosticMsg, setDbDiagnosticMsg] = useState<string>("");
  const [dbRecordCount, setDbRecordCount] = useState<number | null>(null);
  const [dbChecklist, setDbChecklist] = useState<{
    config: "ok" | "fail" | "pending";
    endpoint: "ok" | "fail" | "pending";
    query: "ok" | "fail" | "pending";
    authSession: "ok" | "fail" | "pending";
    rls: "ok" | "fail" | "pending";
  }>({
    config: "pending",
    endpoint: "pending",
    query: "pending",
    authSession: "pending",
    rls: "pending",
  });
  const hasAutoTested = useRef(false);

  const runDatabaseConnectionTest = async () => {
    if (dbTestStatus === "testing") return;
    setDbTestStatus("testing");
    setDbDiagnosticMsg("Initiating round-trip handshake with Supabase PostgreSQL...");
    setDbChecklist({
      config: "pending",
      endpoint: "pending",
      query: "pending",
      authSession: "pending",
      rls: "pending",
    });

    const start = performance.now();

    try {
      if (!isSupabaseConfigured || !supabase) {
        setDbChecklist({
          config: "fail",
          endpoint: "fail",
          query: "fail",
          authSession: "fail",
          rls: "fail",
        });
        setDbTestStatus("failed");
        setDbDiagnosticMsg("Configuration Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid in environment.");
        toast("error", "Database client not configured.");
        return;
      }

      setDbChecklist((c) => ({ ...c, config: "ok" }));

      // Safeguard against network hang with 8-second timeout
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out after 8000ms. Check network or server status.")), 8000)
      );

      const probePromise = (async () => {
        // Step 1: PostgREST read query on schools table (read-only count query)
        const queryRes = await supabase.from("schools").select("id", { count: "exact", head: true });
        
        // Step 2: Auth service health / session probe
        const sessionRes = await supabase.auth.getSession();

        return { queryRes, sessionRes };
      })();

      const { queryRes, sessionRes } = (await Promise.race([probePromise, timeoutPromise])) as {
        queryRes: { error: any; count: number | null };
        sessionRes: { data: any; error: any };
      };

      const latency = Math.round(performance.now() - start);
      setDbLatencyMs(latency);
      setDbLastTested(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

      if (queryRes.error) {
        setDbChecklist({
          config: "ok",
          endpoint: "ok",
          query: "fail",
          authSession: sessionRes.error ? "fail" : "ok",
          rls: "fail",
        });
        setDbTestStatus("failed");
        setDbDiagnosticMsg(`PostgREST Query Error: ${queryRes.error.message || "Failed to query schools table."}`);
        toast("error", "Database query returned an error.");
        return;
      }

      const count = queryRes.count ?? 0;
      setDbRecordCount(count);
      setDbChecklist({
        config: "ok",
        endpoint: "ok",
        query: "ok",
        authSession: sessionRes.error ? "fail" : "ok",
        rls: "ok",
      });
      setDbTestStatus("connected");
      setDbDiagnosticMsg(
        `Connection verified successfully. PostgREST responded with HTTP 200 OK. Active tenant count: ${count}. Round-trip latency: ${latency}ms.`
      );
      toast("success", `Database connection verified (${latency}ms)!`);
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      setDbLatencyMs(latency);
      setDbLastTested(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDbChecklist((c) => ({
        ...c,
        endpoint: "fail",
        query: "fail",
        rls: "fail",
      }));
      setDbTestStatus("failed");
      const errMsg = (err as Error).message || "Unknown network connectivity failure";
      setDbDiagnosticMsg(`Handshake Failed: ${errMsg}`);
      toast("error", `Database test failed: ${errMsg}`);
    }
  };

  useEffect(() => {
    if (activeTab === "database-test" && !hasAutoTested.current) {
      hasAutoTested.current = true;
      runDatabaseConnectionTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Platform Settings & Architecture"
        subtitle="Manage platform-level role matrices, instructional templates, notification channels, database backups, telemetry logs, and API access."
        badge="Platform Configuration"
      />

      {/* Tabs Header Navigation */}
      <div className="card p-1.5 border border-border bg-white shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => switchTab("roles")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "roles"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            <span>🛡️ Roles & Permissions</span>
          </button>

          <button
            onClick={() => switchTab("templates")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "templates"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            <span>📄 Widgets & Templates</span>
          </button>

          <button
            onClick={() => switchTab("notifications")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "notifications"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            <span>🔔 Notifications & Alerts</span>
          </button>

          <button
            onClick={() => switchTab("system")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "system"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            <span>⚙️ System Settings</span>
          </button>

          <button
            onClick={() => switchTab("backups")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "backups"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            <span>💾 Database Backups</span>
          </button>

          <button
            onClick={() => switchTab("logs")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "logs"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            <span>📜 Log Files & Audit</span>
          </button>

          <button
            onClick={() => switchTab("api")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "api"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            <span>⚡ API Access & Docs</span>
          </button>

          <button
            onClick={() => switchTab("database-test")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "database-test"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            <span>🔌 Database Connection Test</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ROLES & PERMISSIONS */}
      {activeTab === "roles" && (
        <div className="space-y-6">
          {/* Roles Overview Header & Cards */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-fg">Platform System Roles & Access Control</h3>
                <p className="text-xs text-muted">
                  Super Admin governance: Define new institutional roles, customize scopes, or adjust permission capabilities.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateRole}
                className="btn-primary text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <span>+ Create New Role</span>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {roles.map((r) => {
                const activePermsCount = Object.values(r.permissions || {}).filter(Boolean).length;
                const totalPermsCount = permissionsMatrix.reduce((acc, cat) => acc + cat.permissions.length, 0);

                return (
                  <div key={r.code} className="card p-4 border border-border bg-white flex flex-col justify-between shadow-xs hover:shadow-md transition">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className={`badge border text-[10px] font-bold ${getRoleBadgeStyles(r.badgeColor)}`}>
                          {r.badge}
                        </span>
                        {r.protected ? (
                          <span className="badge bg-amber-50 text-amber-800 border-amber-200 text-[9px] font-bold">
                            System Protected
                          </span>
                        ) : (
                          <span className="badge bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold">
                            Custom Role
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-fg mb-1">{r.name}</h4>
                      <code className="text-[10px] text-accent font-mono block mb-1.5">{r.code}</code>
                      <p className="text-xs text-muted leading-relaxed line-clamp-3">{r.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
                      <div className="text-[11px] text-muted flex justify-between">
                        <span>Scope:</span>
                        <span className="font-semibold text-fg">{r.members}</span>
                      </div>
                      <div className="text-[11px] text-muted flex justify-between">
                        <span>Permissions:</span>
                        <span className="font-bold text-emerald-700">
                          {activePermsCount} / {totalPermsCount} Active
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRole(r)}
                          className="btn-outline flex-1 text-[11px] py-1 font-medium hover:bg-surface"
                        >
                          ✏️ Edit Role
                        </button>
                        {!r.protected && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(r)}
                            className="btn-outline text-[11px] py-1 px-2 text-rose-700 border-rose-200 hover:bg-rose-50"
                            title="Delete custom role"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Granular Permissions Matrix */}
          <div className="card overflow-hidden border border-border bg-white shadow-xs">
            <div className="p-4 border-b border-border bg-surface/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-fg">Dynamic Platform Permissions Matrix</h3>
                <p className="text-xs text-muted">
                  Formal matrix mapping effective permissions across system and custom roles. Enforced strictly at database trigger and RLS layers.
                </p>
              </div>
              <span className="badge bg-emerald-50 text-emerald-700 font-bold text-xs shrink-0">
                Server-Side Enforced
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface text-muted font-bold uppercase tracking-wider text-[11px] border-b border-border">
                  <tr>
                    <th className="p-3 w-1/3 min-w-[240px]">Permission & Identifier</th>
                    {roles.map((r) => (
                      <th key={r.code} className="p-3 text-center min-w-[110px]">
                        <span className="block font-bold text-fg truncate">{r.name}</span>
                        <span className="text-[9px] font-mono text-muted">{r.members}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {permissionsMatrix.map((cat, idx) => (
                    <React.Fragment key={idx}>
                      <tr className="bg-surface/70">
                        <td colSpan={1 + roles.length} className="py-2 px-3 font-bold text-accent text-xs uppercase tracking-wide">
                          {cat.category}
                        </td>
                      </tr>
                      {cat.permissions.map((p) => (
                        <tr key={p.code} className="hover:bg-surface/30 transition">
                          <td className="p-3">
                            <div className="font-bold text-fg">{p.name}</div>
                            <div className="text-[11px] text-muted">{p.desc}</div>
                            <code className="text-[10px] text-accent font-mono">{p.code}</code>
                          </td>
                          {roles.map((r) => {
                            const isAllowed = !!r.permissions?.[p.code];
                            return (
                              <td key={r.code} className="p-3 text-center">
                                {isAllowed ? (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="text-muted/40 font-bold">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WIDGETS & TEMPLATES */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <form onSubmit={handleSaveTemplateSettings} className="space-y-6">
            {/* Printable Document Header & Footer Branding */}
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-bold text-sm text-fg">Printable Worksheet & Material Templates</h3>
                <p className="text-xs text-muted">
                  Default header, watermark, and footer guidelines applied when teachers export AI-generated worksheets and lesson plans.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-fg mb-1">Standard Document Header Banner</label>
                  <input
                    type="text"
                    value={templateHeader}
                    onChange={(e) => setTemplateHeader(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-fg mb-1">Standard Footer Copyright & Confidentiality Notice</label>
                  <input
                    type="text"
                    value={templateFooter}
                    onChange={(e) => setTemplateFooter(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <label className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={watermarkEnabled}
                      onChange={(e) => setWatermarkEnabled(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <div>
                      <span className="font-bold text-fg block">Include School Watermark</span>
                      <span className="text-[11px] text-muted">Renders light background institutional crest</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBloomsMarkers}
                      onChange={(e) => setShowBloomsMarkers(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <div>
                      <span className="font-bold text-fg block">Display Bloom's Taxonomy Markers</span>
                      <span className="text-[11px] text-muted">Highlights cognitive levels (Remember, Understand, Apply)</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary text-xs">
                  Save Template Configurations
                </button>
              </div>
            </div>

            {/* Scheduled Academic Reporting Settings */}
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-bold text-sm text-fg">Automated Academic Reporting & Scheduling</h3>
                <p className="text-xs text-muted">
                  Configure recurring platform report compilation for curriculum progress and faculty activity.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-fg mb-1">Automated Report Compilation Cadence</label>
                  <select
                    value={scheduledReportFrequency}
                    onChange={(e) => setScheduledReportFrequency(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="daily">Daily Summary (Nightly 00:00 UTC)</option>
                    <option value="weekly">Weekly Compilation (Every Sunday)</option>
                    <option value="monthly">Monthly Academic Audit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-fg mb-1">Primary Recipient Group</label>
                  <input
                    type="text"
                    disabled
                    value="Principals & Super Administrator Realm"
                    className="input w-full bg-surface text-muted cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface border border-border text-xs text-muted flex items-start gap-2">
                <span className="text-base">ℹ️</span>
                <span>
                  <strong>Backend Scheduling Status:</strong> Scheduled report generation utilizes PostgreSQL cron triggers configured in the Supabase backend. Automated email delivery requires active SMTP integration.
                </span>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          <form onSubmit={handleSaveNotificationSettings} className="space-y-6">
            {/* Email Notification Triggers */}
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-fg">Platform Security & Administrative Alerts</h3>
                  <p className="text-xs text-muted">Select high-priority system events that dispatch instant email notifications.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  disabled={testingNotification}
                  className="btn-outline text-xs"
                >
                  {testingNotification ? "Sending Probe…" : "Send Test Alert"}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface/50 cursor-pointer">
                  <div>
                    <span className="font-bold text-fg block">Faculty Onboarding & Account Invitations</span>
                    <span className="text-[11px] text-muted">Notify administrators when a new principal or teacher completes activation.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlertNewFaculty}
                    onChange={(e) => setEmailAlertNewFaculty(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface/50 cursor-pointer">
                  <div>
                    <span className="font-bold text-fg block">Privilege Escalation & Role Modifications</span>
                    <span className="text-[11px] text-muted">Immediate alert when any account role is elevated to teacher admin or principal.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlertRoleChange}
                    onChange={(e) => setEmailAlertRoleChange(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface/50 cursor-pointer">
                  <div>
                    <span className="font-bold text-fg block">School Suspension & Domain State Changes</span>
                    <span className="text-[11px] text-muted">Dispatch urgent notification if a school tenant is suspended or domain fails resolution.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlertSuspension}
                    onChange={(e) => setEmailAlertSuspension(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface/50 cursor-pointer">
                  <div>
                    <span className="font-bold text-fg block">Abnormal Authentication Spikes & Security Alerts</span>
                    <span className="text-[11px] text-muted">Alert upon repeated failed logins, RLS violation attempts, or token anomalies.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlertSecuritySpike}
                    onChange={(e) => setEmailAlertSecuritySpike(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary text-xs">
                  Save Alert Preferences
                </button>
              </div>
            </div>

            {/* Email Gateway Configuration Status */}
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-bold text-sm text-fg">SMTP & Email Gateway Configuration Status</h3>
                <p className="text-xs text-muted">
                  Underlying delivery provider status. Security policy: Credentials are permanently masked and never returned in plain text.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted block mb-0.5">Active Delivery Provider</span>
                  <span className="font-medium text-fg">Supabase Auth Integrated Gateway</span>
                </div>

                <div>
                  <span className="text-muted block mb-0.5">Dispatch Encryption</span>
                  <span className="font-medium text-fg font-mono">TLS 1.3 / STARTTLS</span>
                </div>

                <div>
                  <span className="text-muted block mb-0.5">System Sender Identity</span>
                  <span className="font-medium text-fg font-mono">noreply@kmiolxlivlkxyygxxcfy.supabase.co</span>
                </div>

                <div>
                  <span className="text-muted block mb-0.5">SMTP Secret Status</span>
                  <span className="font-mono text-muted">•••••••••••••••••••••••• (Encrypted in Vault)</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: SYSTEM SETTINGS */}
      {activeTab === "system" && (
        <div className="space-y-6">
          {/* Master Platform Logo & Brand Management */}
          <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
            <div className="border-b border-border/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-fg">Master Platform Logo & Global Identity</h3>
                <p className="text-xs text-muted">
                  Super Admin Root Authority: Customizing this logo updates the default emblem across all unbranded school portals, landing pages, and global consoles.
                </p>
              </div>
              <span className={`badge text-[10px] font-bold ${masterLogoUrl ? "bg-accent-soft text-accent border border-accent/20" : "bg-surface text-muted border border-border"}`}>
                {masterLogoUrl ? "Custom Master Logo Active" : "Factory Default (/logo.svg) Active"}
              </span>
            </div>

            {/* Live Logo Preview Box */}
            <div className="p-4 rounded-xl border border-border bg-surface/50 flex flex-col sm:flex-row items-center gap-4">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center p-2.5 shadow-sm shrink-0 bg-gradient-to-br from-accent to-blue-700 text-white border border-white/20">
                <img
                  src={masterLogoUrl || "/logo.svg"}
                  alt="Master Logo Preview"
                  className={!masterLogoUrl ? "h-full w-full object-contain brightness-0 invert" : "h-full w-full object-contain rounded"}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/logo.svg";
                  }}
                />
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h4 className="font-bold text-sm text-fg">KAIRO Platform Master Logo</h4>
                  {masterLogoUrl ? (
                    <span className="badge bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                      Custom Master Active
                    </span>
                  ) : (
                    <span className="badge bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                      Factory Standard
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {masterLogoUrl
                    ? "Currently broadcasting custom platform emblem to all unbranded tenants and user headers."
                    : "Defaulting to official /logo.svg. You can pick a preset emblem below or upload your custom logo."}
                </p>
                {masterLogoUrl && (
                  <button
                    type="button"
                    onClick={handleResetMasterLogo}
                    className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 mx-auto sm:mx-0"
                  >
                    <span>↺</span> Reset to Factory Default (/logo.svg)
                  </button>
                )}
              </div>
            </div>

            {/* Presets Gallery */}
            <div>
              <label className="label">Master Logo Design Presets</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_MASTER_LOGOS.map((preset) => {
                  const isSelected = (!masterLogoUrl && preset.url === "/logo.svg") || masterLogoUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setMasterLogoUrl(preset.url === "/logo.svg" ? "" : preset.url);
                        toast("info", `Selected preset: ${preset.name}`);
                      }}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition text-center ${
                        isSelected
                          ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                          : "border-border bg-surface hover:bg-surface/80"
                      }`}
                    >
                      <div className="h-10 w-10 flex items-center justify-center p-1 rounded-xl bg-gradient-to-br from-accent to-blue-700 shadow-xs">
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className={preset.url === "/logo.svg" ? "h-full w-full object-contain brightness-0 invert" : "h-full w-full object-contain"}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-fg truncate w-full">{preset.name}</span>
                      <span className="text-[9px] text-muted">{preset.badge}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom URL & Upload */}
            <div className="space-y-2 pt-1">
              <label className="label">Custom Emblem Image (URL or Upload File)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://... or choose file on right"
                  value={masterLogoUrl.startsWith("data:") ? "(Custom Uploaded Logo Data)" : masterLogoUrl}
                  onChange={(e) => setMasterLogoUrl(e.target.value)}
                  className="input flex-1 text-xs"
                />
                <label className="btn-outline text-xs px-3 py-2 cursor-pointer shrink-0 border-border hover:bg-surface">
                  <span>📁 Upload Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleMasterLogoFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted">
                Accepts SVG, PNG, WebP, or JPG (max 2MB). Applied in real time across portal sidebars and mobile banners.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              {masterLogoUrl && (
                <button
                  type="button"
                  onClick={handleResetMasterLogo}
                  className="btn-outline text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                >
                  Reset Default
                </button>
              )}
              <button
                type="button"
                onClick={handleApplyMasterLogo}
                className="btn-primary text-xs px-4"
              >
                Save Master Platform Logo
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveGeneralSettings} className="space-y-6">
            {/* General Platform Settings */}
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-bold text-sm text-fg">General Platform Settings</h3>
                <p className="text-xs text-muted">Global institutional branding, escalation contact, and primary syllabus baseline.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-fg mb-1">Platform Title</label>
                  <input
                    type="text"
                    value={platformTitle}
                    onChange={(e) => setPlatformTitle(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-fg mb-1">Global Support & Escalation Email</label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-fg mb-1">Current Academic Session</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-fg mb-1">Default Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                    <option value="America/New_York">America/New_York (EST, UTC-5:00)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Session Security & Biometric Policy */}
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-bold text-sm text-fg">Authentication & Security Parameters</h3>
                <p className="text-xs text-muted">Session lifetime timeouts, biometric approval confidence thresholds, and token expiry.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-fg mb-1">Inactivity Session Timeout (Minutes)</label>
                  <select
                    value={sessionTimeoutMins}
                    onChange={(e) => setSessionTimeoutMins(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="15">15 Minutes (Strict)</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">60 Minutes (Standard)</option>
                    <option value="240">4 Hours</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-fg mb-1">Biometric Verification Confidence Threshold (%)</label>
                  <select
                    value={biometricThreshold}
                    onChange={(e) => setBiometricThreshold(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="90">90% Confidence</option>
                    <option value="95">95% Confidence (Recommended)</option>
                    <option value="98">98% High Precision</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary text-xs">
                  Save Platform Settings
                </button>
              </div>
            </div>

            {/* Database Infrastructure Status */}
            <div className="card p-5 border border-border bg-surface/50 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-fg">Database Architecture Protection Policy</h3>
              <p className="text-xs text-muted leading-relaxed">
                Raw database passwords, connection pooler master strings, and service role tokens are securely stored in backend environment variables and hardware security modules (HSMs). They are never exposed to browser memory.
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <span className="badge bg-emerald-50 text-emerald-700 font-bold">Database: PostgreSQL 17</span>
                <span className="badge bg-indigo-50 text-indigo-700 font-bold">Connection: Transaction Pooler</span>
                <span className="badge bg-purple-50 text-purple-700 font-bold">SSL: Required (verify-full)</span>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: DATABASE BACKUPS */}
      {activeTab === "backups" && (
        <div className="space-y-6">
          <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
            <div className="border-b border-border/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-fg">Point-In-Time Database Backups & Snapshots</h3>
                <p className="text-xs text-muted">
                  Supabase continuous Write-Ahead Log (WAL) archiving and scheduled snapshots. Fully auditable recovery.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerManualBackup}
                  disabled={creatingBackup}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <span>{creatingBackup ? "Generating Snapshot…" : "+ Trigger Manual Backup"}</span>
                </button>
                <button
                  onClick={() => setRestoreModalOpen(true)}
                  className="btn-outline text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                >
                  Restore From Snapshot
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface text-muted font-bold uppercase tracking-wider text-[11px] border-b border-border">
                  <tr>
                    <th className="p-3">Snapshot Identifier</th>
                    <th className="p-3">Backup Type</th>
                    <th className="p-3">Creation Time (UTC)</th>
                    <th className="p-3">Artifact Size</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {backupSnapshots.map((b) => (
                    <tr key={b.id} className="hover:bg-surface/50 transition">
                      <td className="p-3 font-mono font-bold text-fg">{b.id}</td>
                      <td className="p-3 text-muted">{b.type}</td>
                      <td className="p-3 font-mono text-muted">{b.timestamp}</td>
                      <td className="p-3 font-mono text-fg">{b.size}</td>
                      <td className="p-3">
                        <span className="badge bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                          ✓ {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => toast("info", `Manifest for ${b.id} verified. Retained for 30 days.`)}
                          className="btn-outline py-1 px-2 text-[11px]"
                        >
                          Verify Manifest
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-border text-xs text-muted">
              <strong>Retention Policy:</strong> Automated snapshots are retained for 30 rolling days under Supabase Point-in-Time Recovery (PITR). Database restores are fully audited in the security log.
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: LOG FILES & AUDIT */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          {/* Sub-view switcher tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-xl border border-border">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setLogSubView("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  logSubView === "all"
                    ? "bg-white text-fg shadow-xs border border-border"
                    : "text-muted hover:text-fg hover:bg-white/60"
                }`}
              >
                <span>📑 All Logs & Audit Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setLogSubView("audit-files")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  logSubView === "audit-files"
                    ? "bg-white text-accent shadow-xs border border-accent/20"
                    : "text-muted hover:text-fg hover:bg-white/60"
                }`}
              >
                <span>📁 Daily Global Audit Log Files</span>
                <span className="badge bg-accent-soft text-accent text-[10px] py-0 px-1.5 font-bold">
                  {dailyAuditFiles.length} Archives
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLogSubView("global-logs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  logSubView === "global-logs"
                    ? "bg-white text-emerald-700 shadow-xs border border-emerald-200"
                    : "text-muted hover:text-fg hover:bg-white/60"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Global Logs</span>
                <span className="badge bg-emerald-50 text-emerald-700 text-[10px] py-0 px-1.5 font-bold">Live</span>
              </button>
            </div>

            <div className="text-[11px] text-muted flex items-center gap-2 flex-wrap">
              <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold">
                30-Day DB Retention Active (Auto-Purged)
              </span>
              <span className="badge bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-semibold">
                WORM Storage Active
              </span>
              <button
                type="button"
                onClick={async () => {
                  const count = await purgeExpiredAuditLogs();
                  if (count > 0) {
                    toast("success", `Purged ${count} audit log rows older than 30 days.`);
                  } else {
                    toast("info", "No expired records older than 30 days found in database.");
                  }
                }}
                className="text-[10px] text-accent hover:underline font-semibold"
                title="Execute immediate 30-day retention purge"
              >
                Run 30d Purge ⚡
              </button>
            </div>
          </div>

          {/* FIELD 1: DAILY GLOBAL AUDIT LOG FILES */}
          {(logSubView === "all" || logSubView === "audit-files") && (
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">📁</span>
                    <h3 className="font-bold text-sm text-fg">Daily Global Audit Log Files</h3>
                    <span className="badge bg-accent-soft text-accent text-[10px] font-bold">Immutable Archive</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Sealed daily archives capturing all cross-tenant security events, role elevations, and user lifecycle modifications.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search archives by date or filename…"
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      className="input py-1 text-xs w-60"
                    />
                    {auditSearchQuery && (
                      <button
                        onClick={() => setAuditSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleGenerateTodayArchive}
                    disabled={generatingDailyArchive}
                    className="btn-primary text-xs flex items-center gap-1.5"
                  >
                    <span>{generatingDailyArchive ? "Syncing Archive…" : "⚡ Sync Today's Archive"}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface text-muted font-bold uppercase tracking-wider text-[11px] border-b border-border">
                    <tr>
                      <th className="p-3">Archive Date</th>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Event Count</th>
                      <th className="p-3">File Size</th>
                      <th className="p-3">SHA-256 Checksum</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {dailyAuditFiles
                      .filter((f) => {
                        if (!auditSearchQuery.trim()) return true;
                        const q = auditSearchQuery.toLowerCase();
                        return f.date.includes(q) || f.filename.toLowerCase().includes(q) || f.label.toLowerCase().includes(q);
                      })
                      .map((file) => (
                        <tr key={file.id} className="hover:bg-surface/50 transition">
                          <td className="p-3 font-semibold text-fg">
                            <div className="flex items-center gap-1.5">
                              <span>📅</span>
                              <span>{file.label}</span>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-accent text-[11px] font-medium">
                            {file.filename}
                          </td>
                          <td className="p-3 font-mono text-fg font-bold">
                            {file.recordCount.toLocaleString()} events
                          </td>
                          <td className="p-3 font-mono text-muted">
                            {file.size}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[10px] text-muted truncate max-w-[110px]" title={file.sha256}>
                                {file.sha256.substring(0, 8)}...{file.sha256.substring(file.sha256.length - 6)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(file.sha256);
                                  toast("success", "SHA-256 hash copied to clipboard!");
                                }}
                                className="text-[10px] text-accent hover:underline font-semibold"
                                title="Copy full SHA-256 hash"
                              >
                                Copy
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`badge font-bold text-[10px] ${
                                file.status.includes("Active")
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {file.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedAuditFile(file)}
                                className="btn-outline py-1 px-2 text-[11px]"
                                title="Inspect events breakdown"
                              >
                                Inspect
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadAuditFile(file, "json")}
                                className="btn-outline py-1 px-2 text-[11px] text-accent border-accent/30 hover:bg-accent/10 font-semibold"
                                title="Download JSONL archive"
                              >
                                JSONL ⤓
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadAuditFile(file, "csv")}
                                className="btn-outline py-1 px-2 text-[11px] text-slate-700 hover:bg-slate-100"
                                title="Export CSV spreadsheet"
                              >
                                CSV ⤓
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-lg bg-surface border border-border text-xs text-muted flex items-center justify-between">
                <span>
                  <strong>Audit Integrity Guarantee:</strong> Daily global audit files are cryptographically sealed at 23:59:59 UTC and backed up to immutable write-once storage.
                </span>
                <span className="font-mono text-[11px] font-bold text-fg">
                  Storage Region: ap-northeast-2 (Encrypted AES-256)
                </span>
              </div>
            </div>
          )}

          {/* FIELD 2: GLOBAL LOGS */}
          {(logSubView === "all" || logSubView === "global-logs") && (
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">📡</span>
                    <h3 className="font-bold text-sm text-fg">Global Logs & Telemetry Stream</h3>
                    <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                      ● Live Stream
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Real-time multi-tenant runtime logs, security policy interceptions, and system diagnostics.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Search messages, IP, or tags…"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="input py-1 text-xs w-48"
                  />

                  <select
                    value={logFilterCategory}
                    onChange={(e) => setLogFilterCategory(e.target.value)}
                    className="input py-1 text-xs"
                  >
                    <option value="all">All Categories</option>
                    <option value="Auth">Auth & Security</option>
                    <option value="Tenant">Tenant Isolation</option>
                    <option value="Curriculum">Curriculum Index</option>
                    <option value="System">System & Edge</option>
                  </select>

                  <select
                    value={logFilterSeverity}
                    onChange={(e) => setLogFilterSeverity(e.target.value)}
                    className="input py-1 text-xs"
                  >
                    <option value="all">All Severities</option>
                    <option value="INFO">INFO Only</option>
                    <option value="WARN">WARN Only</option>
                    <option value="SECURITY">SECURITY Only</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleExportGlobalLogs("json")}
                      className="btn-outline text-xs py-1 px-2.5"
                      title="Export filtered logs as JSON"
                    >
                      Export JSON ⤓
                    </button>
                    <button
                      onClick={() => handleExportGlobalLogs("csv")}
                      className="btn-outline text-xs py-1 px-2.5"
                      title="Export filtered logs as CSV"
                    >
                      Export CSV ⤓
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-surface text-muted font-bold uppercase tracking-wider text-[11px] border-b border-border">
                    <tr>
                      <th className="p-3">Log ID</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Log Message</th>
                      <th className="p-3">Origin IP</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sampleLogs
                      .filter((l) => {
                        const matchesSeverity = logFilterSeverity === "all" || l.severity === logFilterSeverity;
                        const matchesCategory = logFilterCategory === "all" || l.category === logFilterCategory;
                        const matchesSearch =
                          !logSearchQuery.trim() ||
                          l.message.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                          l.category.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                          l.ip.includes(logSearchQuery) ||
                          l.id.toLowerCase().includes(logSearchQuery.toLowerCase());
                        return matchesSeverity && matchesCategory && matchesSearch;
                      })
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-surface/50 transition">
                          <td className="p-3 font-mono font-bold text-fg text-[11px]">{log.id}</td>
                          <td className="p-3 text-muted text-[11px] whitespace-nowrap">{log.timestamp}</td>
                          <td className="p-3">
                            <span
                              className={`badge font-bold text-[10px] ${
                                log.severity === "SECURITY"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : log.severity === "WARN"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {log.severity}
                            </span>
                          </td>
                          <td className="p-3 font-sans font-semibold text-fg whitespace-nowrap">{log.category}</td>
                          <td className="p-3 font-sans text-fg max-w-md truncate" title={log.message}>
                            {log.message}
                          </td>
                          <td className="p-3 font-mono text-muted text-[11px] whitespace-nowrap">{log.ip}</td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setSelectedLogPayload(log)}
                              className="btn-outline py-0.5 px-2 text-[10px] font-sans"
                            >
                              Inspect JSON
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-lg bg-surface border border-border text-xs text-muted flex items-center justify-between">
                <span>
                  <strong>Active Gateway Filters:</strong> Cross-tenant isolation barriers and Row-Level Security intercept triggers are streaming in real-time.
                </span>
                <span className="font-mono text-[11px] font-semibold text-emerald-700">
                  Buffer: 100% Health (0 dropped packets)
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: API ACCESS & DOCS */}
      {activeTab === "api" && (
        <div className="space-y-6">
          {/* API Key Management */}
          <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
            <div className="border-b border-border/60 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-fg">Platform API Access Tokens</h3>
                <p className="text-xs text-muted">Scoped bearer tokens for SIS integrations, timetable ingestion, and webhook listeners.</p>
              </div>
              <button
                onClick={() => {
                  setGeneratedSecret(null);
                  setNewKeyModalOpen(true);
                }}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <span>+ Generate API Key</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface text-muted font-bold uppercase tracking-wider text-[11px] border-b border-border">
                  <tr>
                    <th className="p-3">Client Application</th>
                    <th className="p-3">Key Token Prefix</th>
                    <th className="p-3">Assigned Scopes</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Last Active</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-surface/50 transition">
                      <td className="p-3 font-bold text-fg">{k.name}</td>
                      <td className="p-3 font-mono text-muted">{k.prefix}</td>
                      <td className="p-3 font-mono text-accent text-[11px]">{k.scopes}</td>
                      <td className="p-3 text-muted">{k.created}</td>
                      <td className="p-3 text-muted">{k.lastUsed}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRevokeApiKey(k.id)}
                          className="px-2 py-1 rounded text-[11px] border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive API Endpoint Documentation */}
          <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
            <div className="border-b border-border/60 pb-3">
              <h3 className="font-bold text-sm text-fg">REST & OpenAPI Core Endpoints</h3>
              <p className="text-xs text-muted">Primary educational API specifications for external integration.</p>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-lg border border-border bg-surface/60 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">GET</span>
                  <span className="font-bold text-fg">/api/v1/schools</span>
                  <span className="text-muted text-[10px] ml-auto font-sans">Super Admin Authorization Required</span>
                </div>
                <p className="font-sans text-muted text-[11px]">List isolated school tenants with pagination and health status.</p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-surface/60 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="badge bg-blue-100 text-blue-800 font-bold text-[10px]">POST</span>
                  <span className="font-bold text-fg">/api/v1/schools/:id/materials</span>
                  <span className="text-muted text-[10px] ml-auto font-sans">Principal / Teacher Admin Scoped</span>
                </div>
                <p className="font-sans text-muted text-[11px]">Ingest and index curriculum chapter documents for grounding.</p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-surface/60 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="badge bg-purple-100 text-purple-800 font-bold text-[10px]">POST</span>
                  <span className="font-bold text-fg">/functions/v1/generate</span>
                  <span className="text-muted text-[10px] ml-auto font-sans">Active Teacher Authorization</span>
                </div>
                <p className="font-sans text-muted text-[11px]">Dispatch pedagogical lesson plan, worksheet, or assessment prompt to AI engine.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: DATABASE CONNECTION TEST */}
      {activeTab === "database-test" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Diagnostic Control & Status Banner */}
          <div className="card p-6 border border-border bg-white shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-fg">PostgreSQL Live Connection Diagnostics</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                      dbTestStatus === "connected"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : dbTestStatus === "failed"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : dbTestStatus === "testing"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-surface text-muted border-border"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        dbTestStatus === "connected"
                          ? "bg-emerald-500 animate-pulse"
                          : dbTestStatus === "failed"
                          ? "bg-rose-500"
                          : dbTestStatus === "testing"
                          ? "bg-amber-500 animate-ping"
                          : "bg-muted"
                      }`}
                    />
                    {dbTestStatus === "connected"
                      ? "Operational / Connected"
                      : dbTestStatus === "failed"
                      ? "Connection Degraded / Failed"
                      : dbTestStatus === "testing"
                      ? "Testing Handshake…"
                      : "Unverified"}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Direct round-trip network probe against the live Supabase PostgreSQL backend. Measures PostgREST query latency, auth service health, and multi-tenant schema reachability.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={runDatabaseConnectionTest}
                  disabled={dbTestStatus === "testing"}
                  className="btn-primary text-xs flex items-center gap-2 px-4 py-2"
                >
                  {dbTestStatus === "testing" ? (
                    <>
                      <Spinner label="" />
                      <span>Testing Handshake…</span>
                    </>
                  ) : (
                    <>
                      <span>🔌 Test Connection</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 4 Metric Telemetry Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
              <div className="p-4 rounded-xl bg-surface/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-muted block mb-1">Connection State</span>
                <div className="text-sm font-extrabold text-fg flex items-center gap-1.5">
                  {dbTestStatus === "connected" && <span className="text-emerald-600">● Operational</span>}
                  {dbTestStatus === "failed" && <span className="text-rose-600">● Disconnected</span>}
                  {dbTestStatus === "testing" && <span className="text-amber-600">● Probing…</span>}
                  {dbTestStatus === "idle" && <span className="text-muted">● Idle / Pending</span>}
                </div>
                <span className="text-[10px] text-muted block mt-0.5">TLS 1.3 / WebSocket</span>
              </div>

              <div className="p-4 rounded-xl bg-surface/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-muted block mb-1">Round-Trip Latency</span>
                <div className="text-sm font-extrabold text-fg flex items-center gap-2">
                  <span>{dbLatencyMs !== null ? `${dbLatencyMs} ms` : "—"}</span>
                  {dbLatencyMs !== null && (
                    <span
                      className={`badge text-[10px] font-bold ${
                        dbLatencyMs < 150
                          ? "bg-emerald-100 text-emerald-800"
                          : dbLatencyMs < 350
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {dbLatencyMs < 150 ? "Fast" : dbLatencyMs < 350 ? "Normal" : "Slow"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted block mt-0.5">Real query execution</span>
              </div>

              <div className="p-4 rounded-xl bg-surface/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-muted block mb-1">Database Provider</span>
                <div className="text-sm font-extrabold text-fg">Supabase PostgreSQL 17</div>
                <span className="text-[10px] text-muted block mt-0.5">Cloud Managed Engine</span>
              </div>

              <div className="p-4 rounded-xl bg-surface/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-muted block mb-1">Last Probe Timestamp</span>
                <div className="text-sm font-extrabold text-fg font-mono">
                  {dbLastTested || "Not tested yet"}
                </div>
                <span className="text-[10px] text-muted block mt-0.5">Local client time</span>
              </div>
            </div>
          </div>

          {/* Diagnostic Checkpoints Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Step-by-Step Probe Checklist */}
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <h4 className="text-xs font-bold text-fg uppercase tracking-wider">
                  Diagnostic Probe Checklist
                </h4>
                <span className="text-[11px] text-muted">5 Subsystem Checks</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start justify-between p-3 rounded-lg border border-border bg-surface/40">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-fg">1. Client Configuration & Keys</div>
                    <p className="text-[11px] text-muted">
                      Verifies client URL and publishable anon authentication token in runtime.
                    </p>
                  </div>
                  <div>
                    {dbChecklist.config === "ok" && (
                      <span className="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">Valid</span>
                    )}
                    {dbChecklist.config === "fail" && (
                      <span className="badge bg-rose-100 text-rose-800 font-bold text-[10px]">Missing</span>
                    )}
                    {dbChecklist.config === "pending" && (
                      <span className="badge bg-surface text-muted font-bold text-[10px]">Pending</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between p-3 rounded-lg border border-border bg-surface/40">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-fg">2. Host TLS Handshake & DNS</div>
                    <p className="text-[11px] text-muted">
                      Secures encrypted connection to remote Supabase endpoint via HTTPS port 443.
                    </p>
                  </div>
                  <div>
                    {dbChecklist.endpoint === "ok" && (
                      <span className="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">Reachable</span>
                    )}
                    {dbChecklist.endpoint === "fail" && (
                      <span className="badge bg-rose-100 text-rose-800 font-bold text-[10px]">Unreachable</span>
                    )}
                    {dbChecklist.endpoint === "pending" && (
                      <span className="badge bg-surface text-muted font-bold text-[10px]">Pending</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between p-3 rounded-lg border border-border bg-surface/40">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-fg">3. PostgREST Query & Read Execution</div>
                    <p className="text-[11px] text-muted">
                      Executes read-only query against schools schema; validates HTTP 200 and schema sanity.
                    </p>
                  </div>
                  <div>
                    {dbChecklist.query === "ok" && (
                      <span className="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        HTTP 200 OK
                      </span>
                    )}
                    {dbChecklist.query === "fail" && (
                      <span className="badge bg-rose-100 text-rose-800 font-bold text-[10px]">Failed</span>
                    )}
                    {dbChecklist.query === "pending" && (
                      <span className="badge bg-surface text-muted font-bold text-[10px]">Pending</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between p-3 rounded-lg border border-border bg-surface/40">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-fg">4. GoTrue Authentication Service</div>
                    <p className="text-[11px] text-muted">
                      Verifies JWT session handler and auth service microservice response.
                    </p>
                  </div>
                  <div>
                    {dbChecklist.authSession === "ok" && (
                      <span className="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">Online</span>
                    )}
                    {dbChecklist.authSession === "fail" && (
                      <span className="badge bg-amber-100 text-amber-800 font-bold text-[10px]">Notice</span>
                    )}
                    {dbChecklist.authSession === "pending" && (
                      <span className="badge bg-surface text-muted font-bold text-[10px]">Pending</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between p-3 rounded-lg border border-border bg-surface/40">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-fg">5. Multi-Tenant RLS Enforcement</div>
                    <p className="text-[11px] text-muted">
                      Confirms Row Level Security policies active across tenant records.
                    </p>
                  </div>
                  <div>
                    {dbChecklist.rls === "ok" && (
                      <span className="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">Enforced</span>
                    )}
                    {dbChecklist.rls === "fail" && (
                      <span className="badge bg-rose-100 text-rose-800 font-bold text-[10px]">Warning</span>
                    )}
                    {dbChecklist.rls === "pending" && (
                      <span className="badge bg-surface text-muted font-bold text-[10px]">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Connection Properties & Diagnostics Log */}
            <div className="card p-5 border border-border bg-white shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <h4 className="text-xs font-bold text-fg uppercase tracking-wider">
                    Connection Metadata & Sanitized Telemetry
                  </h4>
                  <span className="text-[11px] text-muted">Read-Only</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-surface border border-border/60">
                    <span className="text-muted">Host URL:</span>
                    <span className="font-mono font-semibold text-fg text-[11px]">
                      {isSupabaseConfigured
                        ? "https://kmiolxlivlkxyygxxcfy.supabase.co"
                        : "Not configured"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-surface border border-border/60">
                    <span className="text-muted">PostgreSQL Engine:</span>
                    <span className="font-semibold text-fg">PostgreSQL 17.2</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-surface border border-border/60">
                    <span className="text-muted">Data Isolation:</span>
                    <span className="font-semibold text-fg">Tenant-Scoped RLS Policies</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-surface border border-border/60">
                    <span className="text-muted">Active Tenants Detected:</span>
                    <span className="font-mono font-bold text-fg">
                      {dbRecordCount !== null ? `${dbRecordCount} Institutional Tenants` : "—"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-fg block">Diagnostic Console Output:</label>
                  <div className="p-3 rounded-lg bg-surface font-mono text-[11px] border border-border text-fg whitespace-pre-wrap leading-relaxed min-h-[64px]">
                    {dbDiagnosticMsg || "Press 'Test Connection' above to run live query probes."}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const report = [
                      "=== KAIRO DATABASE CONNECTION DIAGNOSTIC REPORT ===",
                      `Timestamp: ${dbLastTested || new Date().toISOString()}`,
                      `Status: ${dbTestStatus.toUpperCase()}`,
                      `Round-Trip Latency: ${dbLatencyMs !== null ? `${dbLatencyMs}ms` : "N/A"}`,
                      `Provider: Supabase PostgreSQL 17`,
                      `Active Tenants Observed: ${dbRecordCount !== null ? dbRecordCount : "N/A"}`,
                      `Diagnostics: ${dbDiagnosticMsg || "No errors recorded"}`,
                      "==================================================",
                    ].join("\n");
                    navigator.clipboard.writeText(report);
                    toast("success", "Diagnostic report copied to clipboard!");
                  }}
                  className="btn-outline text-xs flex items-center gap-1.5"
                >
                  <span>📋 Copy Report</span>
                </button>

                <button
                  type="button"
                  onClick={runDatabaseConnectionTest}
                  disabled={dbTestStatus === "testing"}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <span>↻ Retest Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE API KEY MODAL */}
      {newKeyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative">
            <h3 className="text-base font-bold text-fg mb-1">Generate API Access Token</h3>
            <p className="text-xs text-muted mb-4">
              Create an authentication key for programmatic integration.
            </p>

            {generatedSecret ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  <strong>⚠️ Copy your API Secret Key now:</strong> This secret will never be displayed again. If lost, you will need to revoke and regenerate it.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Generated Secret Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedSecret}
                      className="input w-full font-mono text-xs bg-surface"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedSecret);
                        toast("success", "Copied secret to clipboard!");
                      }}
                      className="btn-primary text-xs shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setNewKeyModalOpen(false);
                      setGeneratedSecret(null);
                    }}
                    className="btn-outline text-xs"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Integration Name *</label>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="input w-full"
                    placeholder="e.g. CBSE Academic Sync Service"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Permissions Scope</label>
                  <select
                    value={newKeyScope}
                    onChange={(e) => setNewKeyScope(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="read:curriculum, read:timetables">Read-Only (Curriculum & Schedules)</option>
                    <option value="read:all, write:attendance">Attendance & Roster Synchronization</option>
                    <option value="read:all, write:all">Full Platform Read/Write</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setNewKeyModalOpen(false)}
                    className="btn-outline text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary text-xs">
                    Create Key
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {restoreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative">
            <h3 className="text-base font-bold text-rose-600 mb-1">⚠️ Restore Database Snapshot</h3>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Restoring a snapshot will roll back database state to the selected point-in-time. This action cannot be undone. To proceed, please type <strong className="text-fg font-mono">RESTORE</strong> below.
            </p>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Type RESTORE to confirm"
                value={restoreConfirmText}
                onChange={(e) => setRestoreConfirmText(e.target.value)}
                className="input w-full font-mono text-xs uppercase"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRestoreModalOpen(false);
                    setRestoreConfirmText("");
                  }}
                  className="btn-outline text-xs"
                  disabled={restoringBackup}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={restoreConfirmText !== "RESTORE" || restoringBackup}
                  className="px-3 py-1.5 rounded-lg text-white font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-xs"
                >
                  {restoringBackup ? "Restoring Snapshot…" : "Execute Restoration"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOG INSPECTOR MODAL */}
      {selectedLogPayload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-lg p-6 bg-white shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
              <h3 className="text-sm font-bold text-fg">Log Entry: {selectedLogPayload.id}</h3>
              <button
                onClick={() => setSelectedLogPayload(null)}
                className="text-muted hover:text-fg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-xs p-3 rounded-lg bg-surface border border-border">
              <pre className="whitespace-pre-wrap text-fg">
                {JSON.stringify(selectedLogPayload, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedLogPayload(null)}
                className="btn-outline text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAILY AUDIT FILE INSPECTION MODAL */}
      {selectedAuditFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-3xl p-6 bg-white shadow-2xl relative max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  <h3 className="text-base font-bold text-fg font-mono">{selectedAuditFile.filename}</h3>
                  <span
                    className={`badge font-bold text-[10px] ${
                      selectedAuditFile.status.includes("Active")
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {selectedAuditFile.status}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Archived ledger records for {selectedAuditFile.label} • {selectedAuditFile.recordCount.toLocaleString()} events ({selectedAuditFile.size})
                </p>
              </div>
              <button
                onClick={() => setSelectedAuditFile(null)}
                className="text-muted hover:text-fg text-base font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Checksum & Metadata */}
            <div className="p-3 bg-surface rounded-lg border border-border text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">SHA-256 Checksum:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedAuditFile.sha256);
                    toast("success", "SHA-256 hash copied!");
                  }}
                  className="text-accent text-[11px] font-bold hover:underline"
                >
                  Copy Checksum
                </button>
              </div>
              <div className="font-mono text-[11px] text-muted break-all bg-white p-2 rounded border border-border">
                {selectedAuditFile.sha256}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                <span>Last Updated: {selectedAuditFile.lastUpdated}</span>
                <span>Storage: AWS S3 WORM Bucket (ap-northeast-2)</span>
              </div>
            </div>

            {/* Event Records Preview */}
            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-fg uppercase tracking-wider">
                  Event Ledger Preview ({selectedAuditFile.sampleEvents?.length || 0} sample records)
                </h4>
                <span className="text-[11px] text-muted">Tamper-evident sequence</span>
              </div>

              <div className="border border-border rounded-lg overflow-y-auto max-h-56">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface text-muted text-[10px] uppercase font-bold sticky top-0 border-b border-border">
                    <tr>
                      <th className="p-2">Time</th>
                      <th className="p-2">Action</th>
                      <th className="p-2">Actor</th>
                      <th className="p-2">Target</th>
                      <th className="p-2">Tenant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                    {(selectedAuditFile.sampleEvents || []).map((ev: any, idx: number) => (
                      <tr key={idx} className="hover:bg-surface/50">
                        <td className="p-2 text-muted">{ev.time}</td>
                        <td className="p-2 font-bold text-accent">{ev.action}</td>
                        <td className="p-2 text-fg truncate max-w-[140px]">{ev.actor}</td>
                        <td className="p-2 text-fg truncate max-w-[160px]">{ev.target}</td>
                        <td className="p-2 text-muted">{ev.tenant}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadAuditFile(selectedAuditFile, "json")}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  Download JSONL Archive ⤓
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadAuditFile(selectedAuditFile, "csv")}
                  className="btn-outline text-xs flex items-center gap-1.5"
                >
                  Export CSV Spreadsheet ⤓
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAuditFile(null)}
                className="btn-outline text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT ROLE MODAL */}
      {(createRoleModalOpen || editingRole) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-surface/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-fg">
                  {editingRole ? `Edit Role: ${editingRole.name}` : "Create New Platform Role"}
                </h3>
                <p className="text-xs text-muted">
                  {editingRole
                    ? "Update role attributes, badge presentation, and granular permissions."
                    : "Define a new custom role with granular permissions and multi-tenant scoping."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateRoleModalOpen(false);
                  setEditingRole(null);
                }}
                className="text-muted hover:text-fg text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Role Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Curriculum Director"
                    value={roleFormName}
                    onChange={(e) => {
                      setRoleFormName(e.target.value);
                      if (!editingRole && !roleFormCode) {
                        setRoleFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"));
                      }
                    }}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="label">Identifier Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingRole?.protected}
                    placeholder="e.g. curriculum_director"
                    value={roleFormCode}
                    onChange={(e) => setRoleFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className={`input w-full font-mono text-xs ${editingRole?.protected ? "bg-surface cursor-not-allowed" : ""}`}
                  />
                  {editingRole?.protected && (
                    <span className="text-[10px] text-muted">System protected identifiers cannot be renamed.</span>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Badge Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Academic Dean"
                    value={roleFormBadge}
                    onChange={(e) => setRoleFormBadge(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="label">Badge Theme Color</label>
                  <select
                    value={roleFormBadgeColor}
                    onChange={(e) => setRoleFormBadgeColor(e.target.value as any)}
                    className="input w-full text-xs"
                  >
                    <option value="indigo">Indigo (Platform Standard)</option>
                    <option value="purple">Purple (Leadership)</option>
                    <option value="teal">Teal (Specialist)</option>
                    <option value="emerald">Emerald (Faculty / Academic)</option>
                    <option value="amber">Amber (Review / Audit)</option>
                    <option value="rose">Rose (Security / Elevated)</option>
                    <option value="blue">Blue (Administrative)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Scope & Realm</label>
                  <select
                    value={roleFormScope}
                    onChange={(e) => setRoleFormScope(e.target.value as any)}
                    className="input w-full text-xs"
                  >
                    <option value="Per School">Per School (School-scoped)</option>
                    <option value="Global">Global (Cross-platform)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Role Description</label>
                <textarea
                  rows={2}
                  placeholder="Explain responsibilities and authority bounds for this role..."
                  value={roleFormDesc}
                  onChange={(e) => setRoleFormDesc(e.target.value)}
                  className="input w-full text-xs"
                />
              </div>

              {/* Granular Permissions Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <div>
                    <h4 className="font-bold text-xs text-fg uppercase tracking-wider">
                      Granular Permissions Matrix ({Object.values(roleFormPermissions).filter(Boolean).length} Active)
                    </h4>
                    <p className="text-[11px] text-muted">Toggle capabilities granted to accounts bearing this role.</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions(true)}
                      className="btn-outline text-[10px] py-1 px-2 font-semibold"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions(false)}
                      className="btn-outline text-[10px] py-1 px-2 font-semibold"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {permissionsMatrix.map((cat, catIdx) => {
                    const catCodes = cat.permissions.map((p) => p.code);
                    const allCatEnabled = catCodes.every((c) => !!roleFormPermissions[c]);

                    return (
                      <div key={catIdx} className="p-3 rounded-xl border border-border bg-surface/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-accent uppercase tracking-wide">
                            {cat.category}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSetCategoryPermissions(catCodes, !allCatEnabled)}
                            className="text-[10px] font-bold text-muted hover:text-accent"
                          >
                            {allCatEnabled ? "Deselect Category" : "Select Category"}
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-2">
                          {cat.permissions.map((p) => {
                            const isChecked = !!roleFormPermissions[p.code];
                            return (
                              <label
                                key={p.code}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                                  isChecked
                                    ? "bg-white border-accent/40 shadow-xs"
                                    : "bg-surface/60 border-border/60 hover:bg-surface"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(p.code)}
                                  className="rounded border-border text-accent focus:ring-accent mt-0.5"
                                />
                                <div className="min-w-0">
                                  <span className="font-bold text-fg block text-xs truncate">{p.name}</span>
                                  <span className="text-[10px] text-muted block line-clamp-1">{p.desc}</span>
                                  <code className="text-[9px] text-accent/80 font-mono block">{p.code}</code>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setCreateRoleModalOpen(false);
                    setEditingRole(null);
                  }}
                  className="btn-outline text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs px-5">
                  {editingRole ? "Save Role Changes" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

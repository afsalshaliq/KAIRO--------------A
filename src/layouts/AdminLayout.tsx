import PortalLayout, { type NavGroup } from "./PortalLayout";
import { useAuth } from "@/features/auth/AuthContext";

export default function AdminLayout() {
  const { profile } = useAuth();
  const isSuper = profile?.role === "super_admin";

  const groups: NavGroup[] = [
    { heading: "Overview", items: [{ to: "/admin/dashboard", label: "Dashboard" }] },
    {
      heading: "People",
      items: [
        { to: "/admin/teachers", label: "Teachers" },
        { to: "/admin/teacher-admins", label: "Teacher Admins" },
        ...(isSuper ? [{ to: "/admin/administrators", label: "Administrators" }] : []),
      ],
    },
    {
      heading: "Academics",
      items: [
        { to: "/admin/classes", label: "Classes" },
        { to: "/admin/assignments", label: "Assignments" },
        { to: "/admin/materials", label: "Curriculum" },
        { to: "/admin/timetable", label: "Timetable" },
      ],
    },
    {
      heading: "Communication & Workflow",
      items: [
        { to: "/admin/announcements", label: "Announcements" },
        { to: "/admin/requests", label: "Teacher Requests" },
      ],
    },
    {
      heading: "System & Governance",
      items: [
        { to: "/admin/audit", label: "Audit Logs" },
        { to: "/admin/settings", label: "Settings" },
      ],
    },
  ];

  return <PortalLayout groups={groups} kind="admin" />;
}

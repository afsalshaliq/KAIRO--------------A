import { createBrowserRouter, Navigate } from "react-router-dom";
import PublicLayout from "@/layouts/PublicLayout";
import AdminLayout from "@/layouts/AdminLayout";
import TeacherLayout from "@/layouts/TeacherLayout";
import SuperAdminLayout from "@/layouts/SuperAdminLayout";
import { RequireRole, RequireSuperAdmin } from "./guards";

import Landing from "@/pages/public/Landing";
import Demo from "@/pages/public/Demo";
import PortalSelect from "@/pages/public/PortalSelect";
import Privacy from "@/pages/public/Privacy";
import AdminLogin from "@/pages/public/AdminLogin";
import TeacherLogin from "@/pages/public/TeacherLogin";
import NotFound from "@/pages/public/NotFound";

import SuperSchools from "@/pages/super/Schools";
import SuperSchoolDetail from "@/pages/super/SchoolDetail";
import SuperUsers from "@/pages/super/Users";
import SuperAudit from "@/pages/super/Audit";
import SuperOverview from "@/pages/super/Overview";
import SuperSettings from "@/pages/super/Settings";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminTeachers from "@/pages/admin/Teachers";
import AdminTeacherAdmins from "@/pages/admin/TeacherAdmins";
import AdminClasses from "@/pages/admin/Classes";
import AdminAssignments from "@/pages/admin/Assignments";
import AdminMaterials from "@/pages/admin/Materials";
import AdminTimetable from "@/pages/admin/Timetable";
import AdminAnnouncements from "@/pages/admin/Announcements";
import AdminRequests from "@/pages/admin/Requests";
import AdminAudit from "@/pages/admin/Audit";
import AdminSettings from "@/pages/admin/Settings";
import AdminAdministrators from "@/pages/admin/Administrators";

import TeacherDashboard from "@/pages/teacher/Dashboard";
import TeacherLearning from "@/pages/teacher/Learning";
import TeacherAIAssistant from "@/pages/teacher/AIAssistant";
import TeacherMaterials from "@/pages/teacher/Materials";
import Workspace from "@/pages/teacher/Workspace";
import Activities from "@/pages/teacher/Activities";
import Worksheets from "@/pages/teacher/Worksheets";
import Quizzes from "@/pages/teacher/Quizzes";
import TeacherTimetable from "@/pages/teacher/Timetable";
import TeacherRequests from "@/pages/teacher/Requests";
import TeacherAnnouncements from "@/pages/teacher/Announcements";
import History from "@/pages/teacher/History";
import TeacherProfile from "@/pages/teacher/Profile";

const admin = (el: React.ReactNode) => <RequireRole role="admin">{el}</RequireRole>;
const teacher = (el: React.ReactNode) => <RequireRole role="teacher">{el}</RequireRole>;

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/demo", element: <Demo /> },
      { path: "/login", element: <PortalSelect /> },
      { path: "/privacy", element: <Privacy /> },
    ],
  },
  { path: "/admin/login", element: <AdminLogin /> },
  { path: "/teacher/login", element: <TeacherLogin /> },

  // Super Admin Global Console
  {
    path: "/super",
    element: (
      <RequireSuperAdmin>
        <SuperAdminLayout />
      </RequireSuperAdmin>
    ),
    children: [
      { path: "", element: <Navigate to="/super/overview" replace /> },
      { path: "overview", element: <SuperOverview /> },
      { path: "schools", element: <SuperSchools /> },
      { path: "schools/:schoolId", element: <SuperSchoolDetail /> },
      { path: "users", element: <SuperUsers /> },
      { path: "settings", element: <SuperSettings /> },
      { path: "audit", element: <SuperAudit /> },
    ],
  },

  // School Administration Environment (Principal & Teacher Admins)
  {
    path: "/admin",
    element: admin(<AdminLayout />),
    children: [
      { path: "dashboard", element: <AdminDashboard /> },
      { path: "teachers", element: <AdminTeachers /> },
      { path: "teacher-admins", element: <AdminTeacherAdmins /> },
      { path: "classes", element: <AdminClasses /> },
      { path: "assignments", element: <AdminAssignments /> },
      { path: "materials", element: <AdminMaterials /> },
      { path: "timetable", element: <AdminTimetable /> },
      { path: "announcements", element: <AdminAnnouncements /> },
      { path: "requests", element: <AdminRequests /> },
      { path: "audit", element: <AdminAudit /> },
      { path: "administrators", element: <RequireSuperAdmin><AdminAdministrators /></RequireSuperAdmin> },
      { path: "settings", element: <AdminSettings /> },
    ],
  },

  // Teacher Workspace & Learning Platform
  {
    path: "/teacher",
    element: teacher(<TeacherLayout />),
    children: [
      { path: "dashboard", element: <TeacherDashboard /> },
      { path: "learning", element: <TeacherLearning /> },
      { path: "ai-assistant", element: <TeacherAIAssistant /> },
      { path: "materials", element: <TeacherMaterials /> },
      { path: "workspace/:materialId", element: <Workspace /> },
      { path: "activities", element: <Activities /> },
      { path: "worksheets", element: <Worksheets /> },
      { path: "quizzes", element: <Quizzes /> },
      { path: "timetable", element: <TeacherTimetable /> },
      { path: "requests", element: <TeacherRequests /> },
      { path: "announcements", element: <TeacherAnnouncements /> },
      { path: "history", element: <History /> },
      { path: "profile", element: <TeacherProfile /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

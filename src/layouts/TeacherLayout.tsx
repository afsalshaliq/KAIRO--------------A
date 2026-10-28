import PortalLayout, { type NavGroup } from "./PortalLayout";

const groups: NavGroup[] = [
  { heading: "Overview", items: [{ to: "/teacher/dashboard", label: "Dashboard" }] },
  {
    heading: "Teaching & Learning",
    items: [
      { to: "/teacher/learning", label: "Learning Platform" },
      { to: "/teacher/ai-assistant", label: "AI Assistant" },
      { to: "/teacher/materials", label: "Curriculum Materials" },
      { to: "/teacher/activities", label: "Activities" },
      { to: "/teacher/worksheets", label: "Worksheets" },
      { to: "/teacher/quizzes", label: "Quizzes" },
    ],
  },
  {
    heading: "Schedule & Requests",
    items: [
      { to: "/teacher/timetable", label: "My Timetable" },
      { to: "/teacher/requests", label: "Permissions & Requests" },
      { to: "/teacher/announcements", label: "Announcements" },
    ],
  },
  {
    heading: "Account",
    items: [
      { to: "/teacher/history", label: "History" },
      { to: "/teacher/profile", label: "Profile & Face ID" },
    ],
  },
];

export default function TeacherLayout() {
  return <PortalLayout groups={groups} kind="teacher" />;
}

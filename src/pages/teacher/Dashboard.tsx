import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { useAsync } from "@/lib/useAsync";
import { myAssignments, listSubjects, listClasses } from "@/services/catalog";
import { listMaterials } from "@/services/materials";
import { listTeacherTimetable, computeScheduleStatus } from "@/services/timetable";
import { listAnnouncements } from "@/services/announcements";
import { listRequests } from "@/services/requests";
import { Skeleton, StatusBadge } from "@/components/ui";
import { teacherWorkspaceImage } from "@/assets/generated";
import type { TimetableRow, Announcement, TeacherRequest } from "@/types/db";

const quickActions = [
  { to: "/teacher/ai-assistant", label: "AI Pedagogical Assistant", tag: "AI Dialogue", desc: "Curriculum-grounded Q&A" },
  { to: "/teacher/worksheets", label: "Worksheet Generator", tag: "Print Ready", desc: "Print-ready tests & keys" },
  { to: "/teacher/activities", label: "Classroom Activities", tag: "Hands-on", desc: "Hands-on games & labs" },
  { to: "/teacher/quizzes", label: "Quick Quizzes", tag: "Formative", desc: "Formative checks & marks" },
  { to: "/teacher/materials", label: "My Curriculum Materials", tag: "CBSE Library", desc: "Assigned textbooks & chapters" },
  { to: "/teacher/learning", label: "Teacher Learning", tag: "Methods", desc: "Pedagogical methodologies" },
  { to: "/teacher/timetable", label: "My Timetable", tag: "Periods", desc: "Class schedule & periods" },
  { to: "/teacher/requests", label: "Submit Request", tag: "Elevation", desc: "Leave & schedule adjustments" },
];

export default function TeacherDashboard() {
  const { profile, configured } = useAuth();
  const { school } = useTenant();

  const assignments = useAsync(() => (configured ? myAssignments() : Promise.resolve([])), []);
  const subjects = useAsync(() => (configured ? listSubjects() : Promise.resolve([])), []);
  const classes = useAsync(() => (configured ? listClasses() : Promise.resolve([])), []);
  const materials = useAsync(() => (configured ? listMaterials() : Promise.resolve([])), []);

  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [requests, setRequests] = useState<TeacherRequest[]>([]);

  useEffect(() => {
    if (profile && school) {
      listTeacherTimetable(profile.id, school.id).then(setTimetable);
      listAnnouncements({
        schoolId: school.id,
        isPublishedOnly: true,
        userRole: profile.role,
        department: profile.department,
      }).then(setAnnouncements);
      listRequests({
        schoolId: school.id,
        teacherId: profile.id,
      }).then(setRequests);
    }
  }, [profile, school]);

  const scheduleStatus = computeScheduleStatus(timetable);
  const firstName = profile?.full_name?.split(" ")[0] || "Teacher";

  return (
    <>
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-border/60 pb-6">
        <div>
          <PageHeader
            title={`Welcome, ${firstName}`}
            subtitle={`Teaching workspace, curriculum materials, and pedagogical AI tools at ${school?.name || "KAIRO"}.`}
          />
        </div>
        <div className="hidden lg:block shrink-0">
          <img
            src={teacherWorkspaceImage}
            alt="Educator lesson planning and workspace overview"
            className="h-24 w-36 object-cover rounded-xl border border-border shadow-xs"
          />
        </div>
      </div>

      {/* Today's Schedule Ribbon */}
      <div className="card mb-8 p-5 border-border bg-gradient-to-r from-surface via-card to-surface shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-fg">Today&apos;s Class Schedule</span>
          </div>
          <Link
            to="/teacher/timetable"
            className="text-xs text-accent font-semibold hover:underline flex items-center gap-1"
          >
            <span>View Complete Timetable</span>
            <span>→</span>
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {/* Previous Class */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
            <span className="text-[10px] uppercase font-bold text-muted block mb-1">
              Previous Class
            </span>
            {scheduleStatus.previousClass ? (
              <div>
                <span className="font-bold text-xs text-fg block">
                  {scheduleStatus.previousClass.subjectName}
                </span>
                <span className="text-[11px] text-muted">
                  {scheduleStatus.previousClass.className} · {scheduleStatus.previousClass.start_time} - {scheduleStatus.previousClass.end_time}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted/70 italic">None prior today</span>
            )}
          </div>

          {/* Current Class */}
          <div className="p-3.5 rounded-xl bg-accent-soft/70 border border-accent/30 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-accent block mb-1">
              Current Active Class
            </span>
            {scheduleStatus.currentClass ? (
              <div>
                <span className="font-extrabold text-sm text-fg block">
                  {scheduleStatus.currentClass.subjectName}
                </span>
                <span className="text-xs text-fg/80">
                  {scheduleStatus.currentClass.className} (Sec {scheduleStatus.currentClass.sectionName}) · {scheduleStatus.currentClass.room || "Room 101"}
                </span>
              </div>
            ) : (
              <span className="text-xs text-accent font-medium italic">
                Free period right now — ideal for lesson preparation!
              </span>
            )}
          </div>

          {/* Next Class */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
            <span className="text-[10px] uppercase font-bold text-muted block mb-1">
              Next Upcoming Class
            </span>
            {scheduleStatus.nextClass ? (
              <div>
                <span className="font-bold text-xs text-fg block">
                  {scheduleStatus.nextClass.subjectName}
                </span>
                <span className="text-[11px] text-muted">
                  {scheduleStatus.nextClass.className} · Starts {scheduleStatus.nextClass.start_time}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted/70 italic">No further periods today</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Launchpad Grid */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-fg mb-3.5">
          Quick Pedagogical Launchpad
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="card p-4 border-border hover:border-accent/40 hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="badge bg-accent-soft text-accent text-[10px] font-bold uppercase tracking-wider border border-accent/20">
                  {q.tag}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold text-fg group-hover:text-accent transition-colors block">
                  {q.label}
                </span>
                <span className="text-[11px] text-muted leading-tight block mt-1">
                  {q.desc}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 2x2 Information Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Principal Announcements */}
        <div className="card p-6 border-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <h2 className="font-bold text-sm text-fg">
              Principal Bulletins
            </h2>
            <Link to="/teacher/announcements" className="text-xs text-accent font-semibold hover:underline">
              View All →
            </Link>
          </div>

          {announcements.length === 0 ? (
            <p className="text-xs text-muted italic py-3">No active school announcements.</p>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 2).map((a) => (
                <div key={a.id} className="p-3.5 rounded-xl bg-surface/60 border border-border">
                  <span className="font-bold text-xs text-fg block">{a.title}</span>
                  <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Requests Status */}
        <div className="card p-6 border-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <h2 className="font-bold text-sm text-fg">
              My Requests & Elevation
            </h2>
            <Link to="/teacher/requests" className="text-xs text-accent font-semibold hover:underline">
              Submit Request →
            </Link>
          </div>

          {requests.length === 0 ? (
            <p className="text-xs text-muted italic py-3">No pending or recent administrative requests.</p>
          ) : (
            <div className="space-y-3">
              {requests.slice(0, 2).map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl bg-surface/60 border border-border flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-xs text-fg block">{r.title}</span>
                    <span className="text-[11px] text-muted uppercase font-semibold">
                      {r.type.replace("_", " ")}
                    </span>
                  </div>
                  <StatusBadge
                    status={
                      r.status === "approved"
                        ? "active"
                        : r.status === "rejected"
                        ? "failed"
                        : "queued"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assigned Classes */}
        <div className="card p-6 border-border">
          <h2 className="mb-3.5 font-bold text-sm text-fg pb-2 border-b border-border/60">
            My Assigned Class Cohorts
          </h2>
          {assignments.loading ? (
            <Skeleton className="h-24" />
          ) : !assignments.data?.length ? (
            <p className="text-xs text-muted italic">
              No assignments recorded. Your school administrator assigns your teaching subjects.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {assignments.data.map((a) => {
                const c = classes.data?.find((x) => x.id === a.class_id);
                const s = subjects.data?.find((x) => x.id === a.subject_id);
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-xl bg-surface/70 border border-border px-4 py-3 font-semibold text-fg"
                  >
                    <span>Class {c?.grade ?? "?"} · {s?.name ?? "?"}</span>
                    <span className="text-[11px] text-muted">Primary CBSE</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Assigned Curriculum Materials */}
        <div className="card p-6 border-border">
          <h2 className="mb-3.5 font-bold text-sm text-fg pb-2 border-b border-border/60">
            Assigned Curriculum Materials
          </h2>
          {materials.loading ? (
            <Skeleton className="h-24" />
          ) : !materials.data?.length ? (
            <p className="text-xs text-muted italic">No published materials available for your classes.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {materials.data.slice(0, 4).map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/teacher/workspace/${m.id}`}
                    className="flex items-center justify-between rounded-xl bg-surface/70 border border-border px-4 py-3 hover:border-accent/40 hover:text-accent font-semibold transition-colors"
                  >
                    <span>{m.title}</span>
                    <span className="text-muted text-xs font-normal">
                      {m.chapter || "Full Chapter"} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

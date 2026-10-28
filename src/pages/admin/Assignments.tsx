import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import {
  listAssignments,
  listTeachers,
  listClasses,
  listSections,
  listSubjects,
  createAssignment,
  setAssignmentRevoked,
} from "@/services/catalog";
import { assignmentSchema } from "@/lib/schemas";
import { EmptyState, Skeleton, useToast, StatusBadge, SearchBar } from "@/components/ui";

export default function Assignments() {
  const toast = useToast();
  const assignments = useAsync(() => listAssignments(), []);
  const teachers = useAsync(() => listTeachers(), []);
  const classes = useAsync(() => listClasses(), []);
  const sections = useAsync(() => listSections(), []);
  const subjects = useAsync(() => listSubjects(), []);
  const [form, setForm] = useState({ teacherId: "", classId: "", sectionId: "", subjectId: "" });
  const [search, setSearch] = useState("");

  const sectionOpts = sections.data?.filter((s) => s.class_id === form.classId) ?? [];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = assignmentSchema.safeParse(form);
    if (!parsed.success) {
      toast("error", "Select teacher, class, section and subject.");
      return;
    }
    try {
      await createAssignment(parsed.data);
      toast("success", "Subject assignment granted.");
      setForm({ teacherId: "", classId: "", sectionId: "", subjectId: "" });
      assignments.reload();
    } catch (err: any) {
      toast(
        "error",
        err.message.includes("duplicate") ? "That teacher assignment already exists." : err.message
      );
    }
  }

  const getLabelInfo = useCallback((a: { teacher_id: string; class_id: string; section_id: string; subject_id: string }) => {
    const t = teachers.data?.find((x) => x.id === a.teacher_id);
    const c = classes.data?.find((x) => x.id === a.class_id);
    const s = sections.data?.find((x) => x.id === a.section_id);
    const sub = subjects.data?.find((x) => x.id === a.subject_id);
    return {
      teacher: t?.full_name || t?.email || "Unknown Teacher",
      className: `Class ${c?.grade ?? "?"}${s ? ` (Sec ${s.name})` : ""}`,
      subject: sub?.name ?? "Subject",
    };
  }, [teachers.data, classes.data, sections.data, subjects.data]);

  const filteredAssignments = useMemo(() => {
    return (assignments.data ?? []).filter((a) => {
      const info = getLabelInfo(a);
      const str = `${info.teacher} ${info.className} ${info.subject}`.toLowerCase();
      return !search || str.includes(search.toLowerCase());
    });
  }, [assignments.data, search, getLabelInfo]);

  return (
    <>
      <PageHeader
        title="Teacher Assignments"
        subtitle="Assignments enforce which curriculum materials, lesson workspaces, and AI features each teacher can access."
      />

      {/* Assignment Creator */}
      <form onSubmit={add} className="card mb-6 grid gap-3 p-5 md:grid-cols-5 border-border">
        <div>
          <label className="label">Teacher</label>
          <select
            className="input"
            value={form.teacherId}
            onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
            required
          >
            <option value="">Select Faculty…</option>
            {teachers.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || t.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Class Grade</label>
          <select
            className="input"
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: "" })}
            required
          >
            <option value="">Select Class…</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Class {c.grade}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Section</label>
          <select
            className="input"
            value={form.sectionId}
            onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
            disabled={!form.classId}
            required
          >
            <option value="">Select Section…</option>
            {sectionOpts.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Subject</label>
          <select
            className="input"
            value={form.subjectId}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            required
          >
            <option value="">Select Subject…</option>
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="self-end">
          <button className="btn-primary w-full">Create Assignment</button>
        </div>
      </form>

      {/* Filter and List */}
      <div className="mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Filter by teacher, class, or subject…"
          className="max-w-sm"
        />
      </div>

      {assignments.loading ? (
        <Skeleton className="h-40" />
      ) : !assignments.data?.length ? (
        <EmptyState
          title="No assignments created yet"
          hint="Create an assignment above to authorize a teacher for their assigned classes and subjects."
        />
      ) : !filteredAssignments.length ? (
        <EmptyState
          title="No assignments matched your search"
          hint="Try adjusting or clearing your search query."
          action={
            <button onClick={() => setSearch("")} className="btn-outline text-xs">
              Clear Search
            </button>
          }
        />
      ) : (
        <div className="card divide-y divide-border/60 border-border overflow-hidden">
          {filteredAssignments.map((a) => {
            const info = getLabelInfo(a);
            return (
              <div
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-surface/50 transition-colors"
              >
                <div>
                  <span className={`font-bold text-fg ${a.is_revoked ? "line-through text-muted" : ""}`}>
                    {info.teacher}
                  </span>
                  <span className="text-muted mx-2">→</span>
                  <span className="font-semibold text-accent">{info.className}</span>
                  <span className="text-muted mx-1.5">·</span>
                  <span className="text-fg">{info.subject}</span>
                </div>
                <div className="flex items-center gap-2">
                  {a.is_revoked && <StatusBadge status="archived" />}
                  <button
                    className="btn-outline btn-sm"
                    onClick={() =>
                      setAssignmentRevoked(a.id, !a.is_revoked)
                        .then(() => {
                          toast("success", a.is_revoked ? "Assignment restored" : "Assignment revoked");
                          assignments.reload();
                        })
                        .catch((e) => toast("error", e.message))
                    }
                  >
                    {a.is_revoked ? "Restore Access" : "Revoke"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

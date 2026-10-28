import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { listClasses, listSections, createClass, createSection, setClassArchived } from "@/services/catalog";
import { classSchema, sectionSchema } from "@/lib/schemas";
import { Skeleton, useToast, StatusBadge } from "@/components/ui";

export default function Classes() {
  const toast = useToast();
  const classes = useAsync(() => listClasses(), []);
  const sections = useAsync(() => listSections(), []);
  const [grade, setGrade] = useState(1);
  const [year, setYear] = useState("2025-2026");
  const [secClass, setSecClass] = useState("");
  const [secName, setSecName] = useState("");

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    const parsed = classSchema.safeParse({ grade, academicYear: year });
    if (!parsed.success) {
      toast("error", parsed.error.issues[0].message);
      return;
    }
    try {
      await createClass(parsed.data.grade, parsed.data.academicYear);
      toast("success", "Class grade created successfully.");
      classes.reload();
    } catch (err: any) {
      toast("error", err.message);
    }
  }

  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    const parsed = sectionSchema.safeParse({ classId: secClass, name: secName });
    if (!parsed.success) {
      toast("error", parsed.error.issues[0].message);
      return;
    }
    try {
      await createSection(parsed.data.classId, parsed.data.name);
      toast("success", "Section added successfully.");
      setSecName("");
      sections.reload();
    } catch (err: any) {
      toast("error", err.message);
    }
  }

  return (
    <>
      <div className="mb-6 border-b border-border/60 pb-6">
        <PageHeader
          title="Classes & Sections"
          subtitle="Manage academic cohorts for grades 1–5 (strictly restricted to primary education in database schema)."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Classes Cohort */}
        <div className="card p-6 border-border flex flex-col justify-between">
          <div>
            <h2 className="mb-4 font-bold text-base text-fg">
              Add Class Grade
            </h2>
            <form onSubmit={addClass} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="label">Grade (1–5)</label>
                <select
                  className="input"
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Class {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Academic Year</label>
                <input
                  className="input"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2025-2026"
                  required
                />
              </div>
              <div className="self-end">
                <button className="btn-primary w-full sm:w-auto">Add Class</button>
              </div>
            </form>

            <div className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Active Class Cohorts</h3>
              {classes.loading ? (
                <Skeleton className="h-24" />
              ) : !classes.data?.length ? (
                <p className="text-xs text-muted italic">No classes provisioned yet.</p>
              ) : (
                classes.data.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl bg-surface/70 border border-border px-4 py-3 text-sm"
                  >
                    <span className="font-bold text-fg">
                      Class {c.grade}{" "}
                      <span className="text-xs font-normal text-muted">· {c.academic_year}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {c.is_archived && <StatusBadge status="archived" />}
                      <button
                        className="btn-outline btn-sm text-xs"
                        onClick={() =>
                          setClassArchived(c.id, !c.is_archived).then(() => {
                            toast("success", c.is_archived ? "Class unarchived" : "Class archived");
                            classes.reload();
                          })
                        }
                      >
                        {c.is_archived ? "Unarchive" : "Archive"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="card p-6 border-border flex flex-col justify-between">
          <div>
            <h2 className="mb-4 font-bold text-base text-fg">
              Add Section
            </h2>
            <form onSubmit={addSection} className="grid gap-3 sm:grid-cols-[1.2fr_1fr_auto]">
              <div>
                <label className="label">Assign to Class</label>
                <select
                  className="input"
                  value={secClass}
                  onChange={(e) => setSecClass(e.target.value)}
                  required
                >
                  <option value="">Select Grade…</option>
                  {classes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      Class {c.grade} ({c.academic_year})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Section Name</label>
                <input
                  className="input"
                  value={secName}
                  onChange={(e) => setSecName(e.target.value)}
                  placeholder="e.g. A or Lotus"
                  required
                />
              </div>
              <div className="self-end">
                <button className="btn-primary w-full sm:w-auto">Add</button>
              </div>
            </form>

            <div className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Class Sections</h3>
              {sections.loading ? (
                <Skeleton className="h-24" />
              ) : !sections.data?.length ? (
                <p className="text-xs text-muted italic">No sections created yet.</p>
              ) : (
                sections.data.map((s) => {
                  const cls = classes.data?.find((c) => c.id === s.class_id);
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl bg-surface/70 border border-border px-4 py-3 text-sm flex items-center justify-between"
                    >
                      <span className="font-bold text-fg">
                        {cls ? `Class ${cls.grade}` : "Class"} · Section {s.name}
                      </span>
                      <span className="text-xs text-muted">Active</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

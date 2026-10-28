import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { listMaterials } from "@/services/materials";
import { generateActivity, saveActivity } from "@/services/generate";
import { ACTIVITY_TYPES } from "@/lib/schemas";
import type { Activity } from "@/lib/schemas";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { printHtml, escapeHtml } from "@/features/curriculum/print";
import { useAuth } from "@/features/auth/AuthContext";

export default function Activities() {
  const toast = useToast();
  const { configured } = useAuth();
  const materials = useAsync(() => (configured ? listMaterials() : Promise.resolve([])), []);
  const [form, setForm] = useState({
    materialId: "",
    activityType: "game",
    durationMinutes: 30,
    groupSize: "Groups of 4",
    difficulty: "easy",
    objective: "",
    materialsAvailable: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Activity | null>(null);

  async function gen() {
    if (!form.materialId) {
      toast("error", "Pick an assigned curriculum chapter first.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setResult(await generateActivity(form));
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result) return;
    try {
      await saveActivity(result, form.materialId || null);
      toast("success", "Activity saved to your history.");
    } catch (err: any) {
      toast("error", err.message);
    }
  }

  function print() {
    if (!result) return;
    const sec = (t: string, items: string[]) =>
      items.length ? `<h2>${t}</h2><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "";
    printHtml(
      result.title,
      `
      <div class="head"><h1>${escapeHtml(result.title)}</h1>
      <p class="muted">Class ${result.grade} · ${escapeHtml(result.subject)} · ${escapeHtml(result.topic)}</p></div>
      <p class="muted">${result.durationMinutes} min · ${escapeHtml(result.groupSize)} · ${result.difficulty}</p>
      ${sec("Learning objectives", result.learningObjectives)}
      ${sec("Materials", result.materials)}
      ${sec("Preparation", result.preparation)}
      <h2>Procedure</h2><ol>${result.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
      ${sec("Teacher instructions", result.teacherInstructions)}
      ${sec("Student rules", result.studentRules)}
      ${sec("Expected outcomes", result.expectedOutcomes)}
      ${sec("Assessment checklist", result.assessmentChecklist)}
      ${result.answerKey ? sec("Answer key", result.answerKey) : ""}
      ${sec("Adaptations", result.adaptations)}
      ${sec("Safety notes", result.safetyNotes)}
    `
    );
  }

  return (
    <>
      <div className="mb-6 border-b border-border/60 pb-6">
        <PageHeader
          title="Classroom Activity Generator"
          subtitle="Hands-on games, group experiments, puzzles, and roleplays — strictly grounded in your assigned textbook chapter."
        />
      </div>

      {!configured && (
        <EmptyState
          title="Connect Supabase to generate activities"
          hint="AI generation relies on authorized chapter retrieval from your database."
        />
      )}

      {configured && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Configuration Form Card */}
          <div className="card space-y-4 p-6 border-border h-fit">
            <h2 className="font-bold text-sm text-fg pb-2 border-b border-border/60">
              Activity Parameters
            </h2>

            <div>
              <label className="label">Curriculum Chapter</label>
              <select
                className="input"
                value={form.materialId}
                onChange={(e) => setForm({ ...form, materialId: e.target.value })}
              >
                <option value="">Select Chapter…</option>
                {materials.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                    {m.chapter ? ` · ${m.chapter}` : ""}
                  </option>
                ))}
              </select>
              {!materials.data?.length && !materials.loading && (
                <p className="mt-1 text-xs text-muted">No materials assigned to your account yet.</p>
              )}
            </div>

            <div>
              <label className="label">Activity Format</label>
              <select
                className="input capitalize"
                value={form.activityType}
                onChange={(e) => setForm({ ...form, activityType: e.target.value })}
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Duration (min)</label>
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={180}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Difficulty</label>
                <select
                  className="input capitalize"
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Group Arrangement</label>
              <input
                className="input"
                value={form.groupSize}
                onChange={(e) => setForm({ ...form, groupSize: e.target.value })}
                placeholder="e.g. Groups of 4 or Pairs"
              />
            </div>

            <div>
              <label className="label">Learning Objective (optional)</label>
              <input
                className="input"
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
                placeholder="Specific focus topic…"
              />
            </div>

            <div>
              <label className="label">Available Materials (optional)</label>
              <input
                className="input"
                value={form.materialsAvailable}
                onChange={(e) => setForm({ ...form, materialsAvailable: e.target.value })}
                placeholder="chart paper, leaves, dice…"
              />
            </div>

            <button className="btn-primary w-full py-3" onClick={gen} disabled={busy}>
              {busy ? <Spinner label="Designing Classroom Activity…" /> : "Generate Activity"}
            </button>
          </div>

          {/* Results Area */}
          <div>
            {busy && (
              <div className="card p-12 text-center border-border flex flex-col items-center justify-center">
                <Spinner label="Designing pedagogical activity grounded in your chapter…" />
              </div>
            )}

            {!busy && !result && (
              <EmptyState
                title="Your generated activity will appear here"
                hint="Select a chapter and specify your format preferences, then click Generate Activity."
              />
            )}

            {result && (
              <div className="card p-6 sm:p-8 border-border space-y-5 animate-fade-in-up">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border/60">
                  <div>
                    <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs mb-1">
                      {result.activityType.replace(/_/g, " ")}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-fg">{result.title}</h2>
                    <p className="text-xs text-muted mt-1">
                      Class {result.grade} · {result.subject} · {result.durationMinutes} mins · {result.groupSize} · {result.difficulty}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button className="btn-outline btn-sm text-xs" onClick={gen}>
                      Regenerate
                    </button>
                    <button className="btn-outline btn-sm text-xs" onClick={print}>
                      Print Sheet
                    </button>
                    <button className="btn-primary btn-sm text-xs" onClick={save}>
                      Save to Library
                    </button>
                  </div>
                </div>

                <Section title="Learning Objectives" items={result.learningObjectives} />
                <Section title="Required Classroom Materials" items={result.materials} />

                <div>
                  <h3 className="font-bold text-sm text-fg mb-2">Step-by-Step Procedure</h3>
                  <ol className="list-decimal space-y-2 pl-5 text-xs text-fg leading-relaxed">
                    {result.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>

                <Section title="Teacher Instructions & Facilitation" items={result.teacherInstructions} />
                <Section title="Student Rules" items={result.studentRules} />
                <Section title="Expected Outcomes" items={result.expectedOutcomes} />
                <Section title="Assessment Checklist" items={result.assessmentChecklist} />
                <Section title="Differentiated Adaptations" items={result.adaptations} />
                <Section title="Safety & Precaution Notes" items={result.safetyNotes} />

                {result.citations.length > 0 && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-start gap-2">
                    <span className="font-bold text-emerald-700 uppercase tracking-wider">Verified Textbook Sources:</span>
                    <span>
                      {result.citations.map((c) => `Page ${c.page ?? "?"}`).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="font-bold text-sm text-fg mb-1.5">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-xs text-fg leading-relaxed">
        {items.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

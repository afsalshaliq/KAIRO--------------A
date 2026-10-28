import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { listMaterials } from "@/services/materials";
import { generateWorksheet, saveWorksheet } from "@/services/generate";
import type { Worksheet } from "@/lib/schemas";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { printHtml, escapeHtml } from "@/features/curriculum/print";
import { useAuth } from "@/features/auth/AuthContext";

const QTYPES = ["mcq", "fill_blank", "match", "true_false", "short_answer", "draw_label"] as const;

export default function Worksheets() {
  const toast = useToast();
  const { configured } = useAuth();
  const materials = useAsync(() => (configured ? listMaterials() : Promise.resolve([])), []);
  const [form, setForm] = useState({
    materialId: "",
    count: 6,
    difficulty: "easy",
    types: ["mcq", "fill_blank", "true_false"] as string[],
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Worksheet | null>(null);
  const [showKey, setShowKey] = useState(false);

  function toggleType(t: string) {
    setForm((f) => ({
      ...f,
      types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t],
    }));
  }

  async function gen() {
    if (!form.materialId) {
      toast("error", "Pick an assigned chapter first.");
      return;
    }
    if (!form.types.length) {
      toast("error", "Choose at least one question type.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setResult(await generateWorksheet(form));
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result) return;
    try {
      await saveWorksheet(result, form.materialId || null);
      toast("success", "Worksheet saved to your library.");
    } catch (err: any) {
      toast("error", err.message);
    }
  }

  function print(withKey: boolean) {
    if (!result) return;
    const q = result.questions
      .map((x, i) => {
        const opts = x.options
          ? `<div class="opt">${x.options
              .map((o, j) => `${String.fromCharCode(65 + j)}. ${escapeHtml(o)}`)
              .join("&nbsp;&nbsp;")}</div>`
          : "";
        const space =
          x.type === "short_answer" || x.type === "draw_label"
            ? '<div class="line"></div><div class="line"></div>'
            : "";
        const key = withKey ? `<div class="muted">Answer: ${escapeHtml(x.answer)}</div>` : "";
        return `<div class="q"><b>${i + 1}.</b> ${escapeHtml(x.prompt)} <span class="muted">[${
          x.marks
        }]</span>${opts}${space}${key}</div>`;
      })
      .join("");
    printHtml(
      result.title,
      `
      <div class="head"><h1>Royal School – CBSE</h1><p>${escapeHtml(result.title)}</p></div>
      <div class="fields"><span>Name: __________</span><span>Class: ${
        result.grade
      }</span><span>Section: ___</span><span>Date: ______</span></div>
      <p class="muted">${escapeHtml(result.subject)} · ${escapeHtml(result.chapter)} · ${escapeHtml(
        result.learningObjective
      )}</p>
      ${withKey ? "<h2>Answer Key</h2>" : ""}${q}`
    );
  }

  return (
    <>
      <div className="mb-6 border-b border-border/60 pb-6">
        <PageHeader
          title="Classroom Worksheet Generator"
          subtitle="Print-ready curriculum assessment sheets with automated scoring marks and separate answer keys."
        />
      </div>

      {!configured && (
        <EmptyState
          title="Connect Supabase to generate worksheets"
          hint="Grounded generation requires database connectivity to read assigned chapters."
        />
      )}

      {configured && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Controls Form Card */}
          <div className="card space-y-4 p-6 border-border h-fit">
            <h2 className="font-bold text-sm text-fg pb-2 border-b border-border/60">
              Worksheet Specifications
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Question Count</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={20}
                  value={form.count}
                  onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
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
              <label className="label">Question Types to Include</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {QTYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`badge px-3 py-1.5 cursor-pointer text-xs transition-all ${
                      form.types.includes(t)
                        ? "bg-accent text-white border-accent shadow-xs"
                        : "bg-surface text-muted border-border hover:bg-surface-hover"
                    }`}
                  >
                    {t.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary w-full py-3" onClick={gen} disabled={busy}>
              {busy ? <Spinner label="Writing Worksheet Questions…" /> : "Generate Worksheet"}
            </button>
          </div>

          {/* Results Area */}
          <div>
            {busy && (
              <div className="card p-12 text-center border-border flex flex-col items-center justify-center">
                <Spinner label="Writing curriculum-grounded questions & answer key…" />
              </div>
            )}

            {!busy && !result && (
              <EmptyState
                title="Your generated worksheet will appear here"
                hint="Select your preferred question types and click Generate Worksheet."
              />
            )}

            {result && (
              <div className="card p-6 sm:p-8 border-border space-y-6 animate-fade-in-up">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border/60">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-fg">{result.title}</h2>
                    <p className="text-xs text-muted mt-1">
                      Class {result.grade} · {result.subject} · {result.questions.length} questions · {result.learningObjective}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button className="btn-outline btn-sm text-xs" onClick={gen}>
                      Regenerate
                    </button>
                    <button
                      className="btn-outline btn-sm text-xs"
                      onClick={() => setShowKey((v) => !v)}
                    >
                      {showKey ? "Hide Answer Key" : "Reveal Answer Key"}
                    </button>
                    <button className="btn-outline btn-sm text-xs" onClick={() => print(false)}>
                      Print Student Sheet
                    </button>
                    <button className="btn-outline btn-sm text-xs" onClick={() => print(true)}>
                      Print with Key
                    </button>
                    <button className="btn-primary btn-sm text-xs" onClick={save}>
                      Save
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {result.questions.map((q, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-surface/50 border border-border p-4 text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-bold text-fg text-sm">
                          {i + 1}. {q.prompt}
                        </span>
                        <span className="badge bg-surface text-muted border border-border text-[11px] shrink-0">
                          {q.marks} mark{q.marks > 1 ? "s" : ""}
                        </span>
                      </div>

                      {q.options && (
                        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-muted">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="p-2 rounded bg-card border border-border/70">
                              {String.fromCharCode(65 + oi)}. {opt}
                            </div>
                          ))}
                        </div>
                      )}

                      {showKey && (
                        <div className="mt-2 pt-2 border-t border-border/60 text-xs">
                          <span className="font-bold text-emerald-700">Answer: </span>
                          <span className="text-fg font-medium">{q.answer}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {result.citations.length > 0 && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-start gap-2">
                    <span className="font-bold text-emerald-700 uppercase tracking-wider">Grounded Sources:</span>
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

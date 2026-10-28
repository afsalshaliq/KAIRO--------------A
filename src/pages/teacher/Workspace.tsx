import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { requireSupabase } from "@/lib/supabase";
import { useAsync } from "@/lib/useAsync";
import { askQuestion } from "@/services/generate";
import { Spinner, EmptyState, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { curriculumImage } from "@/assets/generated";
import type { AiAnswer } from "@/lib/schemas";
import type { Material } from "@/types/db";

const suggested = [
  "Explain the core concept in simple words for this grade.",
  "Give me three real-world analogies primary children will understand.",
  "What are the common student misconceptions to address?",
  "What are the key points to summarise at the conclusion of class?",
];

export default function Workspace() {
  const { materialId } = useParams();
  const toast = useToast();
  const { configured } = useAuth();

  const material = useAsync<Material | null>(async () => {
    if (!configured || !materialId) return null;
    const { data, error } = await requireSupabase()
      .from("curriculum_materials")
      .select("*")
      .eq("id", materialId)
      .maybeSingle();
    if (error) throw error;
    return data as Material | null;
  }, [materialId]);

  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<{ q: string; a: AiAnswer }[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();

  async function ask(q: string) {
    if (!q.trim() || !materialId) return;
    setBusy(true);
    try {
      const res = await askQuestion(materialId, q, sessionId);
      setSessionId(res.sessionId);
      setThread((t) => [...t, { q, a: res }]);
      setQuestion("");
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!configured)
    return (
      <EmptyState
        title="Connect Supabase to use the workspace"
        hint="The AI pedagogical workspace retrieves assigned textbook chapters from your database."
      />
    );

  if (material.loading)
    return (
      <div className="card p-12 flex justify-center border-border">
        <Spinner label="Opening curriculum workspace…" />
      </div>
    );

  if (!material.data)
    return (
      <EmptyState
        title="Curriculum material not accessible"
        hint="It may be in draft state, archived, or outside your assigned teaching subjects."
        action={
          <Link to="/teacher/materials" className="btn-outline text-xs mt-2">
            ← Back to Materials Roster
          </Link>
        }
      />
    );

  return (
    <div className="grid h-[calc(100vh-8.5rem)] gap-5 lg:grid-cols-2">
      {/* Left: Assigned Textbook Chapter Panel */}
      <div className="card flex flex-col overflow-hidden border-border">
        <div className="border-b border-border/60 p-5 bg-surface/40">
          <Link
            to="/teacher/materials"
            className="text-xs text-muted hover:text-accent font-semibold flex items-center gap-1 transition-colors"
          >
            ← Back to Materials
          </Link>
          <h1 className="mt-2 text-xl font-extrabold text-fg">{material.data.title}</h1>
          <p className="text-xs text-muted mt-0.5 font-medium">
            {material.data.chapter || "Complete Chapter Text"} · {(material.data.byte_size / 1e6).toFixed(1)} MB
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-xs text-fg leading-relaxed space-y-4">
          <div className="rounded-2xl overflow-hidden border border-border bg-surface/70 shadow-xs">
            <div className="w-full h-32 overflow-hidden bg-surface relative">
              <img
                src={curriculumImage}
                alt="Structured curriculum materials"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              <span className="absolute bottom-2.5 left-3 badge bg-white/95 text-fg text-[10px] font-bold shadow-xs">
                Verified Syllabus Text
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <span className="font-bold text-fg block text-sm">Grounded Knowledge Retrieval</span>
              <p className="text-muted leading-relaxed">
                When you ask a question or explore a concept on the right panel, KAIRO searches this verified document chunk-by-chunk and incorporates exact textbook passages and page numbers.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border p-4 text-muted">
            <span className="font-bold text-fg block mb-1">Status: Processed & Grounded</span>
            <span>Document chunks mapped to Classes 1–5 CBSE curriculum guidelines.</span>
          </div>
        </div>
      </div>

      {/* Right: Ask KAIRO Pedagogical Panel */}
      <div className="card flex flex-col overflow-hidden border-border">
        <div className="border-b border-border/60 px-5 py-3.5 bg-surface/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge bg-accent-soft text-accent text-[10px] font-bold uppercase tracking-wider border border-accent/20">AI Grounded</span>
            <h2 className="font-bold text-sm text-fg">Ask KAIRO Pedagogical Assistant</h2>
          </div>
          <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
            Chapter Grounded
          </span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {thread.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted">Try one of these lesson-prep inquiries:</p>
              <div className="flex flex-wrap gap-2">
                {suggested.map((s) => (
                  <button
                    key={s}
                    className="chip hover:bg-accent-soft hover:text-accent hover:border-accent/40 text-left cursor-pointer transition-colors text-xs py-1.5 px-3"
                    onClick={() => ask(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {thread.map((m, i) => (
            <div key={i} className="space-y-3 animate-fade-in-up">
              <div className="flex justify-end">
                <p className="rounded-2xl bg-accent text-white px-4 py-3 text-xs font-semibold max-w-[85%] rounded-br-none shadow-xs">
                  {m.q}
                </p>
              </div>

              {!m.a.grounded ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 rounded-bl-none">
                  The uploaded material does not provide sufficient context to answer this inquiry with certainty under CBSE curriculum guidelines.
                </div>
              ) : (
                <div className="rounded-2xl bg-surface/70 border border-border p-4 text-xs space-y-3 rounded-bl-none shadow-xs">
                  <p className="text-fg leading-relaxed whitespace-pre-line text-sm">{m.a.answer}</p>

                  {m.a.teachingSuggestions.length > 0 && (
                    <div className="pt-2 border-t border-border/60">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-accent mb-1.5">
                        Suggested Classroom Strategies
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-muted">
                        {m.a.teachingSuggestions.map((s, j) => (
                          <li key={j}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.a.citations.length > 0 && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-900 space-y-1">
                      <span className="font-bold text-emerald-800 block">Verified Textbook Citations:</span>
                      {m.a.citations.map((c, j) => (
                        <p key={j} className="text-emerald-950">
                          • Page {c.page ?? "?"} — “{c.quote}”
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="p-4 rounded-xl bg-surface/60 border border-border flex items-center justify-center">
              <Spinner label="KAIRO is retrieving and analyzing chapter passages…" />
            </div>
          )}
        </div>

        {/* Query Input */}
        <form
          className="border-t border-border p-3.5 bg-card flex gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <input
            className="input flex-1 py-2.5 text-xs"
            placeholder="How do I explain… to this class? What activity fits this topic?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy}
          />
          <button className="btn-primary text-xs px-5 shrink-0" disabled={busy || !question.trim()}>
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}

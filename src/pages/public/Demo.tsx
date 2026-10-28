import { useState } from "react";
import { Link } from "react-router-dom";
import { DEMO_CHAPTER, DEMO_ANSWER, DEMO_ACTIVITY, DEMO_WORKSHEET } from "@/features/curriculum/sampleData";
import { collaborativeClassroomImage } from "@/assets/generated";

const tabs = ["Ask KAIRO", "Activity", "Worksheet"] as const;

export default function Demo() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Ask KAIRO");
  const [asked, setAsked] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-border/60 pb-8">
        <div className="max-w-2xl">
          <span className="badge bg-amber-50 text-amber-800 border-amber-200 text-xs font-semibold mb-2">
            Sample Sandbox · No Supabase Required
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
            Class {DEMO_CHAPTER.class} · {DEMO_CHAPTER.subject} · {DEMO_CHAPTER.chapter}
          </h1>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Explore live curriculum grounding and pedagogical generation on sample textbook passages without external dependencies.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <img
            src={collaborativeClassroomImage}
            alt="Collaborative classroom learning session"
            className="hidden sm:block h-20 w-32 object-cover rounded-xl border border-border bg-surface shadow-xs"
          />
          <Link to="/login" className="btn-primary text-xs shrink-0">
            Sign In for Full Experience
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.35fr]">
        {/* Left: Sample Chapter Content */}
        <div className="card p-6 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-fg">
                Sample Textbook Pages
              </h2>
              <span className="text-[11px] font-semibold text-muted bg-surface px-2.5 py-0.5 rounded-full border border-border">
                Approved Curriculum
              </span>
            </div>
            <div className="space-y-3">
              {DEMO_CHAPTER.passages.map((p) => (
                <div key={p.page} className="rounded-xl bg-surface/60 border border-border/60 p-4 text-xs leading-relaxed text-fg">
                  <span className="chip mr-2 text-[10px] font-bold text-accent bg-accent-soft border-accent/20">
                    Page {p.page}
                  </span>
                  {p.text}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60 text-[11px] text-muted flex items-center gap-2">
            <span className="badge bg-slate-100 text-slate-700 text-[10px] font-semibold">Strict Guardrails</span>
            <span>All responses strictly cite these verified pages with zero hallucination.</span>
          </div>
        </div>

        {/* Right: Interactive AI Assistant / Activity / Worksheet */}
        <div className="card p-6 border-border">
          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-xl bg-surface p-1 border border-border">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === t
                    ? "bg-card text-accent shadow-xs border border-border/80"
                    : "text-muted hover:text-fg"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Ask KAIRO */}
          {tab === "Ask KAIRO" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-accent-soft/70 border border-accent/20 p-4 text-xs font-medium text-accent">
                <div>
                  <span className="font-bold block text-[11px] uppercase tracking-wider text-accent/70 mb-0.5">Teacher Question</span>
                  “How do I explain leaf veins and photosynthesis to Class 3 students?”
                </div>
              </div>

              {!asked ? (
                <button
                  className="btn-primary w-full py-2.5 text-xs"
                  onClick={() => setAsked(true)}
                >
                  Ask KAIRO Assistant
                </button>
              ) : (
                <div className="space-y-4 text-xs animate-fade-in-up">
                  <div className="rounded-2xl bg-surface/60 border border-border p-4 text-fg leading-relaxed">
                    <p className="font-medium text-fg mb-3">{DEMO_ANSWER.answer}</p>

                    <div>
                      <p className="font-bold text-[11px] text-accent uppercase tracking-wider mb-1.5">
                        Suggested Classroom Activities
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-muted">
                        {DEMO_ANSWER.teachingSuggestions.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Verified Citation Box */}
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-900 flex items-start gap-2">
                    <span className="font-bold text-emerald-700 uppercase tracking-wider">Verified Citation:</span>
                    <span>
                      Page {DEMO_ANSWER.citations[0].page} — “{DEMO_ANSWER.citations[0].quote}”
                    </span>
                  </div>

                  <button
                    onClick={() => setAsked(false)}
                    className="btn-outline text-xs w-full py-2"
                  >
                    Reset Query
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Activity */}
          {tab === "Activity" && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="font-bold text-sm text-fg">{DEMO_ACTIVITY.title}</h3>
                  <p className="text-[11px] text-muted mt-0.5">
                    {DEMO_ACTIVITY.durationMinutes} minutes · {DEMO_ACTIVITY.groupSize} · {DEMO_ACTIVITY.difficulty}
                  </p>
                </div>
                <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                  Hands-on Science
                </span>
              </div>

              <div>
                <p className="font-bold text-[11px] uppercase tracking-wider text-muted mb-2">Step-by-Step Procedure</p>
                <ol className="list-decimal space-y-2 pl-4 text-fg leading-relaxed">
                  {DEMO_ACTIVITY.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Worksheet */}
          {tab === "Worksheet" && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-bold text-sm text-fg">{DEMO_WORKSHEET.title}</h3>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  Print Ready
                </span>
              </div>

              <div className="space-y-2.5">
                {DEMO_WORKSHEET.questions.map((q, i) => (
                  <div key={i} className="rounded-xl bg-surface/50 border border-border/60 p-3.5">
                    <p className="font-semibold text-fg">
                      {i + 1}. {q.prompt}
                    </p>
                    {q.options && (
                      <p className="mt-1.5 text-muted text-[11px] font-mono">
                        {q.options.join("   ·   ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

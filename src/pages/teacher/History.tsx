import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { listHistory, deleteHistory } from "@/services/generate";
import { EmptyState, Skeleton, useToast, ConfirmDialog, SearchBar } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import type { HistoryRow } from "@/types/db";

const TYPES = ["", "activity", "worksheet", "quiz", "explanation", "summary", "lesson_plan"];

export default function History() {
  const toast = useToast();
  const { configured } = useAuth();
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const { data, loading, reload } = useAsync(
    () => (configured ? listHistory({ type: type || undefined, search: search || undefined }) : Promise.resolve([])),
    [type, search]
  );
  const [del, setDel] = useState<HistoryRow | null>(null);
  const [open, setOpen] = useState<HistoryRow | null>(null);

  // Escape key handler for resource viewer modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function doDelete() {
    if (!del) return;
    try {
      await deleteHistory(del.id);
      toast("success", "Resource deleted from history.");
      reload();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setDel(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Saved Library & Generation History"
        subtitle="All pedagogical activities, worksheets, and quizzes you have generated — private to your account."
      />

      {!configured && (
        <EmptyState title="Connect Supabase to view your saved history" />
      )}

      {configured && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search saved titles…"
              className="max-w-xs w-full"
            />

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted font-medium">Type:</span>
              <select
                className="input py-1.5 px-3 text-xs w-auto capitalize"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t ? t.replace(/_/g, " ") : "All Resource Types"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-40" />
          ) : !data?.length ? (
            <EmptyState
              title="No saved resources found"
              hint={
                search || type
                  ? "No saved resources match your query. Try clearing your filters."
                  : "Generate and save a classroom activity, worksheet, or quiz to build your library."
              }
              action={
                search || type ? (
                  <button
                    onClick={() => {
                      setSearch("");
                      setType("");
                    }}
                    className="btn-outline text-xs"
                  >
                    Clear Filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="card divide-y divide-border/60 border-border overflow-hidden">
              {data.map((h) => (
                <div
                  key={h.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 text-xs hover:bg-surface/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge bg-accent-soft text-accent border border-accent/20 text-[10px] font-bold uppercase">
                        {h.resource_type.replace(/_/g, " ")}
                      </span>
                      <span className="font-bold text-fg text-sm truncate">{h.title}</span>
                    </div>
                    {h.summary && (
                      <p className="text-muted truncate max-w-xl text-[11px]">{h.summary}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
                    <span className="text-xs text-muted">
                      {new Date(h.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <button className="btn-outline btn-sm text-xs" onClick={() => setOpen(h)}>
                      Inspect
                    </button>
                    <button
                      className="btn-ghost btn-sm text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setDel(h)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Inspect Resource Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
          onClick={() => setOpen(null)}
        >
          <div
            className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6 bg-card border border-border shadow-card-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="badge bg-accent-soft text-accent border border-accent/20 text-[10px] uppercase font-bold">
                {open.resource_type.replace(/_/g, " ")}
              </span>
              <button
                onClick={() => setOpen(null)}
                className="btn-outline text-xs px-2.5 py-1 font-semibold"
                aria-label="Close modal"
              >
                Close
              </button>
            </div>
            <h2 id="history-modal-title" className="text-xl font-extrabold text-fg">
              {open.title}
            </h2>
            <p className="mt-1 text-xs text-muted">
              Generated on {new Date(open.created_at).toLocaleString()}
            </p>

            <div className="mt-4 overflow-auto rounded-xl bg-surface/70 border border-border p-4 text-xs font-mono text-fg max-h-96">
              <pre className="whitespace-pre-wrap">{JSON.stringify(open.payload, null, 2)}</pre>
            </div>

            <div className="mt-5 flex justify-end">
              <button className="btn-outline text-xs" onClick={() => setOpen(null)}>
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!del}
        danger
        title="Delete Generated Resource?"
        body={`Are you sure you want to delete "${del?.title}"? This cannot be undone.`}
        confirmLabel="Delete Resource"
        onCancel={() => setDel(null)}
        onConfirm={doDelete}
      />
    </>
  );
}

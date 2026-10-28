import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { listMaterials } from "@/services/materials";
import { listClasses, listSubjects } from "@/services/catalog";
import { EmptyState, Skeleton, SearchBar } from "@/components/ui";

export default function Materials() {
  const materials = useAsync(() => listMaterials(), []);
  const classes = useAsync(() => listClasses(), []);
  const subjects = useAsync(() => listSubjects(), []);
  const [search, setSearch] = useState("");
  const [subj, setSubj] = useState("");

  // RLS already restricts to authorized, ready + published materials.
  const filtered = useMemo(() => {
    return (materials.data ?? []).filter(
      (m) =>
        (!subj || m.subject_id === subj) &&
        (!search ||
          m.title.toLowerCase().includes(search.toLowerCase()) ||
          m.chapter.toLowerCase().includes(search.toLowerCase()))
    );
  }, [materials.data, subj, search]);

  return (
    <>
      <PageHeader
        title="My Curriculum Materials"
        subtitle="Approved textbooks and teaching resources strictly filtered to your assigned classes and subjects."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by title or chapter…"
          className="max-w-xs w-full"
        />

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted font-medium">Subject:</span>
          <select
            className="input py-1.5 px-3 text-xs w-auto"
            value={subj}
            onChange={(e) => setSubj(e.target.value)}
          >
            <option value="">All Assigned Subjects</option>
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {materials.error && (
        <div role="alert" className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {materials.error}
        </div>
      )}

      {materials.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !filtered.length ? (
        <EmptyState
          title="No materials available"
          hint={
            search || subj
              ? "No materials match your current filter. Try adjusting or clearing your search."
              : "When your administrator publishes approved materials for your assigned subjects, they will appear here."
          }
          action={
            search || subj ? (
              <button
                onClick={() => {
                  setSearch("");
                  setSubj("");
                }}
                className="btn-outline text-xs"
              >
                Clear Filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const c = classes.data?.find((x) => x.id === m.class_id);
            const s = subjects.data?.find((x) => x.id === m.subject_id);
            return (
              <Link
                key={m.id}
                to={`/teacher/workspace/${m.id}`}
                className="card p-5 border-border hover:border-accent/40 hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="badge bg-surface text-muted border border-border text-[10px]">
                      Class {c?.grade ?? "?"}
                    </span>
                    <span className="badge bg-accent-soft text-accent border border-accent/20 text-[10px] font-bold">
                      {s?.name ?? "Subject"}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-fg group-hover:text-accent transition-colors">
                    {m.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {m.chapter || "Complete Document"} · {(m.byte_size / 1e6).toFixed(1)} MB
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-accent">
                  <span>Open AI Workspace</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

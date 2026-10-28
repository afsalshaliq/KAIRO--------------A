import React, { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { listClasses, listSubjects } from "@/services/catalog";
import {
  listMaterials,
  uploadMaterial,
  setPublished,
  retryProcessing,
  archiveMaterial,
  validateFile,
} from "@/services/materials";
import { EmptyState, Skeleton, StatusBadge, useToast, ConfirmDialog, SearchBar } from "@/components/ui";
import { curriculumImage } from "@/assets/generated";

export default function Materials() {
  const toast = useToast();
  const materials = useAsync(() => listMaterials(), []);
  const classes = useAsync(() => listClasses(), []);
  const subjects = useAsync(() => listSubjects(), []);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({
    title: "",
    classId: "",
    subjectId: "",
    chapter: "",
    academicYear: "2025-2026",
  });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [archiveId, setArchiveId] = useState<string | null>(null);

  async function doUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast("error", "Choose a curriculum file to upload.");
      return;
    }
    const fe = validateFile(file);
    if (fe) {
      toast("error", fe);
      return;
    }
    if (!meta.title || !meta.classId || !meta.subjectId) {
      toast("error", "Title, class and subject are required.");
      return;
    }
    setBusy(true);
    try {
      await uploadMaterial(file, { ...meta, sectionId: null });
      toast("success", "Uploaded — background processing and chunking initiated.");
      setFile(null);
      setMeta({ ...meta, title: "", chapter: "" });
      materials.reload();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setBusy(false);
    }
  }

  const filteredMaterials = useMemo(() => {
    return (materials.data ?? []).filter((m) => {
      const matchesSearch =
        !search ||
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.chapter.toLowerCase().includes(search.toLowerCase());
      const matchesSubj = !selectedSubject || m.subject_id === selectedSubject;
      return matchesSearch && matchesSubj;
    });
  }, [materials.data, search, selectedSubject]);

  return (
    <>
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-border/60 pb-6">
        <div>
          <PageHeader
            title="Curriculum Materials"
            subtitle="Upload, process, and publish approved CBSE textbooks and documents. Teachers only access ready and published materials for their assigned subjects."
          />
        </div>
        <div className="hidden lg:block shrink-0">
          <img
            src={curriculumImage}
            alt="Approved textbook curriculum volumes and syllabi"
            className="h-24 w-32 object-cover rounded-xl border border-border shadow-xs"
          />
        </div>
      </div>

      {/* Upload Panel */}
      <form onSubmit={doUpload} className="card mb-8 grid gap-4 p-6 md:grid-cols-2 border-border">
        <div className="md:col-span-2 flex items-center justify-between pb-2 border-b border-border/60">
          <h2 className="text-base font-bold text-fg">
            Upload Approved Curriculum Document
          </h2>
          <span className="text-xs text-muted">PDF, DOCX, PPTX, TXT · Up to 25 MB</span>
        </div>

        <div>
          <label className="label">Material Title</label>
          <input
            className="input"
            placeholder="e.g. Science - Plants Around Us"
            value={meta.title}
            onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label">Chapter Reference (optional)</label>
          <input
            className="input"
            placeholder="e.g. Chapter 3: Parts of a Plant"
            value={meta.chapter}
            onChange={(e) => setMeta({ ...meta, chapter: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Target Class / Grade</label>
          <select
            className="input"
            value={meta.classId}
            onChange={(e) => setMeta({ ...meta, classId: e.target.value })}
            required
          >
            <option value="">Select Grade Level…</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Class {c.grade} ({c.academic_year})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Subject</label>
          <select
            className="input"
            value={meta.subjectId}
            onChange={(e) => setMeta({ ...meta, subjectId: e.target.value })}
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

        <div className="md:col-span-2">
          <label className="label">File Document</label>
          <input
            className="input p-2 text-xs"
            type="file"
            accept=".pdf,.docx,.pptx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>

        <div className="md:col-span-2 pt-2 flex items-center justify-between">
          <button className="btn-primary" disabled={busy}>
            {busy ? "Uploading Document…" : "Upload & Begin Processing"}
          </button>
          {file && (
            <span className="text-xs text-muted">
              Selected: <strong className="text-fg">{file.name}</strong> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          )}
        </div>
      </form>

      {/* Filter and Search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Filter materials by title or chapter…"
          className="max-w-xs w-full"
        />

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Subject:</span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="input py-1 px-3 text-xs w-auto"
          >
            <option value="">All Subjects</option>
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {materials.error && (
        <div role="alert" className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
          {materials.error}
        </div>
      )}

      {materials.loading ? (
        <Skeleton className="h-48" />
      ) : !materials.data?.length ? (
        <EmptyState
          title="No curriculum materials uploaded yet"
          hint="Upload your school's textbooks and syllabus documents above to initiate automated chapter chunking."
        />
      ) : !filteredMaterials.length ? (
        <EmptyState
          title="No materials matched your search"
          hint="Try clearing your search query or subject filter."
          action={
            <button
              onClick={() => {
                setSearch("");
                setSelectedSubject("");
              }}
              className="btn-outline text-xs"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface text-muted text-xs font-semibold uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Document Title</th>
                  <th className="px-4 py-3">Processing Status</th>
                  <th className="px-4 py-3">Publish State</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredMaterials.map((m) => (
                  <tr key={m.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-fg">{m.title}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {m.chapter ? `${m.chapter} · ` : ""}
                        {(m.byte_size / 1e6).toFixed(1)} MB
                      </div>
                      {m.error_message && (
                        <div className="text-xs text-rose-600 mt-1 font-medium">
                          Processing error: {m.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      {m.is_published ? (
                        <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
                          Published
                        </span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600 border border-slate-200 text-xs">
                          Draft (Hidden)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        {m.status === "failed" && (
                          <button
                            className="btn-outline btn-sm"
                            onClick={() =>
                              retryProcessing(m.id)
                                .then(materials.reload)
                                .catch((e) => toast("error", e.message))
                            }
                          >
                            Retry
                          </button>
                        )}
                        {m.status === "ready" && (
                          <button
                            className="btn-outline btn-sm"
                            onClick={() =>
                              setPublished(m.id, !m.is_published)
                                .then(() => {
                                  toast("success", m.is_published ? "Unpublished" : "Published to faculty");
                                  materials.reload();
                                })
                                .catch((e) => toast("error", e.message))
                            }
                          >
                            {m.is_published ? "Unpublish" : "Publish"}
                          </button>
                        )}
                        <button
                          className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => setArchiveId(m.id)}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!archiveId}
        danger
        title="Archive Curriculum Material?"
        body="It will be unpublished and hidden from teachers. All previous lesson generations remain intact."
        confirmLabel="Archive Material"
        onCancel={() => setArchiveId(null)}
        onConfirm={() => {
          if (archiveId)
            archiveMaterial(archiveId)
              .then(() => {
                toast("success", "Curriculum material archived.");
                materials.reload();
              })
              .catch((e) => toast("error", e.message));
          setArchiveId(null);
        }}
      />
    </>
  );
}

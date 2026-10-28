import React, { useState, useRef, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { listTeachers } from "@/services/catalog";
import { inviteTeacher, resendInvite, setTeacherStatus, sendPasswordRecovery } from "@/services/admin";
import { validateTeacherImportCSV, executeTeacherImport, type ImportValidationResult } from "@/services/bulkImport";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { inviteTeacherSchema } from "@/lib/schemas";
import { EmptyState, Skeleton, StatusBadge, ConfirmDialog, useToast, SearchBar } from "@/components/ui";

export default function Teachers() {
  const toast = useToast();
  const { profile } = useAuth();
  const { school } = useTenant();

  const { data, loading, error, reload } = useAsync(() => listTeachers(), []);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const schoolKey = school?.slug || school?.name?.toLowerCase().replace(/\s+/g, "") || "school";
  const defaultTeacherPassword = `teacher@${schoolKey}`;
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirm, setConfirm] = useState<null | { id: string; status: "suspended" | "active" | "deactivated"; label: string }>(null);

  // Bulk Import state
  const [importModal, setImportModal] = useState(false);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Escape key listener for bulk import modal
  useEffect(() => {
    if (!importModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImportModal(false);
        setValidationResult(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [importModal]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const parsed = inviteTeacherSchema.safeParse({ email, fullName: name });
    if (!parsed.success) {
      toast("error", parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const passwordToUse = password.trim() || defaultTeacherPassword;
    try {
      await inviteTeacher(parsed.data.email, parsed.data.fullName, {
        schoolId: school?.id,
        password: passwordToUse,
      });
      toast("success", `Created teacher account for ${parsed.data.email} with password: ${passwordToUse}`);
      setEmail("");
      setName("");
      setPassword("");
      reload();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: "suspended" | "active" | "deactivated") {
    try {
      await setTeacherStatus(id, status);
      toast("success", "Status updated successfully.");
      reload();
    } catch (err: any) {
      toast("error", err.message);
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = String(evt.target?.result || "");
      const existing = (data || []).map((t) => t.email);
      try {
        const res = await validateTeacherImportCSV(text, existing);
        setValidationResult(res);
      } catch (err: any) {
        toast("error", err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmBulkImport = async () => {
    if (!validationResult || !validationResult.validRows.length || !school || !profile) return;
    setImporting(true);
    try {
      const { created, errors } = await executeTeacherImport({
        schoolId: school.id,
        actorsId: profile.id,
        teachers: validationResult.validRows,
        defaultPassword: defaultTeacherPassword,
      });

      if (created > 0) {
        toast("success", `Successfully imported ${created} teacher accounts with default password: ${defaultTeacherPassword}`);
        setImportModal(false);
        setValidationResult(null);
        reload();
      }
      if (errors.length > 0) {
        toast("error", `Import notices: ${errors.join(", ")}`);
      }
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setImporting(false);
    }
  };

  const filteredTeachers = useMemo(() => {
    return (data || []).filter((t) => {
      const matchesSearch =
        !search ||
        (t.full_name && t.full_name.toLowerCase().includes(search.toLowerCase())) ||
        t.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <PageHeader
          title="Teachers"
          subtitle={`Manage faculty credentials and status for ${school?.name || "your school"}.`}
        />
        <button
          onClick={() => setImportModal(true)}
          className="btn-outline text-xs flex items-center gap-2 whitespace-nowrap mb-6"
        >
          <span>Bulk CSV Import</span>
        </button>
      </div>

      {/* Invite Form */}
      <form onSubmit={invite} className="card mb-6 grid gap-3 p-5 sm:grid-cols-[1.2fr_1.2fr_1.2fr_auto] border-border items-end">
        <div>
          <label className="block text-xs font-semibold text-fg mb-1">
            Teacher Full Name <span className="text-accent">*</span>
          </label>
          <input
            className="input w-full"
            placeholder="Teacher Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-fg mb-1">
            Email Address <span className="text-accent">*</span>
          </label>
          <input
            className="input w-full"
            type="email"
            placeholder="name@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-fg mb-1">
            Initial Password (Default)
          </label>
          <input
            className="input w-full font-mono text-xs bg-surface"
            placeholder={defaultTeacherPassword}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn-primary whitespace-nowrap h-[42px]" disabled={busy}>
          {busy ? "Creating…" : "Add Teacher"}
        </button>
      </form>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name or email…"
          className="max-w-xs w-full"
        />

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input py-1 px-3 text-xs w-auto"
          >
            <option value="all">All ({data?.length || 0})</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-48" />
      ) : !data?.length ? (
        <EmptyState
          title="No teachers registered yet"
          hint="Invite your first teacher above or import multiple faculty records via CSV."
          action={
            <button onClick={() => setImportModal(true)} className="btn-primary text-xs">
              Upload CSV Roster
            </button>
          }
        />
      ) : !filteredTeachers.length ? (
        <EmptyState
          title="No matching teachers found"
          hint="Try adjusting your search query or status filter."
          action={
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="btn-outline text-xs">
              Clear Filters
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface text-muted text-xs font-semibold uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Faculty Member</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTeachers.map((t) => (
                  <tr key={t.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-fg">
                      {t.full_name || "—"}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted">
                      {t.email}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-[10px] uppercase font-bold">
                        {t.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {t.status === "active" ? (
                          <button
                            className="btn-outline btn-sm hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() =>
                              setConfirm({
                                id: t.id,
                                status: "suspended",
                                label: `Suspend access for ${t.full_name || t.email}? They will be immediately blocked from signing in.`,
                              })
                            }
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            className="btn-outline btn-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => changeStatus(t.id, "active")}
                          >
                            Activate
                          </button>
                        )}
                        <button
                          className="btn-ghost btn-sm text-muted hover:text-fg"
                          onClick={() =>
                            resendInvite(t.email)
                              .then(() => toast("success", "Invitation resent"))
                              .catch((e) => toast("error", e.message))
                          }
                          title="Resend invitation email"
                        >
                          Resend
                        </button>
                        <button
                          className="btn-ghost btn-sm text-muted hover:text-fg"
                          onClick={() =>
                            sendPasswordRecovery(t.email)
                              .then(() => toast("success", "Recovery link sent"))
                              .catch((e) => toast("error", e.message))
                          }
                          title="Send password recovery link"
                        >
                          Reset PW
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

      {/* Bulk CSV Import Modal */}
      {importModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="csv-modal-title"
          onClick={() => {
            setImportModal(false);
            setValidationResult(null);
          }}
        >
          <div
            className="card w-full max-w-2xl p-6 bg-card border border-border shadow-card-elevated relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 id="csv-modal-title" className="text-lg font-bold text-fg">
                Bulk Teacher Roster Import
              </h2>
              <button
                type="button"
                onClick={() => {
                  setImportModal(false);
                  setValidationResult(null);
                }}
                className="btn-outline text-xs px-2.5 py-1 font-semibold"
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Upload a standard CSV roster containing headers:{" "}
              <code className="font-mono bg-surface px-1.5 py-0.5 rounded border border-border text-fg">
                Email, Full Name, Department, Phone
              </code>
            </p>

            <div className="mb-4 p-3 rounded-xl bg-surface border border-border flex items-center justify-between text-xs">
              <div>
                <span className="text-muted block text-[11px]">Default Password for Imported Accounts:</span>
                <code className="font-mono font-bold text-fg">{defaultTeacherPassword}</code>
              </div>
              <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Auto-Assigned</span>
            </div>

            <div className="mb-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-outline text-xs w-full py-6 border-dashed border-2 flex flex-col items-center justify-center gap-1.5 text-muted hover:text-fg hover:border-accent"
              >
                <span className="badge bg-accent-soft text-accent text-xs font-bold uppercase tracking-wider mb-1">CSV File</span>
                <span className="font-semibold text-fg">Click to select CSV roster from computer</span>
                <span className="text-[11px] text-muted">UTF-8 encoded comma-separated file</span>
              </button>
            </div>

            {validationResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl">
                    <span className="font-extrabold text-xl block">{validationResult.validRows.length}</span>
                    <span className="text-xs">Valid Records</span>
                  </div>
                  <div className="bg-amber-50 text-amber-800 border border-amber-200 p-3 rounded-xl">
                    <span className="font-extrabold text-xl block">{validationResult.duplicates.length}</span>
                    <span className="text-xs">Duplicates Skipped</span>
                  </div>
                  <div className="bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-xl">
                    <span className="font-extrabold text-xl block">{validationResult.invalidRows.length}</span>
                    <span className="text-xs">Errors Found</span>
                  </div>
                </div>

                {/* Preview Valid */}
                {validationResult.validRows.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-fg mb-1.5">Valid Entries for Creation:</h3>
                    <div className="max-h-40 overflow-y-auto border border-border rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface text-muted">
                          <tr>
                            <th className="p-2">Name</th>
                            <th className="p-2">Email</th>
                            <th className="p-2">Department</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {validationResult.validRows.map((r, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-medium text-fg">{r.fullName}</td>
                              <td className="p-2 font-mono text-[11px] text-muted">{r.email}</td>
                              <td className="p-2 text-muted">{r.department || "General"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Validation Errors */}
                {validationResult.invalidRows.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-rose-700 mb-1">Rows with Formatting Issues:</h3>
                    <div className="max-h-28 overflow-y-auto bg-rose-50/70 p-3 rounded-xl text-xs space-y-1 text-rose-800 border border-rose-200">
                      {validationResult.invalidRows.map((err, idx) => (
                        <div key={idx}>
                          Line {err.row}: {err.errors.join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-5 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => {
                  setImportModal(false);
                  setValidationResult(null);
                }}
                className="btn-outline text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!validationResult || validationResult.validRows.length === 0 || importing}
                onClick={handleConfirmBulkImport}
                className="btn-primary text-xs"
              >
                {importing ? "Importing Roster…" : `Confirm & Import ${validationResult?.validRows.length || 0} Faculty Members`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        danger
        title="Confirm Suspension"
        body={confirm?.label}
        confirmLabel="Suspend Access"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) changeStatus(confirm.id, confirm.status);
          setConfirm(null);
        }}
      />
    </>
  );
}

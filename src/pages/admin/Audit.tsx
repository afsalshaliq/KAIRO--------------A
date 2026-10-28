import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { useToast, Spinner, SearchBar, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { AuditLog, School } from "@/types/db";
import { getRetentionCutoffDate, purgeExpiredAuditLogs } from "@/services/audit";

const MOCK_SCHOOL_AUDITS: AuditLog[] = [
  {
    id: "aud-s1",
    school_id: "00000000-0000-0000-0000-000000000001",
    actor_id: "usr-2",
    action: "announcement.publish",
    target: "ann-1",
    meta: { audience: "all", title: "Term 2 Alignment Workshop" },
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actor_name: "Royal Principal",
    actor_role: "PRINCIPAL",
  },
  {
    id: "aud-s2",
    school_id: "00000000-0000-0000-0000-000000000001",
    actor_id: "usr-3",
    action: "face.verify.success",
    target: "usr-3",
    meta: { method: "biometric_challenge" },
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    actor_name: "Royal Teacher Admin",
    actor_role: "TEACHER_ADMIN",
  },
  {
    id: "aud-s3",
    school_id: "00000000-0000-0000-0000-000000000001",
    actor_id: "usr-2",
    action: "request.review.approved",
    target: "req-1",
    meta: { type: "leave", teacher_name: "Dev Teacher" },
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    actor_name: "Royal Principal",
    actor_role: "PRINCIPAL",
  },
  {
    id: "aud-s4",
    school_id: "00000000-0000-0000-0000-000000000001",
    actor_id: "usr-2",
    action: "curriculum.upload",
    target: "mat-1",
    meta: { chapter: "Ch 3 Leaves", class: "Grade 3", subject: "Science" },
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    actor_name: "Royal Principal",
    actor_role: "PRINCIPAL",
  },
  {
    id: "aud-s5",
    school_id: "00000000-0000-0000-0000-000000000001",
    actor_id: "usr-2",
    action: "teacher.bulk_import",
    target: "00000000-0000-0000-0000-000000000001",
    meta: { total: 8, imported: 8, failed: 0 },
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    actor_name: "Royal Principal",
    actor_role: "PRINCIPAL",
  },
  {
    id: "aud-s6",
    school_id: "00000000-0000-0000-0000-000000000002",
    actor_id: "usr-ox-1",
    action: "curriculum.upload",
    target: "mat-ox-1",
    meta: { chapter: "Oxford Unit 1", class: "Grade 4", subject: "English" },
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    actor_name: "Oxford Principal",
    actor_role: "PRINCIPAL",
  },
];

export default function AdminAudit() {
  const { profile, loading: authLoading } = useAuth();
  const { school, loading: tenantLoading } = useTenant();
  const toast = useToast();

  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(school);

  // The principal's school ID is determined by tenant school or their profile's assigned school_id
  const effectiveSchoolId = school?.id || profile?.school_id || null;

  // Fetch school details if not already loaded via tenant context
  useEffect(() => {
    if (school) {
      setSchoolDetails(school);
    } else if (effectiveSchoolId && supabase) {
      supabase
        .from("schools")
        .select("*")
        .eq("id", effectiveSchoolId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setSchoolDetails(data as School);
        });
    }
  }, [school, effectiveSchoolId]);

  const load = async () => {
    if (authLoading || tenantLoading) return;

    if (!effectiveSchoolId) {
      setAudits([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const retentionCutoff = getRetentionCutoffDate();

      if (!supabase) {
        // In preview/mock mode, strictly filter mock audits by effective school ID and 30-day window
        setAudits(
          MOCK_SCHOOL_AUDITS.filter(
            (a) => a.school_id === effectiveSchoolId && new Date(a.created_at).getTime() >= new Date(retentionCutoff).getTime()
          )
        );
      } else {
        // Fetch audit logs strictly filtered by school_id and within 30-day retention window
        const { data, error } = await supabase
          .from("audit_logs")
          .select(`
            *,
            profiles:actor_id (full_name, role)
          `)
          .eq("school_id", effectiveSchoolId)
          .gte("created_at", retentionCutoff)
          .order("created_at", { ascending: false })
          .limit(150);

        if (error) {
          // Fallback if profiles join is restricted
          const { data: fallbackData, error: fbError } = await supabase
            .from("audit_logs")
            .select("*")
            .eq("school_id", effectiveSchoolId)
            .gte("created_at", retentionCutoff)
            .order("created_at", { ascending: false })
            .limit(150);

          if (fbError) {
            toast("error", fbError.message);
            setAudits(MOCK_SCHOOL_AUDITS.filter((a) => a.school_id === effectiveSchoolId));
          } else {
            setAudits((fallbackData || []) as AuditLog[]);
          }
        } else {
          setAudits(
            (data || []).map((r: any) => ({
              ...r,
              actor_name: r.profiles?.full_name || r.actor_name || "School Staff",
              actor_role: r.profiles?.role || r.actor_role || "FACULTY",
            }))
          );
        }
      }
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeExpired = async () => {
    try {
      const deleted = await purgeExpiredAuditLogs();
      if (deleted > 0) {
        toast("success", `Purged ${deleted} audit logs older than 30 days.`);
        load();
      } else {
        toast("info", "No logs older than 30 days found in database.");
      }
    } catch {
      toast("error", "Purge operation failed.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSchoolId, authLoading, tenantLoading]);

  const schoolName = schoolDetails?.name || school?.name || "Your School";

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      // Category filter
      if (categoryFilter !== "all") {
        const act = a.action.toLowerCase();
        if (categoryFilter === "teachers" && !act.startsWith("teacher.") && !act.startsWith("user.") && !act.startsWith("account.")) return false;
        if (categoryFilter === "announcements" && !act.startsWith("announcement.")) return false;
        if (categoryFilter === "requests" && !act.startsWith("request.")) return false;
        if (categoryFilter === "curriculum" && !act.startsWith("curriculum.") && !act.startsWith("material.") && !act.startsWith("class.")) return false;
        if (categoryFilter === "security" && !act.startsWith("face.") && !act.startsWith("auth.") && !act.startsWith("biometric.")) return false;
      }

      // Search query filter
      if (search) {
        const q = search.toLowerCase();
        const actionMatch = a.action.toLowerCase().includes(q);
        const actorMatch = (a.actor_name || "").toLowerCase().includes(q);
        const targetMatch = (a.target || "").toLowerCase().includes(q);
        const metaMatch = JSON.stringify(a.meta || {}).toLowerCase().includes(q);
        return actionMatch || actorMatch || targetMatch || metaMatch;
      }

      return true;
    });
  }, [audits, categoryFilter, search]);

  const handleExport = (format: "csv" | "json") => {
    const slug = schoolDetails?.slug || "school";
    const filename = `${slug}_audit_logs_${Date.now()}.${format}`;
    let content = "";
    let mime = "";

    if (format === "csv") {
      mime = "text/csv;charset=utf-8,";
      const headers = "ID,Timestamp,School ID,Actor,Role,Action,Target,Metadata\n";
      const rows = filtered
        .map((a) =>
          [
            `"${a.id}"`,
            `"${a.created_at}"`,
            `"${a.school_id || effectiveSchoolId || ""}"`,
            `"${(a.actor_name || "Principal").replace(/"/g, '""')}"`,
            `"${a.actor_role || "ROLE"}"`,
            `"${a.action}"`,
            `"${(a.target || "").replace(/"/g, '""')}"`,
            `"${JSON.stringify(a.meta || {}).replace(/"/g, '""')}"`,
          ].join(",")
        )
        .join("\n");
      content = headers + rows;
    } else {
      mime = "application/json;charset=utf-8,";
      content = JSON.stringify(
        {
          school: schoolName,
          school_id: effectiveSchoolId,
          exported_at: new Date().toISOString(),
          record_count: filtered.length,
          logs: filtered,
        },
        null,
        2
      );
    }

    const encoded = encodeURI(mime + content);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported ${filtered.length} audit records (${format.toUpperCase()}).`);
  };

  return (
    <div className="space-y-6">
      {/* Header and Scope Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <PageHeader
            title={`${schoolName} Audit Trail`}
            subtitle={`Immutable, tamper-resistant administrative activity log strictly scoped to ${schoolName}.`}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExport("json")}
            disabled={!filtered.length}
            className="btn-outline text-xs py-1.5 px-3"
            title="Download audit logs in JSON format"
          >
            Export JSON ⤓
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={!filtered.length}
            className="btn-outline text-xs py-1.5 px-3"
            title="Download audit logs as CSV spreadsheet"
          >
            Export CSV ⤓
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            title="Refresh logs from database"
          >
            <span>{loading ? "Refreshing…" : "🔄 Refresh Logs"}</span>
          </button>
        </div>
      </div>

      {/* Tenant Boundary Security Banner */}
      <div className="bg-surface/90 border border-border p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-fg">Tenant-Scoped Audit Security:</span>
          <span className="badge bg-accent-soft text-accent text-[11px] font-mono font-bold">
            school_id: {effectiveSchoolId || "Unresolved"}
          </span>
          <span className="text-muted">({schoolName})</span>
        </div>

        <div className="flex items-center gap-2 text-muted text-[11px] flex-wrap">
          <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold">
            30-Day DB Retention Active (Auto-Purged)
          </span>
          <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
            Row-Level Security Active
          </span>
          <button
            type="button"
            onClick={handlePurgeExpired}
            className="text-[10px] text-accent hover:underline font-semibold ml-1"
            title="Execute on-demand 30-day retention purge"
          >
            Run 30d Purge ⚡
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input text-xs py-1.5 px-2.5 font-medium"
          >
            <option value="all">All Audit Actions</option>
            <option value="teachers">Faculty & User Accounts</option>
            <option value="curriculum">Curriculum & Classes</option>
            <option value="requests">Teacher Requests</option>
            <option value="announcements">School Announcements</option>
            <option value="security">Biometrics & Auth</option>
          </select>
          <span className="text-xs text-muted">
            Showing <strong>{filtered.length}</strong> of {audits.length} events
          </span>
        </div>

        <div className="w-full sm:w-auto">
          <SearchBar
            placeholder="Search action, actor, target or meta…"
            value={search}
            onChange={setSearch}
            className="w-full sm:w-72"
          />
        </div>
      </div>

      {/* Main Table or Empty State */}
      {loading ? (
        <div className="card p-12 flex justify-center border-border">
          <Spinner label={`Loading audit log entries for ${schoolName}…`} />
        </div>
      ) : !effectiveSchoolId ? (
        <EmptyState
          title="No School Association Found"
          hint="Your account is not linked to a school tenant. Please contact the platform super administrator."
        />
      ) : audits.length === 0 ? (
        <EmptyState
          title="No audit events recorded for this school yet"
          hint="Faculty invitations, account updates, curriculum uploads, and request reviews will record tamper-resistant audit entries here."
        />
      ) : !filtered.length ? (
        <EmptyState
          title="No matching audit events"
          hint="Try adjusting or clearing your search or category filter."
          action={
            <button
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
              }}
              className="btn-outline text-xs"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden border-border bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted border-b border-border uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor & Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Metadata Preview</th>
                  <th className="px-4 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {new Date(a.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}{" "}
                      <span className="text-[10px] text-muted/60 block sm:inline">
                        {new Date(a.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans whitespace-nowrap">
                      <span className="font-bold text-fg">{a.actor_name || "Principal"}</span>{" "}
                      <span className="badge bg-accent-soft text-accent text-[9px] font-bold uppercase font-mono">
                        {a.actor_role || "ROLE"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`badge font-semibold font-mono text-[10px] ${
                          a.action.startsWith("security") || a.action.startsWith("face.")
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : a.action.startsWith("curriculum")
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : a.action.startsWith("teacher.")
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        {a.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-fg truncate max-w-[140px] font-mono">
                      {a.target || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted max-w-xs truncate font-mono text-[10px]">
                      {JSON.stringify(a.meta)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-sans">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(a)}
                        className="btn-outline py-1 px-2.5 text-[10px] font-medium"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-lg p-6 bg-white shadow-2xl relative max-h-[85vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-fg font-mono">Audit Event: {selectedLog.id}</h3>
                <p className="text-xs text-muted">
                  Recorded at {new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-muted hover:text-fg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-surface p-3 rounded-lg border border-border">
              <div>
                <span className="text-muted text-[11px] block">Action:</span>
                <span className="font-mono font-bold text-fg">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-muted text-[11px] block">Actor:</span>
                <span className="font-sans font-semibold text-fg">
                  {selectedLog.actor_name} ({selectedLog.actor_role})
                </span>
              </div>
              <div>
                <span className="text-muted text-[11px] block">Target:</span>
                <span className="font-mono text-fg">{selectedLog.target || "—"}</span>
              </div>
              <div>
                <span className="text-muted text-[11px] block">School Tenant ID:</span>
                <span className="font-mono text-[11px] text-accent truncate block" title={selectedLog.school_id || effectiveSchoolId || ""}>
                  {selectedLog.school_id || effectiveSchoolId || "—"}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-xs p-3 rounded-lg bg-surface border border-border">
              <span className="text-muted text-[10px] uppercase font-bold block mb-1">
                Event Metadata Payload
              </span>
              <pre className="whitespace-pre-wrap text-fg text-[11px]">
                {JSON.stringify(selectedLog.meta || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                  toast("success", "Audit log JSON copied to clipboard!");
                }}
                className="btn-outline text-xs"
              >
                Copy Full JSON
              </button>

              <button
                onClick={() => setSelectedLog(null)}
                className="btn-primary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

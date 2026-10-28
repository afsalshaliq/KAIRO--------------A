import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { listSchools } from "@/services/tenant";
import { useToast, Spinner, SearchBar, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { AuditLog, School } from "@/types/db";
import { getRetentionCutoffDate } from "@/services/audit";

export default function SuperAudit() {
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const toast = useToast();

  const load = async () => {
    try {
      const schs = await listSchools();
      setSchools(schs);

      if (!supabase) {
        setAudits([]);
      } else {
        const { data, error } = await supabase
          .from("audit_logs")
          .select(`
            *,
            profiles:actor_id (full_name, role)
          `)
          .gte("created_at", getRetentionCutoffDate())
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) {
          toast("error", error.message);
          setAudits([]);
        } else {
          setAudits(
            (data || []).map((r: any) => ({
              ...r,
              actor_name: r.profiles?.full_name || "System Actor",
              actor_role: r.profiles?.role || "SYSTEM",
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSchoolName = (schoolId: string | null | undefined) => {
    if (!schoolId) return "Global Platform";
    const found = schools.find((s) => s.id === schoolId);
    return found ? found.name : schoolId;
  };

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      if (schoolFilter !== "all" && a.school_id !== schoolFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.action.toLowerCase().includes(q) ||
          a.actor_name?.toLowerCase().includes(q) ||
          a.target?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [audits, schoolFilter, search]);

  const handleExport = () => {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filtered, null, 2));
    const dl = document.createElement("a");
    dl.setAttribute("href", jsonStr);
    dl.setAttribute("download", `kairo_audit_trail_${Date.now()}.json`);
    dl.click();
    toast("success", `Exported ${filtered.length} audit entries.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Security Audit Trail"
        subtitle="Immutable platform-wide audit log of administrative actions, credential verifications, role modifications, and cross-tenant operations."
        badge="Platform Telemetry"
        action={
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="btn-outline text-xs flex items-center gap-1.5"
          >
            <span>Export Audit Trail (JSON)</span> ⤓
          </button>
        }
      />

      <div className="card p-4 flex flex-wrap gap-3 items-center justify-between border border-border shadow-xs bg-white">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="w-full sm:w-72">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search actions, actors, targets…"
            />
          </div>

          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            className="input text-xs w-auto py-1.5"
          >
            <option value="all">All School Tenants ({schools.length})</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-muted font-medium">
          Showing <strong>{filtered.length}</strong> real audit events
        </span>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center">
          <Spinner label="Querying live audit trail from database…" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search || schoolFilter !== "all" ? "No matching audit entries" : "Audit trail empty"}
          description="No security audit records were found matching your current filter criteria."
        />
      ) : (
        <div className="card overflow-hidden border border-border shadow-xs bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted border-b border-border uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Tenant Realm</th>
                  <th className="px-4 py-3">Actor & Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Metadata</th>
                  <th className="px-4 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-surface/50 transition">
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-fg">
                      {getSchoolName(a.school_id)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-fg font-sans">{a.actor_name || "Unknown"}</span>
                      <span className="ml-1 text-[10px] text-accent uppercase font-bold">
                        [{a.actor_role || "ROLE"}]
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-indigo-50 text-indigo-700 font-semibold font-mono text-[10px] border border-indigo-200">
                        {a.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted truncate max-w-[140px]">
                      {a.target || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted max-w-xs truncate font-mono text-[10px]">
                      {JSON.stringify(a.meta || {})}
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(a)}
                        className="btn-outline py-0.5 px-2 text-[10px]"
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

      {/* AUDIT LOG ENTRY INSPECTION MODAL */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-lg p-6 bg-white shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-fg">Audit Entry: {selectedLog.action}</h3>
                <p className="text-xs text-muted font-mono">{selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-muted hover:text-fg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-surface border border-border">
                <div>
                  <span className="text-muted block text-[10px] uppercase">Actor</span>
                  <span className="font-bold text-fg">{selectedLog.actor_name}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase">Role</span>
                  <span className="font-bold text-accent uppercase">{selectedLog.actor_role}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase">Target Resource</span>
                  <span className="font-mono text-fg">{selectedLog.target || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase">School Tenant</span>
                  <span className="font-medium text-fg">{getSchoolName(selectedLog.school_id)}</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-fg block mb-1">Sanitized Event Metadata</span>
                <div className="font-mono text-xs p-3 rounded-lg bg-surface border border-border overflow-y-auto max-h-48">
                  <pre className="whitespace-pre-wrap text-fg">
                    {JSON.stringify(selectedLog.meta || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn-outline text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

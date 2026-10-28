import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { listRequests, reviewRequest } from "@/services/requests";
import { useToast, Spinner, StatusBadge, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { TeacherRequest, RequestStatus } from "@/types/db";

export default function AdminRequests() {
  const { profile } = useAuth();
  const { school } = useTenant();
  const toast = useToast();

  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [selectedReq, setSelectedReq] = useState<TeacherRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // Escape key handler for review modal
  useEffect(() => {
    if (!selectedReq) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedReq(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedReq]);

  const load = async () => {
    if (!school) return;
    try {
      const data = await listRequests({
        schoolId: school.id,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setRequests(data);
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
  }, [school, statusFilter]);

  const handleReview = async (status: "approved" | "rejected") => {
    if (!selectedReq || !profile || !school) return;
    try {
      await reviewRequest({
        requestId: selectedReq.id,
        reviewerId: profile.id,
        status,
        reviewNotes,
        schoolId: school.id,
      });
      toast("success", `Request ${status} successfully.`);
      setSelectedReq(null);
      setReviewNotes("");
      load();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Teacher Requests & Approvals"
          subtitle={`Review and adjudicate faculty leave requests, extra period covers, and administrative delegation at ${school?.name || "your school"}.`}
        />

        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-muted font-medium">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input py-1 px-3 text-xs w-auto"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center border-border">
          <Spinner label="Loading requests…" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No teacher requests found"
          hint={
            statusFilter !== "all"
              ? "No requests matching the selected status filter."
              : "Teacher leave, schedule adjustment, and elevation requests will appear here for review."
          }
        />
      ) : (
        <div className="card overflow-hidden border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted border-b border-border uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">Faculty Member</th>
                  <th className="px-4 py-3">Request Type</th>
                  <th className="px-4 py-3">Summary & Details</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-fg">{r.teacher_name}</div>
                      <div className="text-[11px] text-muted font-mono">{r.teacher_email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="badge bg-purple-50 text-purple-700 border-purple-200 uppercase font-bold text-[10px]">
                        {r.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-fg">{r.title}</div>
                      <div className="text-muted text-[11px] mt-0.5">
                        {r.type === "leave" && (
                          <span>Date: {r.details?.date} · Duration: {r.details?.duration}</span>
                        )}
                        {r.type === "extra_period" && (
                          <span>Requested Period: {r.details?.requested_period}</span>
                        )}
                        {r.details?.reason && (
                          <span className="block truncate max-w-xs italic text-muted mt-0.5">
                            &quot;{r.details.reason}&quot;
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={
                          r.status === "approved"
                            ? "active"
                            : r.status === "rejected"
                            ? "failed"
                            : "queued"
                        }
                      />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {r.status === "pending" ? (
                        <button
                          onClick={() => setSelectedReq(r)}
                          className="btn-primary btn-sm text-[11px]"
                        >
                          Review →
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted font-medium">Adjudicated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedReq && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          onClick={() => setSelectedReq(null)}
        >
          <div
            className="card w-full max-w-md p-6 bg-card border border-border shadow-card-elevated relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 id="review-modal-title" className="font-bold text-lg text-fg">
                Review Request
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="btn-outline text-xs px-2.5 py-1 font-semibold"
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Submitted by <strong className="text-fg">{selectedReq.teacher_name}</strong>
            </p>

            <div className="bg-surface rounded-xl p-4 text-xs text-fg mb-4 space-y-2 border border-border">
              <div className="flex justify-between">
                <span className="text-muted font-medium">Category:</span>
                <span className="uppercase font-bold text-accent">{selectedReq.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-medium">Subject:</span>
                <span className="font-bold text-fg">{selectedReq.title}</span>
              </div>
              <div>
                <span className="text-muted font-medium block mb-1">Teacher Notes:</span>
                <p className="p-2.5 rounded-lg bg-card border border-border text-fg italic">
                  {selectedReq.details?.reason || JSON.stringify(selectedReq.details)}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Adjudication Notes (shared with teacher)</label>
              <textarea
                rows={3}
                placeholder="Enter feedback or approval conditions…"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="input py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
              <button
                onClick={() => setSelectedReq(null)}
                className="btn-outline text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview("rejected")}
                className="btn-danger text-xs"
              >
                Reject Request
              </button>
              <button
                onClick={() => handleReview("approved")}
                className="btn-primary text-xs"
              >
                Approve Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { listRequests, submitRequest } from "@/services/requests";
import { useToast, Spinner, StatusBadge, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { TeacherRequest, RequestType } from "@/types/db";

export default function TeacherRequests() {
  const { profile } = useAuth();
  const { school } = useTenant();
  const toast = useToast();

  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [reqType, setReqType] = useState<RequestType>("leave");
  const [title, setTitle] = useState("Leave Request");
  const [reason, setReason] = useState("");
  const [leaveDate, setLeaveDate] = useState("");
  const [duration, setDuration] = useState("1 day");
  const [requestedPeriod, setRequestedPeriod] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  // Escape key handler for submit modal
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  const load = async () => {
    if (!profile || !school) return;
    try {
      const data = await listRequests({
        schoolId: school.id,
        teacherId: profile.id,
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
  }, [profile, school]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || !profile) return;
    if (!title.trim() || !reason.trim()) return;

    setSubmitting(true);
    try {
      const details: Record<string, unknown> = { reason };

      if (reqType === "leave") {
        details.date = leaveDate || new Date().toISOString().split("T")[0];
        details.duration = duration;
      } else if (reqType === "extra_period") {
        details.requested_period = requestedPeriod;
      } else if (reqType === "teacher_admin") {
        details.requested_permissions = [
          "school.material.upload",
          "school.request.review",
        ];
      }

      await submitRequest({
        school_id: school.id,
        teacher_id: profile.id,
        type: reqType,
        title,
        details,
      });

      toast("success", "Request submitted to Principal for review.");
      setModalOpen(false);
      setTitle("Leave Request");
      setReason("");
      load();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Administrative Petitions & Requests"
          subtitle={`Submit formal leave requests, extra period covers, or request Teacher Admin elevation from ${school?.name || "your school"}'s leadership.`}
        />

        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-2 shrink-0 mb-6"
        >
          <span>+ Submit Request</span>
        </button>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center border-border">
          <Spinner label="Loading your requests…" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No requests submitted yet"
          hint="Click '+ Submit Request' above to submit a leave request, extra period coverage, or elevation request to the Principal."
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary text-xs">
              Submit First Request
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="card p-6 border-border hover:border-accent/40 hover:shadow-card-hover transition-all space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base text-fg">{r.title}</h3>
                    <StatusBadge
                      status={
                        r.status === "approved"
                          ? "active"
                          : r.status === "rejected"
                          ? "failed"
                          : "queued"
                      }
                    />
                    <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold uppercase">
                      {r.type.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-xs text-muted mt-1 block">
                    Submitted on{" "}
                    {new Date(r.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div className="bg-surface/50 p-4 rounded-xl border border-border/60 text-xs text-fg space-y-1.5 leading-relaxed">
                {r.details?.date && (
                  <p>
                    <strong className="text-fg">Target Date:</strong> {String(r.details.date)} (
                    {String(r.details.duration || "1 day")})
                  </p>
                )}
                {r.details?.requested_period && (
                  <p>
                    <strong className="text-fg">Period:</strong> Period {String(r.details.requested_period)}
                  </p>
                )}
                <p>
                  <strong className="text-fg">Reason:</strong> {String(r.details?.reason || r.title)}
                </p>
                {r.review_notes && (
                  <div className="pt-2 border-t border-border text-accent font-semibold flex items-start gap-1.5">
                    <span>Principal Response:</span>
                    <span>{r.review_notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Request Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-modal-title"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card w-full max-w-lg p-6 bg-card border border-border shadow-card-elevated relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 id="request-modal-title" className="text-lg font-bold text-fg">
                Submit Request to Principal
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-outline text-xs px-2.5 py-1 font-semibold"
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Your request will be routed directly to the Principal&apos;s adjudication dashboard.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Request Category</label>
                <select
                  value={reqType}
                  onChange={(e) => {
                    const t = e.target.value as RequestType;
                    setReqType(t);
                    if (t === "teacher_admin") {
                      setTitle("Request for Teacher Admin Privileges");
                    } else if (t === "leave") {
                      setTitle("Leave Request");
                    } else if (t === "extra_period") {
                      setTitle("Extra Period Request");
                    } else {
                      setTitle("Schedule Adjustment");
                    }
                  }}
                  className="input"
                >
                  <option value="leave">Leave Request (Sick / Personal)</option>
                  <option value="extra_period">Extra Period Request</option>
                  <option value="schedule">Schedule / Free Period Adjustment</option>
                  <option value="teacher_admin">Request Teacher Admin Elevation</option>
                </select>
              </div>

              <div>
                <label className="label">Request Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                />
              </div>

              {reqType === "leave" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Date</label>
                    <input
                      type="date"
                      required
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="label">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="input text-xs"
                    >
                      <option value="Half Day (Morning)">Half Day (Morning)</option>
                      <option value="Half Day (Afternoon)">Half Day (Afternoon)</option>
                      <option value="1 day">1 Full Day</option>
                      <option value="2 days">2 Days</option>
                      <option value="3+ days">3+ Days</option>
                    </select>
                  </div>
                </div>
              )}

              {reqType === "extra_period" && (
                <div>
                  <label className="label">Target Period Number</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={requestedPeriod}
                    onChange={(e) => setRequestedPeriod(Number(e.target.value))}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="label">Reason & Justification</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide context and notes for the Principal's review…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-outline text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs"
                >
                  {submitting ? "Submitting…" : "Send to Principal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

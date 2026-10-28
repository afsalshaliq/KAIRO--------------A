import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { listRequests, reviewRequest } from "@/services/requests";
import { PERMISSIONS } from "@/lib/permissions";
import { useToast, Spinner, StatusBadge, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { Profile, TeacherRequest } from "@/types/db";

const AVAILABLE_PERMS = [
  { code: PERMISSIONS.MATERIAL_UPLOAD, name: "Upload Learning Materials", desc: "Upload and publish teacher materials" },
  { code: PERMISSIONS.REQUEST_REVIEW, name: "Review Teacher Requests", desc: "Approve or reject leave & extra period requests" },
  { code: PERMISSIONS.AUDIT_VIEW, name: "View School Audit Log", desc: "Inspect school-level audit trail" },
  { code: PERMISSIONS.TIMETABLE_MANAGE, name: "Manage Timetable", desc: "Reassign class and period schedules" },
  { code: PERMISSIONS.TEACHER_VIEW, name: "View Teacher Profiles", desc: "Inspect teacher rosters and departments" },
];

export default function AdminTeacherAdmins() {
  const { profile } = useAuth();
  const { school } = useTenant();
  const toast = useToast();

  const [teacherAdmins, setTeacherAdmins] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Review modal state
  const [reviewingReq, setReviewingReq] = useState<TeacherRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // Escape listener for review modal
  useEffect(() => {
    if (!reviewingReq) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReviewingReq(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reviewingReq]);

  const load = async () => {
    if (!school) return;
    try {
      // 1. Load pending Teacher Admin requests
      const reqs = await listRequests({
        schoolId: school.id,
        status: "pending",
      });
      setRequests(reqs.filter((r) => r.type === "teacher_admin"));

      // 2. Load active Teacher Admins
      if (!supabase) {
        setTeacherAdmins([
          {
            id: "usr-3",
            email: "teacheradmin@school.edu",
            full_name: "Royal Teacher Admin",
            role: "teacher_admin",
            status: "active",
            school_id: school.id,
            phone: "+1 555-0102",
            address: "Royal Campus",
            avatar_url: "",
            degree: "M.Sc Physics",
            degree_certificate_url: "",
            department: "Science",
            joining_date: "2023-08-15",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        setPermissionsMap({
          "usr-3": [PERMISSIONS.MATERIAL_UPLOAD, PERMISSIONS.REQUEST_REVIEW, PERMISSIONS.AUDIT_VIEW],
        });
      } else {
        const { data: tas } = await supabase
          .from("profiles")
          .select("*")
          .eq("school_id", school.id)
          .eq("role", "teacher_admin");

        setTeacherAdmins((tas as Profile[]) || []);

        // Load permissions
        const { data: perms } = await supabase
          .from("teacher_admin_permissions")
          .select("teacher_id, permission_code")
          .eq("school_id", school.id);

        const map: Record<string, string[]> = {};
        perms?.forEach((p: any) => {
          if (!map[p.teacher_id]) map[p.teacher_id] = [];
          map[p.teacher_id].push(p.permission_code);
        });
        setPermissionsMap(map);
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
  }, [school]);

  const handleReview = async (status: "approved" | "rejected") => {
    if (!reviewingReq || !profile || !school) return;
    try {
      await reviewRequest({
        requestId: reviewingReq.id,
        reviewerId: profile.id,
        status,
        reviewNotes,
        schoolId: school.id,
      });
      toast("success", `Teacher Admin request ${status}.`);
      setReviewingReq(null);
      setReviewNotes("");
      load();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  const handleTogglePermission = async (teacherId: string, permCode: string) => {
    if (!school || !profile) return;
    const current = permissionsMap[teacherId] || [];
    const hasIt = current.includes(permCode);

    try {
      if (supabase) {
        if (hasIt) {
          await supabase
            .from("teacher_admin_permissions")
            .delete()
            .eq("teacher_id", teacherId)
            .eq("permission_code", permCode)
            .eq("school_id", school.id);
        } else {
          await supabase.from("teacher_admin_permissions").insert({
            school_id: school.id,
            teacher_id: teacherId,
            permission_code: permCode,
            granted_by: profile.id,
          });
        }
      }

      setPermissionsMap((prev) => ({
        ...prev,
        [teacherId]: hasIt
          ? current.filter((c) => c !== permCode)
          : [...current, permCode],
      }));
      toast("success", `Updated permissions for Teacher Admin.`);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Admin Delegation"
        subtitle={`Configure delegated administrative capabilities, review elevation petitions, and manage granular privilege boundaries at ${school?.name || "your school"}.`}
      />

      {/* Pending Teacher Admin Requests */}
      <div className="card p-6 border-border">
        <h2 className="font-bold text-base text-fg flex items-center justify-between mb-4 pb-3 border-b border-border/60">
          <span>Pending Elevation Requests</span>
          {requests.length > 0 && (
            <span className="badge bg-amber-50 text-amber-800 border-amber-200 text-xs">
              {requests.length} pending
            </span>
          )}
        </h2>

        {requests.length === 0 ? (
          <p className="text-xs text-muted py-2 italic">
            No pending Teacher Admin requests from faculty at this time.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {requests.map((r) => (
              <div key={r.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-fg">{r.teacher_name}</span>
                    <span className="text-xs text-muted font-mono">({r.teacher_email})</span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    <strong className="text-fg">Reason:</strong> {r.details?.reason || r.title}
                  </p>
                  {r.details?.requested_permissions && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.details.requested_permissions.map((p: string) => (
                        <span key={p} className="badge bg-surface text-muted border border-border text-[10px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setReviewingReq(r)}
                  className="btn-primary btn-sm text-xs whitespace-nowrap self-start sm:self-center"
                >
                  Review Request →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Teacher Admins Table */}
      <div className="card overflow-hidden border-border">
        <div className="p-5 border-b border-border/60 flex items-center justify-between bg-surface/40">
          <div>
            <h2 className="font-bold text-base text-fg">Active Teacher Admins ({teacherAdmins.length})</h2>
            <p className="text-xs text-muted mt-0.5">Toggle specific administrative capabilities granted to each elevated teacher.</p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Spinner label="Loading Teacher Admins…" />
          </div>
        ) : teacherAdmins.length === 0 ? (
          <EmptyState
            title="No teachers currently designated as Teacher Admin"
            hint="Approved elevation requests promote teachers to Teacher Admin with granular toggles below."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {teacherAdmins.map((ta) => {
              const activePerms = permissionsMap[ta.id] || [];
              return (
                <div key={ta.id} className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-fg">{ta.full_name}</span>
                        <StatusBadge status="active" />
                        <span className="badge bg-purple-50 text-purple-700 border-purple-200 font-bold text-[10px]">
                          TEACHER ADMIN
                        </span>
                      </div>
                      <p className="text-xs text-muted font-mono mt-0.5">
                        {ta.email} · {ta.department || "General Faculty"}
                      </p>
                    </div>
                  </div>

                  {/* Granular Permission Toggles */}
                  <div className="bg-surface/50 rounded-2xl p-4 border border-border">
                    <span className="text-xs font-bold text-fg uppercase tracking-wider block mb-2.5">
                      Granted Administrative Privileges:
                    </span>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {AVAILABLE_PERMS.map((perm) => {
                        const isGranted = activePerms.includes(perm.code);
                        return (
                          <label
                            key={perm.code}
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              isGranted
                                ? "bg-accent-soft/70 border-accent/40 text-fg shadow-xs"
                                : "bg-card border-border text-muted hover:bg-surface hover:text-fg"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={() => handleTogglePermission(ta.id, perm.code)}
                              className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                            />
                            <div>
                              <span className="font-bold text-fg block">{perm.name}</span>
                              <span className="text-[11px] text-muted leading-relaxed block mt-0.5">
                                {perm.desc}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewingReq && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="teacher-admin-modal-title"
          onClick={() => setReviewingReq(null)}
        >
          <div
            className="card w-full max-w-md p-6 bg-card border border-border shadow-card-elevated relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 id="teacher-admin-modal-title" className="font-bold text-lg text-fg">
                Review Elevation Request
              </h3>
              <button
                type="button"
                onClick={() => setReviewingReq(null)}
                className="btn-outline text-xs px-2.5 py-1 font-semibold"
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Submitted by <strong className="text-fg">{reviewingReq.teacher_name}</strong>
            </p>

            <div className="bg-surface rounded-xl p-3.5 text-xs text-fg mb-4 space-y-1.5 border border-border">
              <p>
                <strong className="text-muted">Reason:</strong>{" "}
                {reviewingReq.details?.reason || reviewingReq.title}
              </p>
              <p>
                <strong className="text-muted">Department:</strong>{" "}
                {reviewingReq.teacher_department || "General"}
              </p>
            </div>

            <div className="mb-4">
              <label className="label">Adjudication Notes / Delegation Conditions</label>
              <textarea
                rows={3}
                placeholder="e.g. Approved for managing Grade 2 Science materials and reviewing schedule requests."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="input py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
              <button
                onClick={() => setReviewingReq(null)}
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
                Approve & Grant Elevation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

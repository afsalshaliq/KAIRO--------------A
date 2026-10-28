import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getSchoolDetails, updateSchool, toggleSchoolActive, type SchoolDetailData } from "@/services/tenant";
import { useTenant } from "@/lib/tenant";
import { useToast, Spinner, StatusBadge, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { School } from "@/types/db";

export default function SuperSchoolDetail() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [data, setData] = useState<SchoolDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("#4f46e5");
  const [editSecondaryColor, setEditSecondaryColor] = useState("#06b6d4");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editTimezone, setEditTimezone] = useState("Asia/Kolkata");
  const [editAiEnabled, setEditAiEnabled] = useState(true);
  const [editFaceAuthEnabled, setEditFaceAuthEnabled] = useState(true);
  const [editTeacherAdminEnabled, setEditTeacherAdminEnabled] = useState(true);

  const { setDevSubdomain } = useTenant();
  const navigate = useNavigate();
  const toast = useToast();

  const load = async () => {
    if (!schoolId) return;
    try {
      const res = await getSchoolDetails(schoolId);
      setData(res);
      populateEditForm(res.school);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const populateEditForm = (school: School) => {
    setEditName(school.name);
    setEditDomain(school.domain || "");
    setEditPrimaryColor(school.primary_color || "#4f46e5");
    setEditSecondaryColor(school.secondary_color || "#06b6d4");
    setEditContactEmail(school.settings?.contact_email || "");
    setEditContactPhone(school.settings?.contact_phone || "");
    setEditAddress(school.settings?.address || "");
    setEditTimezone(school.settings?.timezone || "Asia/Kolkata");
    setEditAiEnabled(school.settings?.ai_enabled ?? true);
    setEditFaceAuthEnabled(school.settings?.face_auth_enabled ?? true);
    setEditTeacherAdminEnabled(school.settings?.teacher_admin_enabled ?? true);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.school) return;
    if (!editName.trim()) {
      toast("error", "School name is required.");
      return;
    }

    setSaving(true);
    try {
      // Strictly update existing school record by immutable ID
      const updated = await updateSchool(data.school.id, {
        name: editName.trim(),
        domain: editDomain.trim() || null,
        primary_color: editPrimaryColor,
        secondary_color: editSecondaryColor,
        settings: {
          ...data.school.settings,
          contact_email: editContactEmail.trim(),
          contact_phone: editContactPhone.trim(),
          address: editAddress.trim(),
          timezone: editTimezone,
          ai_enabled: editAiEnabled,
          face_auth_enabled: editFaceAuthEnabled,
          teacher_admin_enabled: editTeacherAdminEnabled,
        },
      });

      setData((prev) => (prev ? { ...prev, school: updated } : null));
      toast("success", `Updated details for ${updated.name}. Record preserved.`);
      setEditModalOpen(false);
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!data?.school) return;
    const newStatus = !data.school.is_active;
    setSaving(true);
    try {
      const updated = await toggleSchoolActive(data.school.id, newStatus);
      setData((prev) => (prev ? { ...prev, school: updated } : null));
      toast(
        "success",
        `${updated.name} has been ${newStatus ? "activated" : "suspended"}.`
      );
      setStatusConfirmOpen(false);
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEnterSchool = () => {
    if (!data?.school) return;
    setDevSubdomain(data.school.slug);
    toast("info", `Entered ${data.school.name} environment as Super Administrator.`);
    navigate("/admin/dashboard");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast("success", `Copied ${label} to clipboard!`),
      () => toast("error", "Failed to copy to clipboard.")
    );
  };

  if (loading) {
    return (
      <div className="card p-12 flex justify-center">
        <Spinner label="Loading school tenant details…" />
      </div>
    );
  }

  if (!data?.school) {
    return (
      <EmptyState
        title="School Tenant Not Found"
        description="The requested school tenant could not be found or has been removed."
        action={
          <Link to="/super/schools" className="btn-primary text-xs">
            ← Return to Schools Directory
          </Link>
        }
      />
    );
  }

  const { school, administrators, teacherCount, classCount, materialsCount, recentAuditLogs } = data;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link to="/super/schools" className="hover:text-accent font-semibold transition">
          ← Schools Directory
        </Link>
        <span>/</span>
        <span className="text-fg font-medium truncate">{school.name}</span>
      </div>

      <PageHeader
        title={school.name}
        subtitle={`Tenant ID: ${school.id} · Subdomain: ${school.slug}.kairo.com`}
        badge="School Management Detail"
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                populateEditForm(school);
                setEditModalOpen(true);
              }}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <span>Edit School Information</span> ✎
            </button>
            <button
              onClick={handleEnterSchool}
              className="btn-outline text-xs flex items-center gap-1.5"
            >
              <span>Enter School Realm</span> →
            </button>
            <button
              onClick={() => setStatusConfirmOpen(true)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${
                school.is_active
                  ? "border-rose-300 text-rose-700 hover:bg-rose-50"
                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {school.is_active ? "Suspend School" : "Activate School"}
            </button>
          </div>
        }
      />

      {/* Overview Status Bar */}
      <div className="card p-5 border border-border bg-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs text-base shrink-0"
              style={{ backgroundColor: school.primary_color || "#4f46e5" }}
            >
              {school.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-fg">{school.name}</h2>
                <StatusBadge status={school.is_active ? "active" : "deactivated"} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted font-mono mt-0.5">
                <span>{school.slug}.kairo.com</span>
                <span>·</span>
                <button
                  onClick={() => copyToClipboard(school.id, "Tenant ID")}
                  className="hover:text-accent underline flex items-center gap-1"
                  title="Copy immutable ID"
                >
                  <span>ID: {school.id.slice(0, 8)}…</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
            <div>
              <span className="block font-bold text-base text-fg">{administrators.length}</span>
              <span>Administrators</span>
            </div>
            <div>
              <span className="block font-bold text-base text-fg">{teacherCount}</span>
              <span>Teachers</span>
            </div>
            <div>
              <span className="block font-bold text-base text-fg">{classCount}</span>
              <span>Classes</span>
            </div>
            <div>
              <span className="block font-bold text-base text-fg">{materialsCount}</span>
              <span>Curriculum Items</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Details & Security Configuration */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Metadata & Contact Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5 border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-sm text-fg">Tenant Identity & Contact Info</h3>
              <button
                onClick={() => setEditModalOpen(true)}
                className="text-xs text-accent font-semibold hover:underline"
              >
                Edit Details ✎
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted block mb-0.5">Contact Email</span>
                <span className="font-medium text-fg">
                  {school.settings?.contact_email || "Not specified (Uses administrator email)"}
                </span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Contact Phone</span>
                <span className="font-medium text-fg">
                  {school.settings?.contact_phone || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Campus Address</span>
                <span className="font-medium text-fg">
                  {school.settings?.address || "Main Institutional Campus"}
                </span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Primary Timezone</span>
                <span className="font-medium text-fg">
                  {school.settings?.timezone || "Asia/Kolkata (IST)"}
                </span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Custom Domain Binding</span>
                <span className="font-medium text-fg font-mono">
                  {school.domain || "None (Using Kairo Subdomain)"}
                </span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Registered Date</span>
                <span className="font-medium text-fg">
                  {new Date(school.created_at).toLocaleDateString([], {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Associated Administrators Roster */}
          <div className="card p-5 border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-sm text-fg">Associated School Administrators</h3>
                <p className="text-xs text-muted">Principals and school administrators governing this tenant</p>
              </div>
              <Link to="/super/users" className="text-xs text-accent font-semibold hover:underline">
                Manage In User Directory →
              </Link>
            </div>

            {administrators.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted bg-surface rounded-xl border border-dashed border-border">
                No school administrator has been assigned yet to this tenant.
                <div className="mt-2">
                  <Link to="/super/users" className="btn-outline text-xs">
                    + Assign School Administrator
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {administrators.map((admin) => (
                  <div key={admin.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-fg">{admin.full_name}</div>
                      <div className="text-muted font-mono text-[11px]">{admin.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge bg-indigo-50 text-indigo-700 font-bold uppercase text-[10px]">
                        {admin.role}
                      </span>
                      <StatusBadge status={admin.status as any} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent School-Level Audit History */}
          <div className="card p-5 border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-sm text-fg">School Audit History</h3>
                <p className="text-xs text-muted">Recent administrative, security, and pedagogical events</p>
              </div>
            </div>

            {recentAuditLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted">
                No audit events recorded for this school.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentAuditLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="badge bg-surface border border-border font-mono text-[10px] text-fg shrink-0">
                        {log.action}
                      </span>
                      <span className="truncate text-muted">Target: {log.target}</span>
                    </div>
                    <span className="text-muted text-[11px] shrink-0 font-mono">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Platform Feature Flags & Theme Styling */}
        <div className="space-y-6">
          <div className="card p-5 border border-border space-y-4">
            <h3 className="font-bold text-sm text-fg border-b border-border/60 pb-3">
              Platform Feature Controls
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start justify-between gap-2 p-3 rounded-lg bg-surface/60 border border-border">
                <div>
                  <span className="font-bold text-fg block">Pedagogical AI Engine</span>
                  <p className="text-muted text-[11px] mt-0.5">
                    Empowers teachers with lesson plan, worksheet & quiz generation grounded in CBSE syllabus.
                  </p>
                </div>
                <span className={`badge shrink-0 ${school.settings?.ai_enabled ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-surface text-muted"}`}>
                  {school.settings?.ai_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 p-3 rounded-lg bg-surface/60 border border-border">
                <div>
                  <span className="font-bold text-fg block">Biometric Face Authentication</span>
                  <p className="text-muted text-[11px] mt-0.5">
                    Enables cryptographic face verification for elevated pedagogical approvals.
                  </p>
                </div>
                <span className={`badge shrink-0 ${school.settings?.face_auth_enabled ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-surface text-muted"}`}>
                  {school.settings?.face_auth_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 p-3 rounded-lg bg-surface/60 border border-border">
                <div>
                  <span className="font-bold text-fg block">Teacher Admin Delegation</span>
                  <p className="text-muted text-[11px] mt-0.5">
                    Permits principals to delegate granular permissions to selected senior educators.
                  </p>
                </div>
                <span className={`badge shrink-0 ${school.settings?.teacher_admin_enabled ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-surface text-muted"}`}>
                  {school.settings?.teacher_admin_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>

          {/* Theme & Branding Card */}
          <div className="card p-5 border border-border space-y-4">
            <h3 className="font-bold text-sm text-fg border-b border-border/60 pb-3">
              Institutional Theme & Styling
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block mb-1">Primary School Brand Color</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-md border border-border shrink-0 shadow-xs"
                    style={{ backgroundColor: school.primary_color || "#4f46e5" }}
                  />
                  <span className="font-mono text-fg font-semibold uppercase">{school.primary_color}</span>
                </div>
              </div>

              <div>
                <span className="text-muted block mb-1">Secondary Accent Color</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-md border border-border shrink-0 shadow-xs"
                    style={{ backgroundColor: school.secondary_color || "#06b6d4" }}
                  />
                  <span className="font-mono text-fg font-semibold uppercase">{school.secondary_color}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT EXISTING SCHOOL MODAL */}
      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-xl p-6 bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-fg">Edit School: {school.name}</h2>
                <p className="text-xs text-muted">
                  Updates existing record (ID: <span className="font-mono text-fg">{school.id.slice(0, 8)}…</span>). Preserves associated classes, faculty, and data.
                </p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-muted hover:text-fg text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">School Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input w-full"
                    placeholder="e.g. Royal Academy"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Subdomain Slug (Immutable)</label>
                  <input
                    type="text"
                    disabled
                    value={`${school.slug}.kairo.com`}
                    className="input w-full bg-surface text-muted cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                    className="input w-full"
                    placeholder="principal@school.edu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                    className="input w-full"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg mb-1">Campus Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="input w-full"
                  placeholder="e.g. 104 Academic Avenue, Sector 5"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editPrimaryColor}
                      onChange={(e) => setEditPrimaryColor(e.target.value)}
                      className="h-9 w-9 p-0.5 rounded border border-border cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={editPrimaryColor}
                      onChange={(e) => setEditPrimaryColor(e.target.value)}
                      className="input w-full font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editSecondaryColor}
                      onChange={(e) => setEditSecondaryColor(e.target.value)}
                      className="h-9 w-9 p-0.5 rounded border border-border cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={editSecondaryColor}
                      onChange={(e) => setEditSecondaryColor(e.target.value)}
                      className="input w-full font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Timezone</label>
                  <select
                    value={editTimezone}
                    onChange={(e) => setEditTimezone(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-border p-3 bg-surface/50 space-y-2">
                <span className="text-xs font-bold text-fg block">Feature Flag Toggles</span>
                <div className="grid sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editAiEnabled}
                      onChange={(e) => setEditAiEnabled(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>AI Assistant</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFaceAuthEnabled}
                      onChange={(e) => setEditFaceAuthEnabled(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Face Authentication</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editTeacherAdminEnabled}
                      onChange={(e) => setEditTeacherAdminEnabled(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Teacher Admin</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn-outline text-xs"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                  disabled={saving}
                >
                  {saving ? "Saving Changes…" : "Save School Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS SUSPEND / ACTIVATE CONFIRMATION DIALOG */}
      {statusConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative">
            <h3 className="text-base font-bold text-fg mb-2">
              {school.is_active ? "Suspend School Tenant?" : "Activate School Tenant?"}
            </h3>
            <p className="text-xs text-muted leading-relaxed mb-4">
              {school.is_active
                ? `Suspending "${school.name}" will immediately prevent access for all associated administrators and teachers. Existing student records and curriculum materials will be safely preserved.`
                : `Activating "${school.name}" will restore operational login and curriculum services for all associated faculty and staff.`}
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStatusConfirmOpen(false)}
                className="btn-outline text-xs"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleToggleStatus}
                className={`text-xs px-3 py-1.5 rounded-lg text-white font-bold ${
                  school.is_active ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                disabled={saving}
              >
                {saving ? "Updating Status…" : school.is_active ? "Confirm Suspension" : "Confirm Activation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

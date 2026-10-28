import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listSchools, createSchool, updateSchool, toggleSchoolActive } from "@/services/tenant";
import { useTenant } from "@/lib/tenant";
import { useToast, Spinner, StatusBadge, SearchBar, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { School } from "@/types/db";

export default function SuperSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [sortBy, setSortBy] = useState<"name" | "created" | "status">("name");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Provision modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState("#06b6d4");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Existing School modal state
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
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
  const [editingBusy, setEditingBusy] = useState(false);

  // Suspend / Activate confirmation modal state
  const [confirmStatusSchool, setConfirmStatusSchool] = useState<School | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const { setDevSubdomain } = useTenant();
  const navigate = useNavigate();
  const toast = useToast();

  const load = async () => {
    try {
      const data = await listSchools();
      setSchools(data);
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

  const openEditModal = (s: School) => {
    setEditingSchool(s);
    setEditName(s.name);
    setEditLogoUrl(s.logo_url || "");
    setEditDomain(s.domain || "");
    setEditPrimaryColor(s.primary_color || "#4f46e5");
    setEditSecondaryColor(s.secondary_color || "#06b6d4");
    setEditContactEmail(s.settings?.contact_email || "");
    setEditContactPhone(s.settings?.contact_phone || "");
    setEditAddress(s.settings?.address || "");
    setEditTimezone(s.settings?.timezone || "Asia/Kolkata");
    setEditAiEnabled(s.settings?.ai_enabled ?? true);
    setEditFaceAuthEnabled(s.settings?.face_auth_enabled ?? true);
    setEditTeacherAdminEnabled(s.settings?.teacher_admin_enabled ?? true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setCreateError("Name and slug are required.");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await createSchool({
        name,
        slug,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      toast("success", `Created school tenant: ${created.name}`);
      setCreateModalOpen(false);
      setName("");
      setSlug("");
      load();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    if (!editName.trim()) {
      toast("error", "School name is required.");
      return;
    }

    setEditingBusy(true);
    try {
      // Strictly update existing school record by immutable ID
      const updated = await updateSchool(editingSchool.id, {
        name: editName.trim(),
        logo_url: editLogoUrl.trim() || null,
        domain: editDomain.trim() || null,
        primary_color: editPrimaryColor,
        secondary_color: editSecondaryColor,
        settings: {
          ...editingSchool.settings,
          contact_email: editContactEmail.trim(),
          contact_phone: editContactPhone.trim(),
          address: editAddress.trim(),
          timezone: editTimezone,
          ai_enabled: editAiEnabled,
          face_auth_enabled: editFaceAuthEnabled,
          teacher_admin_enabled: editTeacherAdminEnabled,
        },
      });

      setSchools((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast("success", `Successfully updated "${updated.name}". Existing record preserved.`);
      setEditingSchool(null);
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setEditingBusy(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!confirmStatusSchool) return;
    const newStatus = !confirmStatusSchool.is_active;
    setStatusBusy(true);
    try {
      const updated = await toggleSchoolActive(confirmStatusSchool.id, newStatus);
      setSchools((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast(
        "success",
        `${updated.name} has been ${newStatus ? "activated" : "suspended"}.`
      );
      setConfirmStatusSchool(null);
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setStatusBusy(false);
    }
  };

  const handleEnterSchool = (s: School) => {
    setDevSubdomain(s.slug);
    toast("info", `Entered ${s.name} as Super Administrator (Audited).`);
    navigate("/admin/dashboard");
  };

  const filteredSchools = useMemo(() => {
    let result = [...schools];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((s) => (statusFilter === "active" ? s.is_active : !s.is_active));
    }

    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "status") return Number(b.is_active) - Number(a.is_active);
      return 0;
    });

    return result;
  }, [schools, search, statusFilter, sortBy]);

  const totalPages = Math.ceil(filteredSchools.length / pageSize) || 1;
  const paginatedSchools = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSchools.slice(start, start + pageSize);
  }, [filteredSchools, page, pageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schools Directory & Multi-Tenant Management"
        subtitle="Manage isolated school tenants, update existing school settings, inspect subdomains, and monitor tenant health."
        badge="Super Admin Console"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <span>+ Provision New School</span>
            </button>
          </div>
        }
      />

      {/* Filter and Control Bar */}
      <div className="card p-4 border border-border bg-white shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="w-full md:w-80">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search schools by name, slug, or ID…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
                className="input py-1 text-xs"
              >
                <option value="all">All Schools ({schools.length})</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-muted font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input py-1 text-xs"
              >
                <option value="name">Name (A–Z)</option>
                <option value="created">Recently Added</option>
                <option value="status">Active First</option>
              </select>
            </div>

            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-surface">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1 text-xs font-semibold ${
                  viewMode === "grid" ? "bg-accent text-white" : "text-muted hover:text-fg"
                }`}
                title="Grid Cards"
              >
                ⊞ Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 text-xs font-semibold ${
                  viewMode === "table" ? "bg-accent text-white" : "text-muted hover:text-fg"
                }`}
                title="Data Table"
              >
                ☰ Table
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-border/50">
          <span>
            Showing <strong>{filteredSchools.length}</strong> of {schools.length} registered school tenants
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1 font-medium">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-0.5 rounded border border-border disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-1.5">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-0.5 rounded border border-border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center">
          <Spinner label="Loading schools directory…" />
        </div>
      ) : filteredSchools.length === 0 ? (
        <EmptyState
          title={search || statusFilter !== "all" ? "No matching schools found" : "No schools configured"}
          description={
            search || statusFilter !== "all"
              ? "No schools matched your search criteria. Try modifying your filters or provision a new school."
              : "No school tenants exist yet in the database. Provision your first school tenant."
          }
          action={
            <button onClick={() => setCreateModalOpen(true)} className="btn-primary text-xs">
              + Provision First School
            </button>
          }
        />
      ) : viewMode === "grid" ? (
        /* CARDS GRID VIEW */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedSchools.map((s) => (
            <div
              key={s.id}
              className="card p-5 border border-border flex flex-col justify-between hover:shadow-md transition bg-white"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-white text-xs shadow-xs overflow-hidden"
                      style={{ backgroundColor: s.primary_color || "#4f46e5" }}
                    >
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <img src="/logo.svg" alt="Default Kairo" className="h-4 w-4 object-contain brightness-0 invert" />
                      )}
                    </div>
                    <Link
                      to={`/super/schools/${s.id}`}
                      className="font-bold text-base text-fg hover:text-accent transition truncate"
                      title={s.name}
                    >
                      {s.name}
                    </Link>
                  </div>
                  <StatusBadge status={s.is_active ? "active" : "deactivated"} />
                </div>

                <div className="space-y-1.5 text-xs text-muted bg-surface p-3 rounded-lg border border-border mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted">Subdomain:</span>
                    <span className="font-mono text-fg font-medium">{s.slug}.kairo.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Tenant ID:</span>
                    <span className="font-mono text-[11px] truncate max-w-[130px] text-fg font-medium">
                      {s.id.slice(0, 8)}…
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Contact:</span>
                    <span className="truncate max-w-[130px] text-fg font-medium">
                      {s.settings?.contact_email || "Admin Account"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">AI Pedagogical:</span>
                    <span className={s.settings?.ai_enabled ? "text-emerald-600 font-semibold" : "text-muted"}>
                      {s.settings?.ai_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Biometric Auth:</span>
                    <span className={s.settings?.face_auth_enabled ? "text-emerald-600 font-semibold" : "text-muted"}>
                      {s.settings?.face_auth_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEnterSchool(s)}
                    className="btn-primary text-xs flex-1 py-1.5 justify-center"
                  >
                    Enter Realm →
                  </button>
                  <Link
                    to={`/super/schools/${s.id}`}
                    className="btn-outline text-xs px-2.5 py-1.5"
                    title="View School Details"
                  >
                    Details
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(s)}
                    className="btn-outline text-xs flex-1 py-1 text-fg hover:text-accent font-semibold flex items-center justify-center gap-1"
                  >
                    <span>Edit School</span> ✎
                  </button>
                  <button
                    onClick={() => setConfirmStatusSchool(s)}
                    className={`text-xs px-2 py-1 rounded border font-semibold ${
                      s.is_active
                        ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                        : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {s.is_active ? "Suspend" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card overflow-hidden border border-border bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface border-b border-border text-muted font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">School Name</th>
                  <th className="p-3">Subdomain & ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Features</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedSchools.map((s) => (
                  <tr key={s.id} className="hover:bg-surface/50 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-5 w-5 rounded shrink-0"
                          style={{ backgroundColor: s.primary_color || "#4f46e5" }}
                        />
                        <div>
                          <Link
                            to={`/super/schools/${s.id}`}
                            className="font-bold text-fg hover:text-accent transition"
                          >
                            {s.name}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-muted">
                      <div>{s.slug}.kairo.com</div>
                      <div className="text-[10px] text-muted truncate max-w-[140px]">{s.id}</div>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={s.is_active ? "active" : "deactivated"} />
                    </td>
                    <td className="p-3 text-fg">
                      {s.settings?.contact_email || "Admin Account"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {s.settings?.ai_enabled && (
                          <span className="badge bg-emerald-50 text-emerald-700 text-[10px] font-bold">AI</span>
                        )}
                        {s.settings?.face_auth_enabled && (
                          <span className="badge bg-indigo-50 text-indigo-700 text-[10px] font-bold">Face</span>
                        )}
                        {s.settings?.teacher_admin_enabled && (
                          <span className="badge bg-cyan-50 text-cyan-700 text-[10px] font-bold">Delegation</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(s)}
                          className="btn-outline py-1 px-2 text-[11px]"
                          title="Edit School"
                        >
                          Edit ✎
                        </button>
                        <Link
                          to={`/super/schools/${s.id}`}
                          className="btn-outline py-1 px-2 text-[11px]"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleEnterSchool(s)}
                          className="btn-primary py-1 px-2 text-[11px]"
                        >
                          Enter →
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

      {/* EDIT EXISTING SCHOOL MODAL */}
      {editingSchool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-xl p-6 bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-fg">Edit School: {editingSchool.name}</h2>
                <p className="text-xs text-muted">
                  Modifies existing school (ID: <span className="font-mono text-fg">{editingSchool.id.slice(0, 8)}…</span>). Preserves associated classes, teachers, and student data.
                </p>
              </div>
              <button
                onClick={() => setEditingSchool(null)}
                className="text-muted hover:text-fg text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSchool} className="space-y-4">
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
                    value={`${editingSchool.slug}.kairo.com`}
                    className="input w-full bg-surface text-muted cursor-not-allowed font-mono text-xs"
                  />
                </div>
              </div>

              {/* School Logo Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-fg">Institution Logo & Crest</label>
                  {editLogoUrl ? (
                    <button
                      type="button"
                      onClick={() => setEditLogoUrl("")}
                      className="text-[10px] text-rose-600 hover:underline font-semibold"
                    >
                      ↺ Reset to Default Kairo Logo
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted font-medium">Defaulting to KAIRO platform emblem</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg border border-border bg-surface flex items-center justify-center p-1 shrink-0 overflow-hidden">
                    {editLogoUrl ? (
                      <img src={editLogoUrl} alt="Preview" className="h-full w-full object-contain" />
                    ) : (
                      <img src="/logo.svg" alt="Default Kairo" className="h-5 w-5 object-contain brightness-0 invert" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={editLogoUrl.startsWith("data:") ? "(Custom Uploaded Logo Data)" : editLogoUrl}
                    onChange={(e) => setEditLogoUrl(e.target.value)}
                    className="input flex-1 text-xs"
                    placeholder="https://... or upload image file"
                  />
                  <label className="btn-outline text-xs px-2.5 py-2 cursor-pointer shrink-0">
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === "string") {
                              setEditLogoUrl(reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
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
                <span className="text-xs font-bold text-fg block">Feature Controls</span>
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
                  onClick={() => setEditingSchool(null)}
                  className="btn-outline text-xs"
                  disabled={editingBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                  disabled={editingBusy}
                >
                  {editingBusy ? "Saving…" : "Save School Updates"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROVISION NEW SCHOOL MODAL */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative">
            <h2 className="text-lg font-bold text-fg mb-1">Provision School Tenant</h2>
            <p className="text-xs text-muted mb-4">
              Allocates an isolated tenant subdomain, cryptographic realm, and default CBSE curriculum boundary.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-fg mb-1">School Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Jude Academy"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                    }
                  }}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg mb-1">Subdomain Identifier *</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="e.g. stjude"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="input w-full rounded-r-none font-mono text-xs"
                  />
                  <span className="bg-surface border border-l-0 border-border px-3 py-2 text-xs text-muted font-mono rounded-r-lg">
                    .kairo.com
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-8 w-8 rounded border border-border cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="input font-mono text-xs w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-8 w-8 rounded border border-border cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="input font-mono text-xs w-full"
                    />
                  </div>
                </div>
              </div>

              {createError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 text-xs border border-rose-200">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-outline text-xs"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                  disabled={submitting}
                >
                  {submitting ? "Provisioning…" : "Provision School"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUSPEND / ACTIVATE CONFIRMATION MODAL */}
      {confirmStatusSchool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative">
            <h3 className="text-base font-bold text-fg mb-2">
              {confirmStatusSchool.is_active ? "Suspend School Tenant?" : "Activate School Tenant?"}
            </h3>
            <p className="text-xs text-muted leading-relaxed mb-4">
              {confirmStatusSchool.is_active
                ? `Suspending "${confirmStatusSchool.name}" will prevent login and lesson preparation for its teachers and administrators. All curriculum materials and student records are preserved.`
                : `Activating "${confirmStatusSchool.name}" will restore active access across all primary classrooms in this school.`}
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmStatusSchool(null)}
                className="btn-outline text-xs"
                disabled={statusBusy}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmToggleStatus}
                className={`text-xs px-3 py-1.5 rounded-lg text-white font-bold ${
                  confirmStatusSchool.is_active
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                disabled={statusBusy}
              >
                {statusBusy
                  ? "Updating…"
                  : confirmStatusSchool.is_active
                  ? "Confirm Suspension"
                  : "Confirm Activation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

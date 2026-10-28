import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { listSchools } from "@/services/tenant";
import { setUserStatus, setUserRole, updateUserProfile, createGlobalUser } from "@/services/admin";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast, Spinner, StatusBadge, SearchBar, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { Profile, Role, School, AccountStatus } from "@/types/db";

export default function SuperUsers() {
  const { profile: currentAdmin } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  function generateTemporaryPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "Kairo@";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  }

  // Create User modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createRole, setCreateRole] = useState<Role>("teacher");
  const [createSchoolId, setCreateSchoolId] = useState<string>("");
  const [createDepartment, setCreateDepartment] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState(generateTemporaryPassword);
  const [showCreatePassword, setShowCreatePassword] = useState(true);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    fullName: string;
    role: Role;
  } | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  // Edit User modal state
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSchoolId, setEditSchoolId] = useState<string>("");
  const [editRole, setEditRole] = useState<Role>("teacher");
  const [editBusy, setEditBusy] = useState(false);

  // Status confirm modal state
  const [statusConfirmUser, setStatusConfirmUser] = useState<{ user: Profile; targetStatus: AccountStatus } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const toast = useToast();

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const schs = await listSchools();
      setSchools(schs);

      if (!createSchoolId && schs.length > 0) {
        setCreateSchoolId(schs[0].id);
      }

      if (!supabase) {
        setUsers([]);
        setLoadError("Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(`Database Query Error: ${error.message}`);
        toast("error", error.message);
      } else {
        setUsers((data as Profile[]) || []);
      }
    } catch (e) {
      const msg = (e as Error).message || "An error occurred while loading user records.";
      setLoadError(msg);
      toast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEditModal = (u: Profile) => {
    setEditingUser(u);
    setEditFullName(u.full_name);
    setEditDepartment(u.department || "");
    setEditPhone(u.phone || "");
    setEditAddress(u.address || "");
    setEditSchoolId(u.school_id || "");
    setEditRole(u.role);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim() || !createFullName.trim()) {
      toast("error", "Full name and email are required.");
      return;
    }
    if (!createPassword || createPassword.trim().length < 6) {
      toast("error", "Password must be at least 6 characters.");
      return;
    }

    setCreateBusy(true);
    try {
      const emailVal = createEmail.trim();
      const nameVal = createFullName.trim();
      const pwdVal = createPassword.trim();
      const roleVal = createRole;

      const created = await createGlobalUser({
        email: emailVal,
        fullName: nameVal,
        role: roleVal,
        schoolId: roleVal === "super_admin" ? null : createSchoolId || null,
        department: createDepartment.trim() || "General",
        phone: createPhone.trim(),
        password: pwdVal,
      });

      toast("success", `Created user account for ${created.full_name}.`);
      setCreatedCredentials({
        email: created.email,
        password: pwdVal,
        fullName: created.full_name,
        role: created.role,
      });
      setCreateModalOpen(false);
      setCreateEmail("");
      setCreateFullName("");
      setCreateDepartment("");
      setCreatePhone("");
      setCreatePassword(generateTemporaryPassword());
      await load();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setCreateBusy(false);
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editFullName.trim()) {
      toast("error", "Full name is required.");
      return;
    }

    // Safeguard: Do not allow demoting self from super_admin
    if (editingUser.id === currentAdmin?.id && editRole !== "super_admin") {
      toast("error", "Safety policy: You cannot demote your own active Super Admin account.");
      return;
    }

    setEditBusy(true);
    try {
      // 1. Update role if changed
      if (editRole !== editingUser.role) {
        await setUserRole(editingUser.id, editRole);
      }

      // 2. Update profile attributes
      const updated = await updateUserProfile(editingUser.id, {
        full_name: editFullName.trim(),
        department: editDepartment.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        school_id: editRole === "super_admin" ? null : editSchoolId || null,
      });

      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated, role: editRole } : u)));
      toast("success", `Updated user attributes for ${updated.full_name}.`);
      setEditingUser(null);
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setEditBusy(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusConfirmUser) return;
    const { user, targetStatus } = statusConfirmUser;

    // Safeguard against self-deactivation
    if (user.id === currentAdmin?.id && targetStatus !== "active") {
      toast("error", "Safety restriction: You cannot suspend or deactivate your own Super Admin account.");
      setStatusConfirmUser(null);
      return;
    }

    setStatusBusy(true);
    try {
      await setUserStatus(user.id, targetStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: targetStatus } : u))
      );
      toast("success", `Account status changed to ${targetStatus} for ${user.full_name}.`);
      setStatusConfirmUser(null);
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setStatusBusy(false);
    }
  };

  const schoolsMap = useMemo(() => {
    const map = new Map<string, string>();
    schools.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [schools]);

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department && u.department.toLowerCase().includes(q))
      );
    }

    if (schoolFilter !== "all") {
      result = result.filter((u) => u.school_id === schoolFilter);
    }

    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((u) => u.status === statusFilter);
    }

    return result;
  }, [users, search, schoolFilter, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global User Governance"
        subtitle="Cross-tenant identity administration, role assignments, tenant association, and account lifecycle control."
        badge="Platform Security"
        action={
          <button
            onClick={() => setCreateModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <span>+ Create / Invite User</span>
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="card p-4 border border-border bg-white shadow-xs space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search by name, email, department…"
            />
          </div>

          <div>
            <select
              value={schoolFilter}
              onChange={(e) => {
                setSchoolFilter(e.target.value);
                setPage(1);
              }}
              className="input w-full text-xs"
            >
              <option value="all">All School Tenants ({schools.length})</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="input w-full text-xs"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Administrator</option>
              <option value="principal">Principal</option>
              <option value="teacher_admin">Teacher Administrator</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input w-full text-xs"
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
              <option value="deactivated">Deactivated Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-border/50">
          <span>
            Showing <strong>{filteredUsers.length}</strong> of {users.length} registered accounts
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

      {loadError && (
        <div className="card p-4 border border-rose-200 bg-rose-50 text-xs text-rose-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{loadError}</span>
          </div>
          <button
            onClick={() => load()}
            className="btn-outline text-xs bg-white text-fg font-semibold hover:bg-surface shrink-0"
          >
            ↻ Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="card p-12 flex justify-center">
          <Spinner label="Loading global user roster from database…" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          title={search || roleFilter !== "all" || schoolFilter !== "all" ? "No matching users" : "No users found"}
          description="No user records matched your filter criteria in the database."
          action={
            <button onClick={() => setCreateModalOpen(true)} className="btn-primary text-xs">
              + Provision New User
            </button>
          }
        />
      ) : (
        /* Users Data Table */
        <div className="card overflow-hidden border border-border bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface border-b border-border text-muted font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">User & Contact</th>
                  <th className="p-3">Assigned Role</th>
                  <th className="p-3">School Tenant</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedUsers.map((u) => {
                  const schoolName = u.school_id ? schoolsMap.get(u.school_id) || "Assigned Tenant" : "Global Platform";
                  const isCurrent = u.id === currentAdmin?.id;

                  return (
                    <tr key={u.id} className="hover:bg-surface/50 transition">
                      <td className="p-3">
                        <div className="font-bold text-fg flex items-center gap-1.5">
                          <span>{u.full_name}</span>
                          {isCurrent && (
                            <span className="badge bg-accent-soft text-accent text-[9px] font-bold">You</span>
                          )}
                        </div>
                        <div className="text-muted font-mono text-[11px]">{u.email}</div>
                        {u.phone && <div className="text-[10px] text-muted">{u.phone}</div>}
                      </td>

                      <td className="p-3">
                        <span
                          className={`badge font-bold uppercase text-[10px] ${
                            u.role === "super_admin"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : u.role === "principal" || u.role === "admin"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : u.role === "teacher_admin"
                              ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                              : "bg-surface text-fg border border-border"
                          }`}
                        >
                          {u.role.replace("_", " ")}
                        </span>
                      </td>

                      <td className="p-3 text-fg font-medium">
                        {u.school_id ? (
                          <Link
                            to={`/super/schools/${u.school_id}`}
                            className="hover:text-accent hover:underline flex items-center gap-1"
                          >
                            <span>🏫 {schoolName}</span>
                          </Link>
                        ) : (
                          <span className="text-muted italic">Global (Super Admin)</span>
                        )}
                      </td>

                      <td className="p-3 text-muted">
                        {u.department || "General"}
                      </td>

                      <td className="p-3">
                        <StatusBadge status={u.status} />
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="btn-outline py-1 px-2.5 text-[11px]"
                            title="Edit User Attributes"
                          >
                            Edit ✎
                          </button>

                          {u.status === "active" ? (
                            <button
                              onClick={() => setStatusConfirmUser({ user: u, targetStatus: "suspended" })}
                              disabled={isCurrent}
                              className="px-2 py-1 rounded text-[11px] border border-amber-300 text-amber-800 hover:bg-amber-50 disabled:opacity-40"
                              title="Suspend User"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => setStatusConfirmUser({ user: u, targetStatus: "active" })}
                              className="px-2 py-1 rounded text-[11px] border border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                              title="Activate User"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / INVITE USER MODAL */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-lg p-6 bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-fg">Provision New User Account</h2>
                <p className="text-xs text-muted">
                  Create a validated identity assigned to a designated school tenant or platform realm.
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted hover:text-fg text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-fg mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  className="input w-full"
                  placeholder="e.g. Dr. Arthur Pendelton"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="input w-full"
                  placeholder="arthur@school.edu"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Role Assignment *</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as Role)}
                    className="input w-full text-xs"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="teacher_admin">Teacher Administrator</option>
                    <option value="principal">Principal</option>
                    <option value="super_admin">Super Administrator (Global)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Assigned School Tenant</label>
                  <select
                    value={createSchoolId}
                    onChange={(e) => setCreateSchoolId(e.target.value)}
                    disabled={createRole === "super_admin"}
                    className="input w-full text-xs disabled:opacity-50"
                  >
                    {createRole === "super_admin" ? (
                      <option value="">Global (No School Assigned)</option>
                    ) : (
                      schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Department</label>
                  <input
                    type="text"
                    value={createDepartment}
                    onChange={(e) => setCreateDepartment(e.target.value)}
                    className="input w-full"
                    placeholder="e.g. Science / Mathematics"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    className="input w-full"
                    placeholder="+91 98765 01234"
                  />
                </div>
              </div>

              {/* Password (Custom or Auto-Generated) */}
              <div className="p-3 rounded-lg border border-border bg-surface/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-fg">
                    Initial Password <span className="text-accent">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newPwd = generateTemporaryPassword();
                      setCreatePassword(newPwd);
                      toast("info", "Generated new password");
                    }}
                    className="text-accent text-[11px] font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>↻ Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Enter custom password (min 6 chars)"
                    className="input w-full font-mono text-xs bg-white pr-24"
                    required
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((prev) => !prev)}
                      className="px-2 py-0.5 text-[11px] font-medium text-muted hover:text-fg hover:bg-slate-100 rounded"
                    >
                      {showCreatePassword ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!createPassword) return;
                        navigator.clipboard.writeText(createPassword);
                        toast("success", "Password copied!");
                      }}
                      className="px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/10 rounded"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted leading-tight">
                  You can type your own custom password or click <strong>Auto-Generate</strong>.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-outline text-xs"
                  disabled={createBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                  disabled={createBusy}
                >
                  {createBusy ? "Creating User…" : "Provision User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDENTIALS READY MODAL */}
      {createdCredentials && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative">
            <div className="flex items-center gap-2 mb-2 text-emerald-600">
              <span className="text-xl">✅</span>
              <h3 className="text-base font-bold text-fg">Account Created Successfully</h3>
            </div>
            <p className="text-xs text-muted mb-4">
              User account for <strong>{createdCredentials.fullName}</strong> ({createdCredentials.role.replace("_", " ")}) has been provisioned. Please securely provide these temporary sign-in credentials to the user.
            </p>

            <div className="space-y-3 p-4 rounded-xl bg-surface border border-border">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted block mb-0.5">Login Email</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-fg">{createdCredentials.email}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.email);
                      toast("success", "Email copied!");
                    }}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-2">
                <span className="text-[10px] uppercase font-bold text-muted block mb-0.5">Temporary Password</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-fg tracking-wide">{createdCredentials.password}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.password);
                      toast("success", "Password copied!");
                    }}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const text = `KAIRO Login Credentials\nName: ${createdCredentials.fullName}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nPortal: ${window.location.origin}/login`;
                  navigator.clipboard.writeText(text);
                  toast("success", "All credentials copied to clipboard!");
                }}
                className="btn-outline text-xs flex items-center gap-1.5"
              >
                <span>📋 Copy All Details</span>
              </button>

              <button
                onClick={() => setCreatedCredentials(null)}
                className="btn-primary text-xs px-4"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-lg p-6 bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-fg">Edit User: {editingUser.full_name}</h2>
                <p className="text-xs text-muted">Email: {editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-muted hover:text-fg text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-fg mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Role Assignment</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as Role)}
                    className="input w-full text-xs"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="teacher_admin">Teacher Administrator</option>
                    <option value="principal">Principal</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">School Tenant</label>
                  <select
                    value={editSchoolId}
                    onChange={(e) => setEditSchoolId(e.target.value)}
                    disabled={editRole === "super_admin"}
                    className="input w-full text-xs disabled:opacity-50"
                  >
                    <option value="">Global (None)</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Department</label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg mb-1">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="input w-full"
                  placeholder="Campus address or residential locality"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn-outline text-xs"
                  disabled={editBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                  disabled={editBusy}
                >
                  {editBusy ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS CONFIRMATION MODAL */}
      {statusConfirmUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative">
            <h3 className="text-base font-bold text-fg mb-2">
              Confirm Account Status Change
            </h3>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Are you sure you want to change the status of <strong>{statusConfirmUser.user.full_name}</strong> ({statusConfirmUser.user.email}) to <strong>{statusConfirmUser.targetStatus}</strong>?
              {statusConfirmUser.targetStatus !== "active" && (
                <span className="block mt-1 text-rose-600 font-semibold">
                  This user will immediately be barred from signing in and accessing school resources.
                </span>
              )}
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStatusConfirmUser(null)}
                className="btn-outline text-xs"
                disabled={statusBusy}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="btn-primary text-xs"
                disabled={statusBusy}
              >
                {statusBusy ? "Updating…" : `Confirm ${statusConfirmUser.targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

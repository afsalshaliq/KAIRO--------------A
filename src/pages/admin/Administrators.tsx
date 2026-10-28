import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { listAdmins, listTeachers } from "@/services/catalog";
import { inviteAdmin, setUserRole, setUserStatus, sendPasswordRecovery } from "@/services/admin";
import { inviteTeacherSchema } from "@/lib/schemas";
import { EmptyState, Skeleton, StatusBadge, ConfirmDialog, useToast } from "@/components/ui";

export default function Administrators() {
  const toast = useToast();
  const admins = useAsync(() => listAdmins(), []);
  const teachers = useAsync(() => listTeachers(), []);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoteId, setPromoteId] = useState("");
  const [confirm, setConfirm] = useState<null | { run: () => Promise<unknown>; label: string; danger?: boolean }>(null);

  function reload() {
    admins.reload();
    teachers.reload();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const parsed = inviteTeacherSchema.safeParse({ email, fullName: name });
    if (!parsed.success) {
      toast("error", parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await inviteAdmin(parsed.data.email, parsed.data.fullName);
      toast("success", `Administrator invite sent to ${parsed.data.email}`);
      setEmail("");
      setName("");
      reload();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setBusy(false);
    }
  }

  const promotable = teachers.data ?? [];

  return (
    <>
      <PageHeader
        title="School Administrators"
        subtitle="Super-admin governance across school principals and administrative heads."
      />

      {/* Invite Form */}
      <form onSubmit={invite} className="card mb-6 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] border-border">
        <input
          className="input"
          placeholder="Administrator Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input"
          type="email"
          placeholder="name@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Invite Administrator"}
        </button>
      </form>

      {/* Promote Teacher Card */}
      <div className="card mb-6 flex flex-wrap items-center gap-3 p-5 border-border">
        <span className="text-sm font-semibold text-fg">Promote existing faculty to Principal:</span>
        <select
          className="input max-w-xs"
          value={promoteId}
          onChange={(e) => setPromoteId(e.target.value)}
        >
          <option value="">Select a teacher…</option>
          {promotable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name || t.email}
            </option>
          ))}
        </select>
        <button
          className="btn-outline"
          disabled={!promoteId}
          onClick={() => {
            const t = promotable.find((x) => x.id === promoteId);
            setConfirm({
              label: `Promote ${t?.full_name || t?.email} to Principal (Admin)? This grants full administrative authority over this school tenant.`,
              run: () => setUserRole(promoteId, "admin").then(() => setPromoteId("")),
            });
          }}
        >
          Promote to Principal
        </button>
      </div>

      {(admins.error || teachers.error) && (
        <div role="alert" className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {admins.error || teachers.error}
        </div>
      )}

      {admins.loading ? (
        <Skeleton className="h-40" />
      ) : !admins.data?.length ? (
        <EmptyState title="No administrators provisioned yet" hint="Invite a principal above." />
      ) : (
        <div className="card overflow-hidden border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface text-muted text-xs font-semibold uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Administrator</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {admins.data.map((a) => (
                  <tr key={a.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-fg">{a.full_name || "—"}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted">{a.email}</td>
                    <td className="px-4 py-3.5">
                      <span className="badge bg-purple-50 text-purple-700 border-purple-200 uppercase font-bold text-[10px]">
                        {a.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        {a.status === "active" ? (
                          <button
                            className="btn-outline btn-sm hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() =>
                              setConfirm({
                                label: `Suspend administrator account for ${a.email}?`,
                                danger: true,
                                run: () => setUserStatus(a.id, "suspended"),
                              })
                            }
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            className="btn-outline btn-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() =>
                              setConfirm({
                                label: `Reactivate administrator account for ${a.email}?`,
                                run: () => setUserStatus(a.id, "active"),
                              })
                            }
                          >
                            Activate
                          </button>
                        )}
                        <button
                          className="btn-ghost btn-sm text-muted hover:text-fg"
                          onClick={() =>
                            sendPasswordRecovery(a.email)
                              .then(() => toast("success", "Recovery link sent"))
                              .catch((e) => toast("error", e.message))
                          }
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

      <ConfirmDialog
        open={!!confirm}
        danger={confirm?.danger}
        title="Confirm Administrative Action"
        body={confirm?.label}
        confirmLabel="Confirm"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) {
            confirm
              .run()
              .then(() => {
                toast("success", "Operation completed.");
                reload();
              })
              .catch((err: any) => toast("error", err.message));
          }
          setConfirm(null);
        }}
      />
    </>
  );
}

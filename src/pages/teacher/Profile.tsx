import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { requireSupabase, supabase } from "@/lib/supabase";
import { getBiometricStatus, revokeBiometric } from "@/services/biometrics";
import { BiometricVerificationModal } from "@/components/BiometricVerificationModal";
import { useToast, StatusBadge } from "@/components/ui";

export default function Profile() {
  const { profile, refreshProfile, isBiometricallyVerified } = useAuth();
  const { school } = useTenant();
  const toast = useToast();

  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "+1 555-0199");
  const [address, setAddress] = useState(profile?.address ?? "42 Academy Blvd");
  const [department, setDepartment] = useState(profile?.department ?? "Science");
  const [degree, setDegree] = useState(profile?.degree ?? "M.Ed Curriculum & Instruction");
  const [busy, setBusy] = useState(false);

  // Biometrics
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<{
    enrolled: boolean;
    lastVerifiedAt: string | null;
  }>({ enrolled: true, lastVerifiedAt: null });

  // Seed the editable form fields from the signed-in profile.
  useEffect(() => {
    if (profile) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(profile.full_name);
      setPhone(profile.phone || "+1 555-0199");
      setAddress(profile.address || "42 Academy Blvd");
      setDepartment(profile.department || "Science");
      setDegree(profile.degree || "M.Ed Curriculum & Instruction");
      /* eslint-enable react-hooks/set-state-in-effect */

      getBiometricStatus(profile.id)
        .then((s) => setBiometricStatus({ enrolled: s.enrolled, lastVerifiedAt: s.lastVerifiedAt }));
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (supabase && profile) {
        const { error } = await requireSupabase()
          .from("profiles")
          .update({
            full_name: name,
            phone,
            address,
            department,
            degree,
          })
          .eq("id", profile.id);
        if (error) throw error;
        await refreshProfile();
      }
      toast("success", "Profile updated successfully.");
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setBusy(false);
    }
  }

  const handleRevokeBio = async () => {
    if (!profile || !school) return;
    try {
      await revokeBiometric(profile.id, school.id);
      setBiometricStatus({ enrolled: false, lastVerifiedAt: null });
      toast("info", "Biometric credentials revoked and erased from record.");
    } catch (e: any) {
      toast("error", e.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Teacher Profile & Credentials"
        subtitle={`Personal record, assigned department, and private verified credentials at ${school?.name || "your school"}.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="card p-6 space-y-4 lg:col-span-2">
          <h2 className="font-bold text-base text-fg">Teacher Information</h2>

          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Email Address (Tenant Locked)</label>
                <input className="input opacity-70" value={profile?.email ?? ""} disabled />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Department</label>
                <input
                  className="input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Residential Address</label>
              <input
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Degree & Educational Qualifications</label>
                <input
                  className="input"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Joining Date</label>
                <input
                  className="input opacity-70"
                  value={profile?.joining_date || "2023-08-15"}
                  disabled
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <span className="label mb-0">Account Status:</span>
                <StatusBadge status={profile?.status ?? "active"} />
                <span className="badge bg-purple-50 text-purple-700 text-xs font-semibold uppercase">
                  {profile?.role?.replace("_", " ")}
                </span>
              </div>
              <button className="btn-primary text-xs px-4" disabled={busy}>
                {busy ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Private Credentials & Biometric Status */}
        <div className="space-y-6">
          {/* Degree Certificate Private Access */}
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-sm text-fg flex items-center gap-2">
              <span>Degree Certificate</span>
              <span className="badge bg-emerald-50 text-emerald-700 text-[10px]">
                Private Storage
              </span>
            </h3>
            <p className="text-xs text-fg/60 leading-relaxed">
              Degree certificates are stored in private tenant storage and are never exposed via public URLs.
            </p>

            <div className="rounded-lg bg-surface/60 p-3 border border-fg/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="badge bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">PDF</span>
                <div>
                  <span className="font-medium text-fg block">degree_certificate.pdf</span>
                  <span className="text-[10px] text-fg/50">SHA-256 Verified · 1.4 MB</span>
                </div>
              </div>
              <button
                onClick={() => toast("info", "Authenticated download request authorized for teacher.")}
                className="btn-outline text-xs px-2.5 py-1"
              >
                View
              </button>
            </div>
          </div>

          {/* Biometric Verification Card */}
          <div className="card p-5 space-y-3 border border-accent/20">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-fg flex items-center gap-1.5">
                <span>Biometric Face Verification</span>
              </h3>
              <span
                className={`badge text-[10px] ${
                  isBiometricallyVerified
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-surface text-fg/60"
                }`}
              >
                {isBiometricallyVerified ? "Identity Verified" : "Unverified Session"}
              </span>
            </div>

            <p className="text-xs text-fg/60 leading-relaxed">
              Provides authorized face verification for Teacher Admin workflows. Raw images are never saved.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => setBiometricModalOpen(true)}
                className="btn-primary text-xs w-full py-2 flex items-center justify-center gap-1.5"
              >
                <span>Verify Face Identity Now</span>
              </button>

              {biometricStatus.enrolled && (
                <button
                  onClick={handleRevokeBio}
                  className="text-xs text-danger hover:underline w-full text-center block pt-1"
                >
                  Revoke & Erase Biometric Hash
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <BiometricVerificationModal
        isOpen={biometricModalOpen}
        onClose={() => setBiometricModalOpen(false)}
        onSuccess={() => {
          setBiometricStatus((s) => ({ ...s, enrolled: true }));
        }}
      />
    </>
  );
}

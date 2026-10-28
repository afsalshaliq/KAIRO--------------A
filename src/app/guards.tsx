import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { Spinner } from "@/components/ui";
import type { Role } from "@/types/db";

function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <Spinner label="Checking your access and tenant security…" />
    </div>
  );
}

/** Where a given role's home dashboard lives. */
export function homeFor(role: Role): string {
  if (role === "super_admin") return "/super/overview";
  if (role === "admin" || role === "principal") return "/admin/dashboard";
  return "/teacher/dashboard";
}

/** Check if have satisfies needed role with hierarchy. */
export function satisfies(have: Role, need: Role): boolean {
  if (have === need) return true;
  if (have === "super_admin") return true;
  if ((have === "admin" || have === "principal") && (need === "admin" || need === "principal")) return true;
  if (have === "teacher_admin" && need === "teacher") return true;
  return false;
}

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { loading, session, profile } = useAuth();
  const { school } = useTenant();
  const loc = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!session || !profile) {
    const to = (role === "teacher" || role === "teacher_admin") ? "/teacher/login" : "/admin/login";
    return <Navigate to={to} replace state={{ from: loc.pathname }} />;
  }

  // Tenant Boundary Check: Non-super_admin users cannot access routes if tenant mismatch
  if (profile.role !== "super_admin" && school && profile.school_id && profile.school_id !== school.id) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="card max-w-md p-6">
          <div className="mb-3 inline-flex items-center justify-center px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider">
            Access Blocked
          </div>
          <h2 className="text-xl font-bold text-danger">Tenant Isolation Violation</h2>
          <p className="mt-2 text-sm text-fg/70">
            Your account is assigned to another school tenant. Access to {school.name} is strictly prohibited by Kairo security policy.
          </p>
          <button
            onClick={() => window.location.href = "/"}
            className="btn-primary mt-4 w-full"
          >
            Return to Authorized Domain
          </button>
        </div>
      </div>
    );
  }

  if (!satisfies(profile.role, role)) {
    return <Navigate to={homeFor(profile.role)} replace />;
  }
  return <>{children}</>;
}

/** Elevated gate: only a super_admin may view the enclosed route. */
export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { loading, session, profile } = useAuth();
  const loc = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!session || !profile) {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  }
  if (profile.role !== "super_admin") {
    return <Navigate to={homeFor(profile.role)} replace />;
  }
  return <>{children}</>;
}

/** Permission gate: checks if user has permission OR is super_admin/principal */
export function RequirePermission({
  permission,
  children,
  fallback,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { loading, profile, hasPerm } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!profile) return <Navigate to="/login" replace />;

  if (!hasPerm(permission)) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="card p-8 text-center">
        <div className="mb-3 inline-flex items-center justify-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider">
          Permission Restricted
        </div>
        <h3 className="font-semibold text-fg">Permission Required</h3>
        <p className="text-sm text-fg/60 mt-1">
          You need the <code className="text-xs bg-surface px-1 py-0.5 rounded">{permission}</code> privilege to perform this action.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/** For login pages: if already signed in, bounce to the right dashboard. */
export function RedirectIfAuthed() {
  const { loading, profile } = useAuth();
  if (loading) return null;
  if (profile) return <Navigate to={homeFor(profile.role)} replace />;
  return null;
}

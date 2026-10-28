import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Profile } from "@/types/db";
import { hasPermission } from "@/lib/permissions";
import { DEFAULT_SCHOOLS } from "@/lib/tenant";
import { recordKairoMove } from "@/services/audit";

export interface AuthState {
  loading: boolean;          // true until the session + profile are resolved
  configured: boolean;       // whether Supabase env is set
  devAuth: boolean;          // DEV-ONLY mock login active (no real backend)
  session: Session | null;
  profile: Profile | null;   // the server-verified profile (source of truth)
  permissions: string[];     // active permissions for the user
  hasPerm: (permission: string) => boolean;
  isBiometricallyVerified: boolean;
  setBiometricallyVerified: (val: boolean) => void;
  error: string | null;
  signIn: (email: string, password: string, targetSchoolId?: string | null) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

/**
 * DEV & PREVIEW mock auth.
 * Active ONLY when VITE_DEV_AUTH === "1" (from .env) or when Supabase is not configured.
 */
const DEV_AUTH =
  import.meta.env.VITE_DEV_AUTH === "1" ||
  !isSupabaseConfigured;

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isBiometricallyVerified, setIsBiometricallyVerified] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  // Fetch the verified profile and their teacher admin permissions
  async function loadProfile(uid: string): Promise<{ profile: Profile | null; perms: string[] }> {
    if (!supabase) return { profile: null, perms: [] };
    const { data, error: e } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (e || !data) return { profile: null, perms: [] };
    const p = data as Profile;
    if (p.status !== "active") {
      await supabase.auth.signOut();
      if (mounted.current) setError("Your account is not active. Contact your administrator.");
      return { profile: null, perms: [] };
    }

    // Load teacher admin permissions if applicable
    let perms: string[] = [];
    if (p.role === "teacher_admin") {
      const { data: permData } = await supabase
        .from("teacher_admin_permissions")
        .select("permission_code")
        .eq("teacher_id", p.id);
      if (permData) {
        perms = permData.map((r: { permission_code: string }) => r.permission_code);
      }
    }

    return { profile: p, perms };
  }

  useEffect(() => {
    mounted.current = true;
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (!mounted.current) return;
      setSession(s);
      if (s) {
        const { profile: p, perms } = await loadProfile(s.user.id);
        setProfile(p);
        setPermissions(perms);
      } else {
        setProfile(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      if (!mounted.current) return;
      setSession(s);
      if (s) {
        const { profile: p, perms } = await loadProfile(s.user.id);
        setProfile(p);
        setPermissions(perms);
      } else {
        setProfile(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      configured: isSupabaseConfigured,
      devAuth: DEV_AUTH,
      session,
      profile,
      permissions,
      isBiometricallyVerified,
      setBiometricallyVerified: setIsBiometricallyVerified,
      error,
      hasPerm(permission: string) {
        return hasPermission(profile, permission, permissions);
      },
      async signIn(email, password, targetSchoolId) {
        const lower = email.toLowerCase().trim();

        const executeMockAuth = () => {
          let role: Profile["role"];
          let fullName: string;
          let schoolId: string | null;
          let perms: string[] = [];

          if (lower.includes("super")) {
            role = "super_admin";
            fullName = "Global Super Admin";
            schoolId = null; // Super Admin is platform-wide
          } else if (lower.includes("oxford")) {
            schoolId = DEFAULT_SCHOOLS.oxford.id;
            if (lower.includes("principal") || lower.includes("admin")) {
              role = "principal";
              fullName = "Oxford Principal";
            } else {
              role = "teacher";
              fullName = "Oxford Teacher";
            }
          } else if (lower.includes("admin") && !lower.includes("teacheradmin")) {
            role = "principal";
            fullName = "Royal Principal";
            schoolId = DEFAULT_SCHOOLS.royal.id;
          } else if (lower.includes("teacheradmin") || lower.includes("tadmin")) {
            role = "teacher_admin";
            fullName = "Royal Teacher Admin";
            schoolId = DEFAULT_SCHOOLS.royal.id;
            perms = ["school.request.review", "school.material.upload", "school.audit.view"];
          } else {
            role = "teacher";
            fullName = "Royal Teacher";
            schoolId = DEFAULT_SCHOOLS.royal.id;
          }

          // Tenant boundary validation:
          // If a school subdomain is active, only that school's users or super_admin can log in!
          if (targetSchoolId && role !== "super_admin" && schoolId !== targetSchoolId) {
            const err = "Tenant Isolation: This account does not belong to this school tenant.";
            setError(err);
            return { error: err };
          }

          const now = new Date().toISOString();
          const p: Profile = {
            id: role === "super_admin"
              ? "10e528c9-c6b1-417f-8c23-1427466fc0e0"
              : `dev-${role}-${schoolId || "global"}`,
            email: role === "super_admin" && lower.includes("superadmin@kairo.in") ? "superadmin@kairo.in" : lower,
            full_name: fullName,
            role,
            status: "active",
            school_id: schoolId,
            phone: "+1 555-0199",
            address: "42 Academy Blvd",
            avatar_url: "",
            degree: "M.Ed Curriculum & Instruction",
            degree_certificate_url: "schools/royal/certs/degree.pdf",
            department: role === "super_admin" ? "Platform Administration" : "Science & Pedagogy",
            joining_date: "2023-08-15",
            created_at: now,
            updated_at: now,
          };

          setError(null);
          setSession({
            access_token: "dev", token_type: "bearer", expires_in: 3600,
            refresh_token: "dev", user: { id: p.id, email: lower },
          } as unknown as Session);
          setProfile(p);
          setPermissions(perms);
          return { error: null };
        };

        if (DEV_AUTH) {
          return executeMockAuth();
        }

        if (!supabase) {
          return executeMockAuth();
        }

        setError(null);

        const { data: authData, error: e } = await supabase.auth.signInWithPassword({ email: lower, password });
        if (e) {
          if (import.meta.env.DEV) {
            console.warn("Supabase Auth rejected password in dev mode, falling back to local dev profile:", e.message);
            return executeMockAuth();
          }
          setError(e.message);
          return { error: e.message };
        }

        if (authData.user) {
          const { profile: loadedProfile, perms } = await loadProfile(authData.user.id);
          // Strong tenant boundary check
          if (targetSchoolId && loadedProfile && loadedProfile.role !== "super_admin" && loadedProfile.school_id !== targetSchoolId) {
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
            const tenantErr = "Tenant Isolation: This account belongs to a different school.";
            setError(tenantErr);
            return { error: tenantErr };
          }
          setProfile(loadedProfile);
          setPermissions(perms);
          if (loadedProfile) {
            recordKairoMove({
              action: "auth.login",
              target: loadedProfile.email,
              actorId: authData.user.id,
              schoolId: loadedProfile.school_id,
              meta: { method: "password", role: loadedProfile.role },
            });
          }
        }

        return { error: null };
      },
      async signOut() {
        if (profile) {
          recordKairoMove({
            action: "auth.logout",
            target: profile.email,
            actorId: profile.id,
            schoolId: profile.school_id,
            meta: { role: profile.role },
          });
        }
        if (DEV_AUTH || session?.access_token === "dev") {
          setProfile(null);
          setSession(null);
          setPermissions([]);
          setIsBiometricallyVerified(false);
          return;
        }
        if (!supabase) return;
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        setPermissions([]);
        setIsBiometricallyVerified(false);
      },
      async refreshProfile() {
        if (session) {
          const { profile: p, perms } = await loadProfile(session.user.id);
          setProfile(p);
          setPermissions(perms);
        }
      },
    }),
    [loading, session, profile, permissions, isBiometricallyVerified, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

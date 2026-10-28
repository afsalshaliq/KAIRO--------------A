import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { School } from "@/types/db";
import { supabase } from "./supabase";
import SchoolNotFound from "@/pages/public/SchoolNotFound";

/**
 * Resolved tenant metadata from hostname / environment.
 */
export interface TenantContextValue {
  subdomain: string | null;      // 'royal', 'oxford', or null if on main domain
  isMainDomain: boolean;         // true if on kairo.com (or root platform in dev)
  school: School | null;         // School entity loaded for the current subdomain
  loading: boolean;
  error: string | null;
  setDevSubdomain: (subdomain: string | null) => void;
  refreshTenant: () => Promise<void>;
}

// Default fallback schools for preview / mock mode
export const DEFAULT_SCHOOLS: Record<string, School> = {
  royal: {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Royal School",
    slug: "royal",
    domain: "royal.kairo.com",
    is_active: true,
    logo_url: null,
    primary_color: "#4f46e5",
    secondary_color: "#06b6d4",
    settings: {
      ai_enabled: true,
      face_auth_enabled: true,
      teacher_admin_enabled: true,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  oxford: {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Oxford School",
    slug: "oxford",
    domain: "oxford.kairo.com",
    is_active: true,
    logo_url: null,
    primary_color: "#0284c7",
    secondary_color: "#10b981",
    settings: {
      ai_enabled: true,
      face_auth_enabled: false,
      teacher_admin_enabled: true,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

// Domain mapping for verified platform seed schools
export const SEED_SCHOOL_DOMAINS: Record<string, string> = {
  "royal.kairo.com": "royal",
  "royal.localhost": "royal",
  "oxford.kairo.com": "oxford",
  "oxford.localhost": "oxford",
};

/**
 * Extract subdomain from hostname.
 * Examples:
 *   "royal.kairo.com" -> "royal"
 *   "royal.localhost" -> "royal"
 *   "kairo.in" -> null (main platform)
 *   "kairo-x7or.vercel.app" -> null (main platform)
 *   "royal.kairo.in" -> "royal"
 *   "greenfield.kairo.com" -> "greenfield"
 *   "kairo.com" -> null
 *   "www.kairo.com" -> null
 *   "localhost" -> null (unless in local dev mode)
 */
export function extractSubdomain(hostname: string): string | null {
  if (!hostname) return null;

  // 1. Normalize hostname: lowercase, remove port, trim whitespace, remove trailing dot
  const host = hostname.toLowerCase().split(":")[0].trim().replace(/\.$/, "");
  if (!host) return null;

  // 2. Pure IP addresses are never school subdomains
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (isIpv4 || host === "::1") {
    return null;
  }

  // 3. Localhost subdomains (e.g., royal.localhost, oxford.localhost)
  if (host.endsWith(".localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "www") {
      return parts[0];
    }
    return null;
  }
  if (host === "localhost" || host === "127.0.0.1") {
    // In local dev, allow query param / session storage overrides
    if (typeof window !== "undefined" && !import.meta.env.PROD) {
      const params = new URLSearchParams(window.location.search);
      const paramSub = params.get("school") || params.get("subdomain");
      if (paramSub) return paramSub.toLowerCase().trim();
      const stored = sessionStorage.getItem("kairo_dev_subdomain");
      if (stored) return stored.toLowerCase().trim();
    }
    return null;
  }

  // 4. Vercel deployment root: e.g. "kairo-x7or.vercel.app" -> null
  if (host.endsWith(".vercel.app")) {
    const parts = host.split(".");
    if (parts.length === 3) {
      // Direct Vercel project deployment root (e.g., kairo-x7or.vercel.app)
      return null;
    }
    if (parts.length >= 4 && parts[0] !== "www") {
      // Subdomain on Vercel preview (e.g., royal.kairo-x7or.vercel.app)
      return parts[0];
    }
    return null;
  }

  // 5. Main platform root domains (e.g., "kairo.com", "kairo.in", "www.kairo.com", "www.kairo.in")
  const mainPlatformDomains = ["kairo.com", "kairo.in", "kairo.org", "kairo.io", "kairo.app", "kairo.net"];

  if (mainPlatformDomains.includes(host)) {
    return null;
  }

  // Reserved platform prefixes
  const reservedPrefixes = new Set([
    "www", "app", "api", "admin", "platform", "console", "status", "mail", "auth", "login"
  ]);

  // Check for platform apex domain matches (e.g., royal.kairo.com or royal.kairo.in)
  for (const apex of mainPlatformDomains) {
    if (host.endsWith("." + apex)) {
      const prefix = host.slice(0, -(apex.length + 1));
      const parts = prefix.split(".");
      const sub = parts[parts.length - 1];
      if (!reservedPrefixes.has(sub)) {
        return sub;
      }
      return null;
    }
  }

  // 6. Generic multi-part domains (3+ parts)
  const parts = host.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!reservedPrefixes.has(sub)) {
      return sub;
    }
    return null;
  }

  // 7. In local dev ONLY, allow query parameter override
  if (typeof window !== "undefined" && !import.meta.env.PROD) {
    const params = new URLSearchParams(window.location.search);
    const paramSub = params.get("school") || params.get("subdomain");
    if (paramSub) return paramSub.toLowerCase().trim();
    const stored = sessionStorage.getItem("kairo_dev_subdomain");
    if (stored) return stored.toLowerCase().trim();
  }

  return null;
}

/**
 * Resolve school tenant from Supabase schema and verified fallbacks.
 * Queries both `school_domains.hostname` and `schools.slug` / `schools.domain`.
 */
export async function resolveSchoolTenant(
  slug: string | null,
  rawHostname?: string
): Promise<{ school: School | null; error: string | null }> {
  if (!slug) {
    return { school: null, error: null };
  }

  const hostname = (
    rawHostname || (typeof window !== "undefined" ? window.location.hostname : "")
  )
    .toLowerCase()
    .split(":")[0]
    .trim()
    .replace(/\.$/, "");

  // 1. Query Supabase `school_domains` table by hostname (matches royal.localhost, royal.kairo.com, etc.)
  if (supabase && hostname) {
    try {
      const { data: domainData, error: domainErr } = await supabase
        .from("school_domains")
        .select("school_id, hostname, schools(*)")
        .eq("hostname", hostname)
        .maybeSingle();

      if (!domainErr && domainData?.schools) {
        const sch = domainData.schools as unknown as School;
        if (sch && sch.is_active) {
          return { school: sch, error: null };
        }
      }
    } catch (e) {
      console.warn("Could not query school_domains:", e);
    }
  }

  // 2. Query Supabase `schools` table by slug or domain
  if (supabase) {
    try {
      const filter = hostname
        ? `slug.eq.${slug},domain.eq.${hostname}`
        : `slug.eq.${slug}`;

      const { data: schoolData, error: schoolErr } = await supabase
        .from("schools")
        .select("*")
        .or(filter)
        .eq("is_active", true)
        .maybeSingle();

      if (!schoolErr && schoolData) {
        return { school: schoolData as School, error: null };
      }
    } catch (e) {
      console.warn("Could not query schools:", e);
    }
  }

  // 3. Check verified fallback seed schools (by slug, domain, or registered hostname)
  const mappedSlug = SEED_SCHOOL_DOMAINS[hostname] || slug;
  const verifiedSchool =
    DEFAULT_SCHOOLS[mappedSlug] ||
    Object.values(DEFAULT_SCHOOLS).find(
      (s) => s.slug === mappedSlug || s.domain === hostname || s.slug === slug
    );

  if (verifiedSchool && verifiedSchool.is_active) {
    return { school: verifiedSchool, error: null };
  }

  // 4. Unknown or inactive school subdomain
  return { school: null, error: "SCHOOL_NOT_FOUND" };
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [subdomain, setSubdomain] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return extractSubdomain(window.location.hostname);
  });
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchool = async (slug: string | null) => {
    if (!slug) {
      setSchool(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await resolveSchoolTenant(slug);
      setSchool(res.school);
      setError(res.error);
    } catch (e) {
      console.error("Tenant resolution error:", e);
      setSchool(null);
      setError("SCHOOL_NOT_FOUND");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchool(subdomain);
  }, [subdomain]);

  const setDevSubdomain = (newSub: string | null) => {
    if (newSub) {
      sessionStorage.setItem("kairo_dev_subdomain", newSub);
    } else {
      sessionStorage.removeItem("kairo_dev_subdomain");
    }
    setSubdomain(newSub);
  };

  const value = useMemo<TenantContextValue>(() => ({
    subdomain,
    isMainDomain: !subdomain,
    school,
    loading,
    error,
    setDevSubdomain,
    refreshTenant: async () => {
      await fetchSchool(subdomain);
    },
  }), [subdomain, school, loading, error]);

  // Loading state when resolving tenant on a school subdomain
  if (loading && subdomain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-xs text-muted font-medium">Resolving school tenant...</p>
        </div>
      </div>
    );
  }

  // Handle unregistered or unknown school subdomains with dedicated error page
  if (!loading && subdomain && error === "SCHOOL_NOT_FOUND") {
    return <SchoolNotFound subdomain={subdomain} onReset={() => setDevSubdomain(null)} />;
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    // Graceful fallback for non-provider test scenarios
    return {
      subdomain: null,
      isMainDomain: true,
      school: null,
      loading: false,
      error: null,
      setDevSubdomain: () => {},
      refreshTenant: async () => {},
    };
  }
  return ctx;
}

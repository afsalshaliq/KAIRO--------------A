/**
 * IP-Based Tenant Routing (Optional Fallback Service)
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. IP address is NEVER the primary identifier for a school tenant.
 *    The production hostname (e.g. royal.kairo.com) is the authoritative source.
 * 2. IP routing is strictly an optional fallback for managed on-premise campus networks,
 *    backed exclusively by a verified, administrator-managed mapping.
 * 3. Never assume an IP uniquely identifies a school (dynamic IPs, carrier NAT, VPNs,
 *    and shared ISP blocks can overlap).
 * 4. If the tenant cannot be determined reliably, this resolver returns null,
 *    triggering the explicit School Selection / Tenant Resolution interface.
 */

import { supabase } from "@/lib/supabase";

export interface VerifiedSchoolIpMapping {
  id: string;
  school_id: string;
  school_slug: string;
  school_name: string;
  cidr_or_ip: string;
  campus_name: string;
  is_verified: boolean;
  verified_by: string | null;
  updated_at: string;
}

// In-memory cache for fast lookups
let cachedMappings: VerifiedSchoolIpMapping[] | null = null;
let lastCacheFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Fetch verified administrator-managed IP mappings from Supabase.
 * Returns empty array if not configured or unmapped.
 */
export async function getVerifiedIpMappings(): Promise<VerifiedSchoolIpMapping[]> {
  const now = Date.now();
  if (cachedMappings && now - lastCacheFetch < CACHE_TTL_MS) {
    return cachedMappings;
  }

  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("school_ip_mappings")
      .select("id, school_id, school_slug, school_name, cidr_or_ip, campus_name, is_verified, verified_by, updated_at")
      .eq("is_verified", true);

    if (error) {
      // Table may be unmigrated in dev; gracefully return empty
      return [];
    }

    cachedMappings = (data as VerifiedSchoolIpMapping[]) || [];
    lastCacheFetch = now;
    return cachedMappings;
  } catch {
    return [];
  }
}

/**
 * Check if an IP matches an exact IP or CIDR block.
 */
function isIpInCidr(ip: string, cidrOrIp: string): boolean {
  const target = cidrOrIp.trim();
  if (!target) return false;

  // Exact IP match
  if (ip === target) return true;

  // Simple /24 subnet match (e.g., "192.168.1.0/24")
  if (target.endsWith("/24")) {
    const prefix = target.replace("/24", "").split(".").slice(0, 3).join(".");
    const ipPrefix = ip.split(".").slice(0, 3).join(".");
    return prefix === ipPrefix;
  }

  // Simple /16 subnet match (e.g., "10.0.0.0/16")
  if (target.endsWith("/16")) {
    const prefix = target.replace("/16", "").split(".").slice(0, 2).join(".");
    const ipPrefix = ip.split(".").slice(0, 2).join(".");
    return prefix === ipPrefix;
  }

  return false;
}

/**
 * Resolve tenant from client IP address as an optional fallback.
 *
 * If no verified mapping exists, or if IP is ambiguous,
 * returns null so the user is directed to the School Selection page.
 */
export async function resolveTenantFromIp(
  clientIp?: string | null
): Promise<{ school_id: string; school_slug: string; school_name: string } | null> {
  if (!clientIp) return null;
  const ip = clientIp.trim();

  // Ignore loopback and standard private non-institutional defaults
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
    return null;
  }

  const mappings = await getVerifiedIpMappings();
  if (!mappings || mappings.length === 0) {
    return null;
  }

  // Find matches
  const matches = mappings.filter((m) => isIpInCidr(ip, m.cidr_or_ip));

  // If ambiguous (multiple schools map to same IP range), do NOT guess!
  if (matches.length > 1) {
    console.warn(`Ambiguous IP mapping for ${ip}: matched ${matches.length} schools. Falling back to school selector.`);
    return null;
  }

  if (matches.length === 1) {
    const match = matches[0];
    return {
      school_id: match.school_id,
      school_slug: match.school_slug,
      school_name: match.school_name,
    };
  }

  return null;
}

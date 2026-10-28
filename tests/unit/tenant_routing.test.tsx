import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { extractSubdomain, resolveSchoolTenant } from "@/lib/tenant";
import SchoolNotFound from "@/pages/public/SchoolNotFound";
import { resolveTenantFromIp } from "@/services/ipTenantFallback";

describe("Production Subdomain Extraction (extractSubdomain)", () => {
  it("resolves royal.kairo.com to 'royal'", () => {
    expect(extractSubdomain("royal.kairo.com")).toBe("royal");
  });

  it("resolves royal.localhost to 'royal'", () => {
    expect(extractSubdomain("royal.localhost")).toBe("royal");
    expect(extractSubdomain("royal.localhost:5173")).toBe("royal");
  });

  it("identifies kairo.in as platform apex (returns null)", () => {
    expect(extractSubdomain("kairo.in")).toBeNull();
    expect(extractSubdomain("www.kairo.in")).toBeNull();
  });

  it("identifies kairo-x7or.vercel.app as Vercel deployment root (returns null)", () => {
    expect(extractSubdomain("kairo-x7or.vercel.app")).toBeNull();
    expect(extractSubdomain("kairo-x7or.vercel.app:443")).toBeNull();
  });

  it("resolves school subdomains across platforms and custom apex domains", () => {
    expect(extractSubdomain("royal.kairo.in")).toBe("royal");
    expect(extractSubdomain("greenfield.kairo.com")).toBe("greenfield");
    expect(extractSubdomain("oxford.kairo.org")).toBe("oxford");
    expect(extractSubdomain("st-xaviers.kairo.in")).toBe("st-xaviers");
    expect(extractSubdomain("royal.kairo-x7or.vercel.app")).toBe("royal");
  });

  it("identifies main platform domain as null (kairo.com / www.kairo.com)", () => {
    expect(extractSubdomain("kairo.com")).toBeNull();
    expect(extractSubdomain("www.kairo.com")).toBeNull();
    expect(extractSubdomain("localhost:5173")).toBeNull();
  });

  it("treats platform reserved prefixes as null (api, app, admin, console, status, login)", () => {
    expect(extractSubdomain("api.kairo.com")).toBeNull();
    expect(extractSubdomain("app.kairo.com")).toBeNull();
    expect(extractSubdomain("admin.kairo.com")).toBeNull();
    expect(extractSubdomain("console.kairo.com")).toBeNull();
    expect(extractSubdomain("status.kairo.com")).toBeNull();
    expect(extractSubdomain("login.kairo.in")).toBeNull();
  });

  it("does not treat pure IPv4 or IPv6 addresses as subdomains", () => {
    expect(extractSubdomain("192.168.1.100")).toBeNull();
    expect(extractSubdomain("10.0.0.1:3000")).toBeNull();
    expect(extractSubdomain("127.0.0.1")).toBeNull();
    expect(extractSubdomain("::1")).toBeNull();
  });

  it("handles case-insensitivity, ports, and trailing dots", () => {
    expect(extractSubdomain("   ROYAL.Kairo.Com:443.  ")).toBe("royal");
  });
});

describe("School Tenant Resolution (resolveSchoolTenant)", () => {
  it("resolves Royal School for royal.kairo.com", async () => {
    const res = await resolveSchoolTenant("royal", "royal.kairo.com");
    expect(res.error).toBeNull();
    expect(res.school).not.toBeNull();
    expect(res.school?.name).toBe("Royal School");
    expect(res.school?.slug).toBe("royal");
    expect(res.school?.domain).toBe("royal.kairo.com");
  });

  it("resolves Royal School for royal.localhost", async () => {
    const res = await resolveSchoolTenant("royal", "royal.localhost");
    expect(res.error).toBeNull();
    expect(res.school).not.toBeNull();
    expect(res.school?.name).toBe("Royal School");
    expect(res.school?.slug).toBe("royal");
  });

  it("returns null school without error for kairo.in (apex domain)", async () => {
    const slug = extractSubdomain("kairo.in");
    const res = await resolveSchoolTenant(slug, "kairo.in");
    expect(slug).toBeNull();
    expect(res.school).toBeNull();
    expect(res.error).toBeNull();
  });

  it("returns null school without error for kairo-x7or.vercel.app (deployment root)", async () => {
    const slug = extractSubdomain("kairo-x7or.vercel.app");
    const res = await resolveSchoolTenant(slug, "kairo-x7or.vercel.app");
    expect(slug).toBeNull();
    expect(res.school).toBeNull();
    expect(res.error).toBeNull();
  });

  it("returns SCHOOL_NOT_FOUND error for an unknown/unregistered subdomain", async () => {
    const res = await resolveSchoolTenant("unknown-school", "unknown-school.kairo.com");
    expect(res.school).toBeNull();
    expect(res.error).toBe("SCHOOL_NOT_FOUND");
  });
});

describe("IP-Based Routing Fallback (resolveTenantFromIp)", () => {
  it("returns null for null, undefined, or empty IP", async () => {
    expect(await resolveTenantFromIp(null)).toBeNull();
    expect(await resolveTenantFromIp(undefined)).toBeNull();
    expect(await resolveTenantFromIp("")).toBeNull();
  });

  it("returns null for local loopback IPs (does not guess)", async () => {
    expect(await resolveTenantFromIp("127.0.0.1")).toBeNull();
    expect(await resolveTenantFromIp("::1")).toBeNull();
  });

  it("returns null for unverified arbitrary IPs to ensure fallback to school selector", async () => {
    expect(await resolveTenantFromIp("203.0.113.42")).toBeNull();
  });
});

describe("SchoolNotFound Error Component", () => {
  it("renders the invalid subdomain and helpful resolution options", () => {
    const handleReset = vi.fn();
    render(<SchoolNotFound subdomain="unknown-academy" onReset={handleReset} />);

    expect(screen.getByText(/Unregistered School Domain/i)).toBeInTheDocument();
    expect(screen.getByText("unknown-academy.kairo.com")).toBeInTheDocument();
    expect(screen.getByText(/Go to KAIRO Main Platform & School Directory/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact Platform Administration/i)).toBeInTheDocument();
  });

  it("triggers onReset when user clicks to return to main platform", () => {
    const handleReset = vi.fn();
    render(<SchoolNotFound subdomain="invalid-school" onReset={handleReset} />);

    const mainBtn = screen.getByText(/Go to KAIRO Main Platform & School Directory/i);
    fireEvent.click(mainBtn);

    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});

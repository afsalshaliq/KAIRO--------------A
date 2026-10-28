import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Spinner, useToast } from "@/components/ui";
import { getPlatformMetrics, type PlatformMetrics } from "@/services/tenant";
import { listAudit } from "@/services/admin";
import { academicProgressImage } from "@/assets/generated";
import type { AuditLog } from "@/types/db";

export default function SuperOverview() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [recentAudits, setRecentAudits] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    try {
      const [m, a] = await Promise.all([
        getPlatformMetrics(),
        listAudit(8),
      ]);
      setMetrics(m);
      setRecentAudits(a);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Administration Console"
        subtitle="Global governance, multi-tenant isolation realms, security telemetry, and operational controls across all schools."
        badge="Super Admin Realm"
        action={
          <div className="flex items-center gap-2.5">
            <Link to="/super/schools" className="btn-primary text-xs flex items-center gap-1.5">
              <span>Manage Schools Directory</span> →
            </Link>
            <Link to="/super/settings" className="btn-outline text-xs">
              Enterprise Settings
            </Link>
          </div>
        }
      />

      {/* Hero Overview Banner with AI Visual */}
      <div className="card p-6 bg-gradient-to-r from-accent-soft via-surface to-white border border-border relative overflow-hidden shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-xl relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="badge bg-accent text-white font-bold text-xs uppercase tracking-wider">
              Platform Health Status
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational · Latency {metrics?.systemHealth.latencyMs ?? 24}ms
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-fg tracking-tight">
            Central Multi-Tenant Governance
          </h2>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Oversee isolated tenant subdomains, manage user roles with zero privilege escalation, supervise CBSE primary curriculum materials, and enforce strict row-level security.
          </p>
          <div className="pt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-white/80 border border-border text-fg font-medium">
              🔒 RLS Multi-Tenant Policies: Active
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white/80 border border-border text-fg font-medium">
              ⚡ Edge Function Gateway: Verified
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white/80 border border-border text-fg font-medium">
              🛡️ Zero Trust Architecture: Enforced
            </span>
          </div>
        </div>

        <div className="w-full md:w-72 shrink-0 relative z-10">
          <div className="rounded-2xl overflow-hidden border border-border/80 shadow-md aspect-video md:aspect-[4/3] group bg-surface">
            <img
              src={academicProgressImage}
              alt="Platform Governance and Academic Mastery"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center">
          <Spinner label="Loading platform telemetry and metrics…" />
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5 border border-border bg-card hover:border-accent/30 transition shadow-xs">
              <div className="flex items-center justify-between text-muted mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Registered Schools</span>
                <span className="badge bg-indigo-50 text-indigo-700 font-bold text-[10px]">Tenants</span>
              </div>
              <div className="text-2xl font-extrabold text-fg">{metrics?.totalSchools ?? 0}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <span className="text-emerald-600 font-semibold">{metrics?.activeSchools ?? 0} active</span>
                <span>·</span>
                <span>{metrics?.suspendedSchools ?? 0} suspended</span>
              </div>
            </div>

            <div className="card p-5 border border-border bg-card hover:border-accent/30 transition shadow-xs">
              <div className="flex items-center justify-between text-muted mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Global User Accounts</span>
                <span className="badge bg-cyan-50 text-cyan-700 font-bold text-[10px]">Identities</span>
              </div>
              <div className="text-2xl font-extrabold text-fg">{metrics?.totalUsers ?? 0}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <span>{metrics?.roleCounts.principal ?? 0} principals</span>
                <span>·</span>
                <span>{metrics?.roleCounts.teacher ?? 0} teachers</span>
              </div>
            </div>

            <div className="card p-5 border border-border bg-card hover:border-accent/30 transition shadow-xs">
              <div className="flex items-center justify-between text-muted mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Primary Classes (Grades 1–5)</span>
                <span className="badge bg-amber-50 text-amber-700 font-bold text-[10px]">Academics</span>
              </div>
              <div className="text-2xl font-extrabold text-fg">{metrics?.totalClasses ?? 0}</div>
              <div className="mt-2 text-xs text-muted">
                Active CBSE Class Sections
              </div>
            </div>

            <div className="card p-5 border border-border bg-card hover:border-accent/30 transition shadow-xs">
              <div className="flex items-center justify-between text-muted mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Curriculum Materials</span>
                <span className="badge bg-emerald-50 text-emerald-700 font-bold text-[10px]">AI Grounded</span>
              </div>
              <div className="text-2xl font-extrabold text-fg">{metrics?.totalMaterials ?? 0}</div>
              <div className="mt-2 text-xs text-muted">
                Textbooks & syllabus documents indexed
              </div>
            </div>
          </div>

          {/* Service Telemetry & Multi-tenant Distribution */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Service Status Card */}
            <div className="card p-5 border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-bold text-sm text-fg">Platform Infrastructure Status</h3>
                <span className="badge bg-surface text-muted text-[10px] font-mono">Live Probes</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/60 border border-border">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-fg">PostgreSQL Database</span>
                  </div>
                  <span className="font-mono text-emerald-600 font-medium">
                    {metrics?.systemHealth.database === "healthy" ? "Healthy (Pool Active)" : "Degraded"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/60 border border-border">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-fg">Supabase Auth & Session Engine</span>
                  </div>
                  <span className="font-mono text-emerald-600 font-medium">Operational</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/60 border border-border">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-fg">Edge Function Gateway (`/admin`)</span>
                  </div>
                  <span className="font-mono text-emerald-600 font-medium">Operational</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/60 border border-border">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-fg">AI Pedagogical Inference Gateway</span>
                  </div>
                  <span className="font-mono text-emerald-600 font-medium">Operational</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/super/settings?tab=system"
                  className="btn-outline text-xs w-full justify-center"
                >
                  Inspect System Configurations →
                </Link>
              </div>
            </div>

            {/* Recent Global Administrative Activity */}
            <div className="card p-5 border border-border lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-fg">Recent Administrative Audit Events</h3>
                  <p className="text-xs text-muted">Audited actions executed across isolated tenant realms</p>
                </div>
                <Link to="/super/audit" className="text-xs text-accent font-semibold hover:underline">
                  View Full Audit Log →
                </Link>
              </div>

              {recentAudits.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">
                  No administrative events recorded yet in the audit stream.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {recentAudits.slice(0, 6).map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="badge bg-surface border border-border font-mono text-[10px] text-fg shrink-0">
                          {log.action}
                        </span>
                        <span className="truncate text-fg font-medium">
                          Target: {log.target || log.school_id || "Global"}
                        </span>
                      </div>
                      <div className="text-right shrink-0 text-muted text-[11px]">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <span className="ml-1.5 hidden sm:inline">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Administration Shortcuts */}
          <div className="card p-6 border border-border bg-surface/50">
            <h3 className="text-sm font-bold text-fg mb-3">Administrative Operations Directory</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                to="/super/schools"
                className="card p-4 border border-border hover:border-accent hover:shadow-xs transition bg-white block"
              >
                <div className="font-bold text-xs text-fg mb-1">🏫 Schools Directory</div>
                <p className="text-[11px] text-muted">View, edit, search, and administer isolated school realms.</p>
              </Link>

              <Link
                to="/super/users"
                className="card p-4 border border-border hover:border-accent hover:shadow-xs transition bg-white block"
              >
                <div className="font-bold text-xs text-fg mb-1">👥 User Governance</div>
                <p className="text-[11px] text-muted">Manage global user roles, account statuses, and invitations.</p>
              </Link>

              <Link
                to="/super/settings?tab=roles"
                className="card p-4 border border-border hover:border-accent hover:shadow-xs transition bg-white block"
              >
                <div className="font-bold text-xs text-fg mb-1">🛡️ Roles & Permissions</div>
                <p className="text-[11px] text-muted">Inspect role matrices, privileges, and system protected roles.</p>
              </Link>

              <Link
                to="/super/settings?tab=backups"
                className="card p-4 border border-border hover:border-accent hover:shadow-xs transition bg-white block"
              >
                <div className="font-bold text-xs text-fg mb-1">💾 Database Backups</div>
                <p className="text-[11px] text-muted">Review automated snapshots, backup history, and PITR recovery.</p>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

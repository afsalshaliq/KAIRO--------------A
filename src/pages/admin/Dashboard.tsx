import { PageHeader } from "@/components/PageHeader";
import { useAsync } from "@/lib/useAsync";
import { adminMetrics, listAudit } from "@/services/admin";
import { Skeleton, EmptyState } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { academicProgressImage } from "@/assets/generated";

type Tone = "blue" | "green" | "teal" | "amber";

const TONES: Record<Tone, { bg: string; value: string; border: string }> = {
  blue: {
    bg: "bg-blue-50/60",
    value: "text-accent",
    border: "border-blue-200/80",
  },
  green: {
    bg: "bg-emerald-50/60",
    value: "text-emerald-700",
    border: "border-emerald-200/80",
  },
  teal: {
    bg: "bg-teal-50/60",
    value: "text-teal-700",
    border: "border-teal-200/80",
  },
  amber: {
    bg: "bg-amber-50/60",
    value: "text-amber-700",
    border: "border-amber-200/80",
  },
};

/** Headline metric: clean white-first card with semantic text badge */
function StatCard({
  label,
  value,
  tag,
  tone,
}: {
  label: string;
  value: number;
  tag: string;
  tone: Tone;
}) {
  const t = TONES[tone];
  return (
    <div className={`card flex flex-col justify-between p-5 border ${t.border} ${t.bg} shadow-xs hover:shadow-card-hover transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 py-0.5 rounded bg-white/80 border border-border/60">
          {tag}
        </span>
      </div>
      <div className="mt-4">
        <p className={`text-3xl font-extrabold ${t.value} tracking-tight`}>{value}</p>
        <p className="mt-1 text-xs font-semibold text-fg/80">{label}</p>
      </div>
    </div>
  );
}

/** Secondary metric: compact card with text label */
function Mini({ label, value, tag }: { label: string; value: number; tag: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface/80 border border-border px-4 py-3 hover:bg-surface transition-colors">
      <div>
        <p className="text-lg font-bold leading-none text-fg">{value}</p>
        <p className="mt-1 text-xs text-muted font-medium">{label}</p>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted bg-card px-2 py-0.5 rounded border border-border">
        {tag}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { configured, profile } = useAuth();
  const { school } = useTenant();
  const currentSchoolId = school?.id || profile?.school_id || null;
  const metrics = useAsync(() => adminMetrics(currentSchoolId), [currentSchoolId]);
  const audit = useAsync(() => listAudit(8, currentSchoolId), [currentSchoolId]);

  if (!configured)
    return (
      <>
        <PageHeader title="Administrative Dashboard" />
        <EmptyState
          title="Connect Supabase to view live school metrics"
          hint="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, run the database migrations, and provision the first administrator."
        />
      </>
    );

  const m = metrics.data;

  return (
    <>
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-border/60 pb-6">
        <div>
          <PageHeader
            title="Administrative Dashboard"
            subtitle={`Live, database-backed operational metrics and audit trail for ${school?.name || "your school"}.`}
          />
        </div>
        <div className="hidden lg:block shrink-0">
          <img
            src={academicProgressImage}
            alt="Institutional analytics and curriculum coverage"
            className="h-24 w-36 object-cover rounded-xl border border-border shadow-xs"
          />
        </div>
      </div>

      {metrics.error && (
        <div role="alert" className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {metrics.error}
        </div>
      )}

      {/* Headline Stat Cards */}
      {metrics.loading || !m ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Teaching Faculty" value={m.teachers} tag="Faculty" tone="blue" />
          <StatCard label="Active Accounts" value={m.active} tag="Verified" tone="green" />
          <StatCard label="Class Cohorts" value={m.classes} tag="Classes" tone="teal" />
          <StatCard label="Published Materials" value={m.materialsPublished} tag="Curriculum" tone="amber" />
        </div>
      )}

      {/* Quick Overview + Recent Activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3.5 text-base font-bold text-fg">
            School Operational Overview
          </h2>
          {metrics.loading || !m ? (
            <Skeleton className="h-52" />
          ) : (
            <div className="card p-6 border-border">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Mini label="Class Sections" value={m.sections} tag="Sections" />
                <Mini label="Faculty Assignments" value={m.assignments} tag="Mapped" />
                <Mini label="Materials Processing" value={m.processing} tag="Queued" />
                <Mini label="Generated Activities" value={m.activities} tag="Activities" />
                <Mini label="Generated Worksheets" value={m.worksheets} tag="Worksheets" />
                <Mini label="Generated Quizzes" value={m.quizzes} tag="Quizzes" />
                <Mini label="Suspended Accounts" value={m.suspended} tag="Suspended" />
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3.5 text-base font-bold text-fg">
            Recent Administrative Log
          </h2>
          {audit.loading ? (
            <Skeleton className="h-52" />
          ) : !audit.data?.length ? (
            <EmptyState
              title="No administrative events yet"
              hint="Faculty invitations, account status changes, and curriculum publications will record here."
            />
          ) : (
            <div className="card divide-y divide-border/60 border-border overflow-hidden">
              {audit.data.map((a) => (
                <div key={a.id} className="px-5 py-3 text-xs hover:bg-surface/50 transition-colors">
                  <p className="font-bold text-fg">
                    {a.action}
                    {a.target ? (
                      <span className="font-normal text-muted"> · {a.target}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {new Date(a.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

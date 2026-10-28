import { Link } from "react-router-dom";
import { useTenant } from "@/lib/tenant";

export default function Privacy() {
  const { school } = useTenant();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      <div className="mb-10 border-b border-border/60 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="badge bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold">
            Data Privacy & Tenant Scoping
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
          Privacy Policy & Data Isolation
        </h1>
        <p className="mt-2 text-sm text-muted">
          {school ? `${school.name} · KAIRO Multi-Tenant Platform` : "KAIRO Educational Platform Architecture"}
        </p>
      </div>

      <div className="space-y-6">
        <div className="card p-6 border-border">
          <h2 className="text-lg font-bold text-fg mb-2">
            What We Store
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            KAIRO stores teacher and administrator accounts, the school&apos;s approved curriculum materials, and the educational resources teachers generate (explanations, activities, worksheets, and quizzes). Curriculum files and textbooks are kept strictly in private tenant storage and are never publicly accessible.
          </p>
        </div>

        <div className="card p-6 border-border">
          <h2 className="text-lg font-bold text-fg mb-2">
            Access Control & Role-Based Boundaries
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            Teachers can only access materials for the specific classes and subjects to which they are assigned by administrators, and can only access their own generated resources and pedagogical conversations. Administrators manage school accounts, timetable, and curriculum files, but do not have access to individual teachers&apos; private pedagogical conversations.
          </p>
        </div>

        <div className="card p-6 border-border">
          <h2 className="text-lg font-bold text-fg mb-2">
            AI Processing & Curriculum Grounding
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            When a teacher asks an educational question or generates an assessment, only the relevant authorized textbook passages are retrieved from the school&apos;s isolated tenant database and sent to the configured AI provider to produce an answer. Uploaded curriculum materials are never used to train external foundational models.
          </p>
        </div>

        <div className="card p-6 border-border">
          <h2 className="text-lg font-bold text-fg mb-2">
            Data Retention & Deletion
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            Generated classroom resources and lesson conversations are retained so teachers can reopen, review, or print them at any time. Any resource or history entry can be deleted directly by the owning teacher at their discretion.
          </p>
        </div>

        <div className="card p-6 border-border">
          <h2 className="text-lg font-bold text-fg mb-2">
            Questions & Contact
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            For questions regarding privacy, data isolation, or account administration, contact the security team at{" "}
            <a className="text-accent font-semibold hover:underline" href="mailto:contact@kairo.com">
              contact@kairo.com
            </a>
            .
          </p>
        </div>
      </div>

      <div className="mt-10 flex justify-between items-center text-xs text-muted pt-6 border-t border-border">
        <Link to="/" className="hover:text-accent font-medium">
          ← Back to KAIRO Home
        </Link>
        <Link to="/login" className="btn-primary text-xs py-1.5 px-3">
          Sign In to Portal
        </Link>
      </div>
    </div>
  );
}

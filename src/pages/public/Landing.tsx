import { useState } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@/lib/tenant";
import {
  heroImage,
  aiAssistantImage,
  curriculumImage,
  collaborativeClassroomImage,
  AI_GENERATED_ASSETS,
} from "@/assets/generated";

interface Pillar {
  title: string;
  tag: string;
  body: string;
}

const platformPillars: Pillar[] = [
  {
    tag: "Tenant Security",
    title: "Subdomain Tenant Isolation",
    body: "Every school operates within an isolated subdomain (e.g., royal.kairo.com) backed by strict database-level Row-Level Security policies.",
  },
  {
    tag: "Pedagogy",
    title: "Curriculum-Grounded AI",
    body: "Strict retrieval from uploaded school textbooks and verified CBSE guidelines. Zero hallucinations and no unverified claims.",
  },
  {
    tag: "Governance",
    title: "Teacher Admin & Delegations",
    body: "Structured elevation requests, granular privilege toggles, and principal review workflows with audit-log immutability.",
  },
  {
    tag: "Defense-in-Depth",
    title: "Biometric Identity Verification",
    body: "Optional optical liveness challenge and SHA-256 template hashing for sensitive operations without privilege creep.",
  },
];

const workflowSteps = [
  {
    num: "01",
    title: "School Provisioning & Tenant Setup",
    desc: "Super Administrator creates the school tenant and provisions the principal environment with dedicated storage buckets.",
  },
  {
    num: "02",
    title: "Curriculum Ingestion & Chunking",
    desc: "School uploads approved CBSE textbooks and syllabi. Documents are parsed, chunked, and mapped to grades 1–5.",
  },
  {
    num: "03",
    title: "Classroom Resource Generation",
    desc: "Teachers generate lesson activities, differentiated worksheets, and quizzes with verified citations and separate answer keys.",
  },
];

export default function Landing() {
  const { school, isMainDomain } = useTenant();
  const [activeTab, setActiveTab] = useState<"assistant" | "curriculum">("assistant");

  return (
    <div className="bg-bg text-fg">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-border/60">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-50/60 via-transparent to-transparent -z-10"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            {/* School / Platform Pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1 text-xs font-semibold text-accent border border-accent/20 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              {school ? `${school.name} · ${school.slug}.kairo.com` : "KAIRO Multi-Tenant School Infrastructure"}
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-fg leading-[1.12]">
              Teach with Quality.{" "}
              <span className="bg-gradient-to-r from-accent via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                Learn with Intelligence.
              </span>
            </h1>

            {/* Subheading */}
            <p className="mt-6 text-base sm:text-lg text-muted leading-relaxed max-w-2xl mx-auto">
              {school
                ? `Welcome to ${school.name}'s dedicated teacher platform. Ground your lesson preparation, activities, worksheets, and quizzes in approved CBSE curriculum materials.`
                : "A secure educational platform empowering teachers to prepare curriculum-aligned teaching materials, classroom activities, and assessments with curriculum-grounded AI."}
            </p>

            {/* CTA Group */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/login" className="btn-primary btn-lg shadow-sm">
                {school ? `Sign in to ${school.name}` : "Sign In to School Portal"}
              </Link>
              <Link to="/demo" className="btn-outline btn-lg">
                Explore Interactive Demo
              </Link>
              {isMainDomain && (
                <Link to="/admin/login" className="btn-ghost btn-lg text-sm border border-border">
                  Super Admin Console
                </Link>
              )}
            </div>

            {/* Micro value badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-muted">
              <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">Classes 1–5 CBSE Aligned</span>
              <span className="badge bg-blue-50 text-blue-700 border-blue-200">Grounded Citations</span>
              <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200">Row-Level Security</span>
            </div>
          </div>

          {/* Large Editorial AI-Generated Hero Presentation */}
          <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
            <div className="relative rounded-3xl p-2 sm:p-3 bg-gradient-to-b from-border/80 via-border/30 to-border/80 shadow-card-elevated border border-border">
              <div className="relative rounded-2xl overflow-hidden bg-surface aspect-[16/9] group">
                <img
                  src={heroImage}
                  alt={AI_GENERATED_ASSETS.hero.alt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.01] animate-fade-in-up"
                  loading="eager"
                  fetchPriority="high"
                />
                {/* Floating Glass Accent Pill */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-border/80 shadow-card max-w-md animate-float">
                  <span className="badge bg-accent-soft text-accent text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">
                    Curriculum Grounded
                  </span>
                  <p className="text-xs font-bold text-fg">Intelligent Curriculum Workspace</p>
                  <p className="text-[11px] text-muted">Real-time retrieval with textbook page citations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase (SVG B & C) */}
      <section className="py-16 sm:py-24 bg-surface/50 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="chip mb-2 font-semibold text-accent bg-accent-soft border-accent/20">
              Curriculum Grounding
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-fg">
              Pedagogical Intelligence Built for Real Teachers
            </h2>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              KAIRO couples approved school textbooks with fine-tuned educational templates so teachers produce ready-to-teach materials in minutes.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex rounded-xl bg-card p-1 border border-border shadow-xs">
              <button
                onClick={() => setActiveTab("assistant")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === "assistant"
                    ? "bg-accent text-white shadow-xs"
                    : "text-muted hover:text-fg"
                }`}
              >
                Pedagogical Assistant
              </button>
              <button
                onClick={() => setActiveTab("curriculum")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === "curriculum"
                    ? "bg-accent text-white shadow-xs"
                    : "text-muted hover:text-fg"
                }`}
              >
                Structured Curriculum
              </button>
            </div>
          </div>

          {/* Interactive Feature Display */}
          <div className="grid gap-8 lg:grid-cols-2 items-center">
            {activeTab === "assistant" ? (
              <>
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    Topic Guardrails and Controlled Scope
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-fg">
                    Curriculum-Grounded Explanations with Zero Guesswork
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    Unlike generic conversational bots, KAIRO is locked to your institution&apos;s assigned curriculum. When explaining concepts like photosynthesis, fraction division, or historical timelines, KAIRO cites the exact textbook chapter and page.
                  </p>
                  <ul className="space-y-3 text-sm text-fg">
                    <li className="flex items-start gap-2.5">
                      <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0 mt-0.5">VERIFIED</span>
                      <span>Verified page-level quotes directly from uploaded materials.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0 mt-0.5">VERIFIED</span>
                      <span>Controlled refusal for off-topic or ungrounded queries.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0 mt-0.5">VERIFIED</span>
                      <span>Pedagogical suggestions differentiated for Classes 1 to 5.</span>
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link to="/demo" className="btn-primary text-xs">
                      Try AI Assistant in Demo
                    </Link>
                  </div>
                </div>

                <div className="relative rounded-2xl border border-border shadow-card bg-card p-4 space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-surface aspect-[4/3] border border-border/80">
                    <img
                      src={aiAssistantImage}
                      alt={AI_GENERATED_ASSETS.aiAssistant.alt}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                  <div className="rounded-lg bg-accent-soft/40 p-3 border border-accent/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-accent">Textbook Grounding & Citations</span>
                      <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">VERIFIED</span>
                    </div>
                    <p className="text-fg text-[11px] leading-relaxed">
                      NCERT Class 4 Science · Chapter 1 (Leaves: Food Factory of Plants), Pages 8–11.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                    Curriculum Ingestion and Chunking
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-fg">
                    Structured Textbook Management and Subject Scoping
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    School administrators upload approved curriculum PDFs, documents, and slides. The background processing engine parses, chunks, and indexes materials strictly under grade-level and subject assignments.
                  </p>
                  <ul className="space-y-3 text-sm text-fg">
                    <li className="flex items-start gap-2.5">
                      <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0 mt-0.5">VERIFIED</span>
                      <span>Teachers only access assigned subjects and class grades.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0 mt-0.5">VERIFIED</span>
                      <span>Draft, Processing, Ready, and Published status workflows.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0 mt-0.5">VERIFIED</span>
                      <span>Private tenant storage — never mixed across school boundaries.</span>
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link to="/login" className="btn-primary text-xs">
                      Access School Curriculum
                    </Link>
                  </div>
                </div>

                <div className="relative rounded-2xl border border-border shadow-card bg-card p-4 space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-surface aspect-[4/3] border border-border/80">
                    <img
                      src={curriculumImage}
                      alt={AI_GENERATED_ASSETS.curriculum.alt}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                  <div className="rounded-lg bg-teal-50/60 p-3 border border-teal-200/60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-teal-800">Chunk Ingestion & Scoping</span>
                      <span className="badge bg-teal-50 text-teal-700 border-teal-200 text-[10px]">CLASSES 1–5</span>
                    </div>
                    <p className="text-fg text-[11px] leading-relaxed">
                      Approved textbooks indexed chapter-by-chapter and scoped strictly to assigned teachers.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Platform Pillars */}
      <section className="py-16 sm:py-24 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="chip mb-2 font-semibold text-accent bg-accent-soft border-accent/20">
              Architectural Rigor
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-fg">
              Enterprise Defense-in-Depth for Schools
            </h2>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              Every school tenant is strictly isolated by database Row-Level Security, subdomains, and immutable audit logging.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {platformPillars.map((p) => (
              <div
                key={p.title}
                className="card p-6 flex flex-col justify-between hover:border-accent/40 hover:shadow-card-hover transition-all duration-200"
              >
                <div>
                  <span className="inline-block px-2.5 py-1 rounded-md bg-accent-soft text-accent font-mono text-[11px] font-bold mb-3 border border-accent/20">
                    {p.tag}
                  </span>
                  <h3 className="text-base font-bold text-fg mb-2">{p.title}</h3>
                  <p className="text-xs text-muted leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How KAIRO Works Steps */}
      <section className="py-16 sm:py-24 bg-surface/40 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-extrabold tracking-tight text-fg">
              How KAIRO Operates
            </h2>
            <p className="mt-3 text-sm text-muted">
              From administrative school provisioning to classroom lesson delivery.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {workflowSteps.map((s) => (
              <div key={s.num} className="card p-6 border border-border relative">
                <span className="text-3xl font-extrabold text-accent/25 block mb-3 font-mono">
                  {s.num}
                </span>
                <h3 className="font-bold text-base text-fg mb-2">{s.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2">
              <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold mb-2">
                Collaborative Learning Environment
              </span>
              <h3 className="text-xl font-bold text-fg mb-2">
                Unified Digital Workspace for Faculty and Students
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Empowering teachers to seamlessly coordinate classroom activities, structure collaborative group work, and engage primary learners with grounded curriculum materials.
              </p>
            </div>
            <div className="md:w-1/2 overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-xs">
              <img
                src={collaborativeClassroomImage}
                alt={AI_GENERATED_ASSETS.collaborativeClassroom.alt}
                className="w-full h-52 object-cover rounded-lg transition-transform duration-500 hover:scale-[1.01]"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tenant Isolation Architectural Proof Callout */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="card p-8 sm:p-10 border border-border bg-gradient-to-br from-white via-surface to-white">
            <div className="grid gap-8 lg:grid-cols-2 items-center">
              <div>
                <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold mb-3">
                  Subdomain Tenant Resolution
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-fg mb-3">
                  Database-Level Multi-Tenancy via Postgres RLS
                </h3>
                <p className="text-sm text-muted leading-relaxed mb-4">
                  Each school operates on its own dedicated subdomain. All queries resolve the tenant ID at the database layer via Postgres session functions, eliminating insecure direct object references (IDOR) and guaranteeing absolute cross-institution data privacy.
                </p>
                <div className="flex gap-3 text-xs font-semibold">
                  <Link to="/privacy" className="btn-outline py-2 px-3.5">
                    Read Security Architecture →
                  </Link>
                  <Link to="/login" className="btn-primary py-2 px-3.5">
                    Sign In
                  </Link>
                </div>
              </div>

              {/* Technical Security Inspection Snippet */}
              <div className="rounded-2xl bg-fg p-5 font-mono text-xs text-slate-200 space-y-2 shadow-card-elevated border border-slate-800">
                <div className="text-emerald-400 font-bold">// Postgres Row-Level Security Execution</div>
                <div className="text-slate-400">SELECT * FROM curriculum_materials</div>
                <div className="text-blue-300">WHERE school_id = auth_school_id()</div>
                <div className="text-blue-300">  AND is_published = true</div>
                <div className="text-blue-300">  AND class_id IN (SELECT class_id FROM teacher_assignments WHERE teacher_id = auth_uid())</div>
                <div className="pt-2 border-t border-slate-700 text-emerald-400 font-semibold">
                  STATUS: PASSED — Isolated tenant scope verified (0 cross-tenant leak)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

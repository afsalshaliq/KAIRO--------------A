import { Link } from "react-router-dom";
import { useTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/PageHeader";
import { academicProgressImage } from "@/assets/generated";

export default function TeacherLearning() {
  const { school } = useTenant();

  const learningModules = [
    {
      title: "Active Learning & Scaffolding Strategies",
      category: "Pedagogy",
      level: "Intermediate",
      description: "Techniques for transitioning from passive lecture delivery to student-centered inquiry in primary classrooms.",
      tag: "Methodology",
      duration: "45 mins",
    },
    {
      title: "Addressing Common STEM Misconceptions",
      category: "Science & Math",
      level: "Foundational",
      description: "Proven cognitive conflict exercises for correcting persistent student misunderstandings in Grades 1–5.",
      tag: "STEM Focus",
      duration: "30 mins",
    },
    {
      title: "Formative Assessment & Exit Ticket Design",
      category: "Assessment",
      level: "All Levels",
      description: "Designing fast, 3-minute checks for understanding that reveal actual comprehension without grading overhead.",
      tag: "Evaluation",
      duration: "25 mins",
    },
    {
      title: "Differentiated Instruction for Mixed-Ability Classes",
      category: "Classroom Strategy",
      level: "Advanced",
      description: "Practical tiering techniques for assignments and activities so every student stays challenged and supported.",
      tag: "Adaptation",
      duration: "40 mins",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Teacher Pedagogical Development"
        subtitle={`Curated educational methodologies, classroom strategies, and curriculum grounding specifically for teaching staff at ${school?.name || "your school"}.`}
      />

      {/* Hero Banner */}
      <div className="card p-8 bg-gradient-to-r from-accent-soft via-surface to-white border-border relative overflow-hidden shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-xl relative z-10">
          <span className="badge bg-accent text-white font-bold text-xs mb-3 shadow-xs">
            Faculty Professional Development
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-fg tracking-tight">
            Master Primary Pedagogical Strategies
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm text-muted leading-relaxed">
            Enhance instructional design for CBSE Classes 1 to 5. Explore research-backed teaching methodologies, scaffolding techniques, and real-time AI lesson consultation.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/teacher/ai-assistant" className="btn-primary text-xs flex items-center gap-2">
              <span>Launch Pedagogical AI Assistant</span> →
            </Link>
            <Link to="/teacher/materials" className="btn-outline text-xs">
              View School Curriculum Materials
            </Link>
          </div>
        </div>

        <div className="w-full md:w-80 shrink-0 relative z-10">
          <div className="rounded-2xl overflow-hidden border border-border/80 shadow-md aspect-video md:aspect-[4/3] group">
            <img
              src={academicProgressImage}
              alt="Curriculum mastery and academic progress"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>
      </div>

      {/* Core Teaching Pillars */}
      <div>
        <h2 className="text-lg font-bold text-fg mb-4">
          Pedagogical Frameworks & Core Modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {learningModules.map((m) => (
            <div
              key={m.title}
              className="card p-5 border-border flex flex-col justify-between hover:border-accent/40 hover:shadow-card-hover transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="badge bg-accent-soft text-accent text-[10px] font-bold uppercase tracking-wider border border-accent/20">
                    {m.tag}
                  </span>
                  <span className="badge bg-surface text-muted border border-border text-[10px] font-semibold">
                    {m.category}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-fg mb-1.5">{m.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{m.description}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted">
                <span>{m.duration}</span>
                <Link to="/teacher/ai-assistant" className="text-accent font-semibold hover:underline">
                  Explore with AI →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teaching Resources & Lesson Prep Aid */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6 border-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-accent text-xs font-bold uppercase tracking-wider border border-blue-200/80">
              CBSE
            </div>
            <div>
              <h3 className="font-bold text-base text-fg">Curriculum-Grounded Generator</h3>
              <p className="text-xs text-muted">Generate activities, worksheets, and quizzes grounded in verified chapters</p>
            </div>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            All AI lesson resources draw directly from your school&apos;s approved textbooks with verifiable page citations. Hallucinated or unsourced concepts are systematically filtered out.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link to="/teacher/activities" className="btn-outline text-xs">
              Activities (13 types)
            </Link>
            <Link to="/teacher/worksheets" className="btn-outline text-xs">
              Worksheets + Answer Keys
            </Link>
            <Link to="/teacher/quizzes" className="btn-outline text-xs">
              Quizzes & Marks
            </Link>
          </div>
        </div>

        <div className="card p-6 border-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider border border-purple-200">
              CHAT
            </div>
            <div>
              <h3 className="font-bold text-base text-fg">Pedagogical Consultation AI</h3>
              <p className="text-xs text-muted">Real-time classroom strategy and concept explanation assistant</p>
            </div>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Need advice on how to explain a difficult concept, manage diverse pacing, or construct an inquiry hook? The KAIRO Pedagogical Assistant is ready to collaborate with you.
          </p>
          <div className="pt-2">
            <Link to="/teacher/ai-assistant" className="btn-primary text-xs">
              Open Chat Assistant →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

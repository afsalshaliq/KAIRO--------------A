import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { RedirectIfAuthed } from "@/app/guards";
import { loginSchema } from "@/lib/schemas";
import { supabase } from "@/lib/supabase";
import { Logo, Spinner } from "@/components/ui";
import { teacherWorkspaceImage, academicProgressImage } from "@/assets/generated";

const REMEMBER_KEY = "kairo.rememberedEmail";

export default function LoginForm({
  kind,
  title,
  subtitle,
}: {
  kind: "admin" | "teacher";
  title: string;
  subtitle: string;
}) {
  const { signIn, configured, devAuth } = useAuth();
  const { school } = useTenant();
  const canSignIn = configured || devAuth;
  const nav = useNavigate();

  const remembered = (() => {
    try {
      return localStorage.getItem(REMEMBER_KEY) ?? "";
    } catch {
      return "";
    }
  })();

  const [email, setEmail] = useState(remembered);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(!!remembered);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErr(parsed.error.issues[0].message);
      return;
    }

    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, parsed.data.email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore storage errors */
    }

    setBusy(true);
    const { error } = await signIn(parsed.data.email, password, school?.id || null);
    setBusy(false);

    if (error) {
      setErr(error);
      return;
    }

    const lower = parsed.data.email.toLowerCase();
    if (lower.includes("super")) {
      nav("/super/overview", { replace: true });
    } else if (kind === "admin" || lower.includes("principal") || lower.includes("admin")) {
      nav("/admin/dashboard", { replace: true });
    } else {
      nav("/teacher/dashboard", { replace: true });
    }
  }

  async function forgotPassword() {
    setErr(null);
    setNotice(null);
    if (!email) {
      setErr("Enter your email first, then tap Forgot password.");
      return;
    }
    if (devAuth) {
      setNotice("Password reset is disabled in dev preview mode.");
      return;
    }
    if (!supabase) {
      setErr("Supabase is not configured yet.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setErr(error.message);
    else setNotice("If that email has an account, a reset link is on its way.");
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <div className="flex-1 grid lg:grid-cols-2">
        <RedirectIfAuthed />

        {/* Left: The Login Form */}
        <div className="flex items-center justify-center bg-bg px-6 py-12 sm:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between">
              <Link to="/" aria-label="Back to home">
                <Logo size={32} />
              </Link>
              <div className="flex items-center gap-2">
                <span className="badge bg-surface text-muted border border-border text-xs">
                  {kind === "admin" ? "Admin Portal" : "Teacher Portal"}
                </span>
                {school && (
                  <span className="badge bg-accent-soft text-accent border border-accent/20 text-xs font-semibold">
                    {school.name}
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {school ? `Authorized access for ${school.name}` : subtitle}
            </p>

            {/* Dev Mock Notice with 1-click fill */}
            {!configured && !devAuth && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                Supabase backend credentials are not set. Configure <code>VITE_SUPABASE_URL</code> and{" "}
                <code>VITE_SUPABASE_ANON_KEY</code>.
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div>
                <label className="label" htmlFor="email">
                  Email Address <span className="text-accent">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input"
                  placeholder="name@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-fg" htmlFor="password">
                    Password <span className="text-accent">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={forgotPassword}
                    className="text-xs text-accent font-medium hover:underline focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    className="input pr-16"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-muted hover:text-accent focus:outline-none"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-muted select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Remember my email</span>
                </label>
              </div>

              {err && (
                <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                  {err}
                </div>
              )}

              {notice && (
                <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
                  {notice}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-3 text-sm font-semibold shadow-xs"
                disabled={busy || !canSignIn}
              >
                {busy ? <Spinner label="Signing in…" /> : "Sign In to Portal"}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-border flex items-center justify-between text-xs text-muted">
              <Link
                to={kind === "admin" ? "/teacher/login" : "/admin/login"}
                className="hover:text-accent font-medium transition-colors"
              >
                {kind === "admin" ? "Switch to Teacher Login →" : "Switch to Admin Login →"}
              </Link>
              <Link to="/" className="hover:text-accent transition-colors">
                Back to Home
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Editorial Branded Educational Visual Panel */}
        <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-14 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />

          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur border border-white/10">
              {school ? `${school.name} · CBSE Classes 1–5` : "KAIRO Institutional Platform"}
            </span>
          </div>

          <div className="relative z-10 max-w-lg">
            <div className="mb-6 overflow-hidden rounded-2xl bg-white/5 p-2 backdrop-blur border border-white/10 shadow-lg">
              <img
                src={kind === "admin" ? academicProgressImage : teacherWorkspaceImage}
                alt={kind === "admin" ? "Administrative leadership workspace" : "Teacher instructional workstation"}
                className="h-44 w-full object-cover rounded-xl"
                loading="eager"
              />
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
              Teach with Quality.<br />Learn with Intelligence.
            </h2>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed">
              Curriculum-grounded lesson preparation, textbook retrieval, and classroom assessments designed specifically for primary school teachers.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
              <div>
                <div className="text-2xl font-bold text-white">Classes 1–5</div>
                <div className="mt-1 text-xs text-slate-400">CBSE Curriculum</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">Postgres RLS</div>
                <div className="mt-1 text-xs text-slate-400">Tenant Isolation</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">Grounded AI</div>
                <div className="mt-1 text-xs text-slate-400">Textbook Citations</div>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs text-slate-400">
            {school ? `Subdomain: ${school.slug}.kairo.com` : "Platform Control Layer"}
          </div>
        </div>
      </div>
    </div>
  );
}

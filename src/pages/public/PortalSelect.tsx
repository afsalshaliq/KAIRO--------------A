import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";
import type { School } from "@/types/db";
import { academicProgressImage, teacherWorkspaceImage } from "@/assets/generated";

export default function PortalSelect() {
  const { school, isMainDomain, setDevSubdomain } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [availableSchools, setAvailableSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  useEffect(() => {
    async function fetchSchools() {
      if (!isMainDomain) return;
      setLoadingSchools(true);
      try {
        if (supabase) {
          const { data } = await supabase
            .from("schools")
            .select("id, name, slug, domain, is_active, primary_color, logo_url")
            .eq("is_active", true)
            .order("name");
          if (data && data.length > 0) {
            setAvailableSchools(data as School[]);
            return;
          }
        }
        // Fallback default schools in dev preview
        setAvailableSchools([
          {
            id: "00000000-0000-0000-0000-000000000001",
            name: "Royal School",
            slug: "royal",
            domain: "royal.kairo.com",
            is_active: true,
            logo_url: null,
            primary_color: "#4f46e5",
            secondary_color: "#06b6d4",
            settings: { ai_enabled: true, face_auth_enabled: true, teacher_admin_enabled: true },
            created_at: "",
            updated_at: "",
          },
          {
            id: "00000000-0000-0000-0000-000000000002",
            name: "Oxford School",
            slug: "oxford",
            domain: "oxford.kairo.com",
            is_active: true,
            logo_url: null,
            primary_color: "#0284c7",
            secondary_color: "#10b981",
            settings: { ai_enabled: true, face_auth_enabled: false, teacher_admin_enabled: true },
            created_at: "",
            updated_at: "",
          },
        ]);
      } catch {
        // ignore
      } finally {
        setLoadingSchools(false);
      }
    }
    fetchSchools();
  }, [isMainDomain]);

  const filteredSchools = availableSchools.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSchoolSelect = (selectedSchool: School) => {
    if (typeof window !== "undefined") {
      if (import.meta.env.PROD && window.location.hostname.includes("kairo.com")) {
        // In production, navigate to the authoritative school subdomain
        window.location.href = `https://${selectedSchool.slug}.kairo.com/login`;
      } else {
        // In local development, activate the school subdomain context
        setDevSubdomain(selectedSchool.slug);
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
      {/* Header section */}
      <div className="text-center max-w-xl mx-auto">
        <span className="chip mb-3 font-semibold text-accent bg-accent-soft border-accent/20">
          {school ? school.name : "KAIRO Unified Access"}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
          {school ? "Select Your Portal" : "Institutional School Resolution"}
        </h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          {school
            ? `Authorized sign-in for faculty and administrative staff at ${school.name}.`
            : "Connect directly to your verified institution portal or sign in as platform administrator."}
        </p>
      </div>

      {/* Main domain: School search and selector directory */}
      {isMainDomain && (
        <div className="mt-10 max-w-xl mx-auto card p-6 border-border bg-card shadow-card-elevated">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-fg flex items-center gap-2">
              <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.333A12.018 12.018 0 0012 9c-2.474 0-4.764.745-6.75 2.014V21h13.5z" />
              </svg>
              Find Your School Portal
            </h2>
            <span className="text-[11px] text-muted font-medium">Automatic Subdomain Routing</span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search school by name or slug (e.g., Royal, Oxford)..."
              className="input pl-9 text-xs sm:text-sm w-full"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>

          <div className="mt-3 divide-y divide-border rounded-lg border border-border max-h-56 overflow-y-auto bg-surface">
            {loadingSchools ? (
              <div className="p-4 text-center text-xs text-muted">Loading institution directory...</div>
            ) : filteredSchools.length > 0 ? (
              filteredSchools.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleSchoolSelect(s)}
                  className="p-3 flex items-center justify-between hover:bg-surface-elevated cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: s.primary_color || "#4f46e5" }}
                    />
                    <div>
                      <div className="text-xs font-semibold text-fg group-hover:text-accent transition-colors">
                        {s.name}
                      </div>
                      <div className="text-[10px] text-muted font-mono">
                        {s.slug}.kairo.com
                      </div>
                    </div>
                  </div>
                  <button className="text-xs font-semibold text-accent group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    <span>Enter Portal</span>
                    <span>→</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-muted">
                No active school found matching &ldquo;{searchTerm}&rdquo;. Please verify your institution subdomain.
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Schools registered on KAIRO are automatically assigned dedicated production subdomains.
          </p>
        </div>
      )}

      {/* Portal Cards (School Administrator and Teacher Workspace) */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {/* Administrator Card */}
        <Link
          to="/admin/login"
          className="card p-6 group hover:border-accent/50 hover:shadow-card-hover transition-all duration-200 border-border flex flex-col justify-between"
        >
          <div>
            <div className="mb-4 overflow-hidden rounded-xl border border-border bg-surface aspect-[16/9] shadow-xs">
              <img
                src={academicProgressImage}
                alt="Institutional administration and performance oversight"
                className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
              Leadership & Governance
            </span>
            <h2 className="text-xl font-bold text-fg group-hover:text-accent transition-colors">
              School Administrator
            </h2>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Manage teacher roster, class and section configurations, curriculum uploads, timetable schedules, and school audit logs.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-accent">
            <span>Proceed to Admin Sign-In</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>

        {/* Teacher Card */}
        <Link
          to="/teacher/login"
          className="card p-6 group hover:border-accent/50 hover:shadow-card-hover transition-all duration-200 border-border flex flex-col justify-between"
        >
          <div>
            <div className="mb-4 overflow-hidden rounded-xl border border-border bg-surface aspect-[16/9] shadow-xs">
              <img
                src={teacherWorkspaceImage}
                alt="Teacher workstation and instructional tools"
                className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
              Classroom & Learning
            </span>
            <h2 className="text-xl font-bold text-fg group-hover:text-accent transition-colors">
              Teacher Workspace
            </h2>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Access assigned curriculum materials, collaborate with the pedagogical AI assistant, and generate classroom worksheets, activities, and quizzes.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-accent">
            <span>Proceed to Teacher Sign-In</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>
      </div>

      {isMainDomain && (
        <div className="mt-10 text-center">
          <Link
            to="/admin/login"
            className="text-xs text-muted hover:text-accent transition-colors font-medium inline-flex items-center gap-1.5"
          >
            <span>Platform Super Administrator Login</span>
            <span>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}

import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "@/components/ui";
import { useTenant } from "@/lib/tenant";

export default function PublicLayout() {
  const { school, isMainDomain } = useTenant();

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">

      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" aria-label="KAIRO home" className="flex items-center gap-2 group">
            <Logo size={32} customLogo={school?.logo_url} />
            {school && (
              <span className="text-xs font-semibold text-muted border-l border-border pl-2.5 ml-1">
                {school.name}
              </span>
            )}
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3 text-sm">
            <NavLink
              to="/demo"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "bg-accent-soft text-accent font-semibold" : "text-muted hover:text-fg hover:bg-surface"
                }`
              }
            >
              Interactive Demo
            </NavLink>
            <NavLink
              to="/privacy"
              className={({ isActive }) =>
                `hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "bg-accent-soft text-accent font-semibold" : "text-muted hover:text-fg hover:bg-surface"
                }`
              }
            >
              Security & Privacy
            </NavLink>
            {isMainDomain && (
              <Link
                to="/admin/login"
                className="btn-outline hidden sm:inline-flex text-xs py-1.5 px-3 border-border"
              >
                Super Admin Login
              </Link>
            )}
            <Link to="/login" className="btn-primary text-xs py-1.5 px-4">
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface/60 mt-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span>
              © {new Date().getFullYear()} KAIRO Platform · {school ? school.name : "Multi-Tenant Educational Architecture"}
            </span>
          </div>

          <div className="flex items-center gap-5">
            <Link to="/demo" className="hover:text-fg transition-colors">
              Interactive Demo
            </Link>
            <Link to="/privacy" className="hover:text-fg transition-colors">
              Privacy & Data Isolation
            </Link>
            <Link to="/login" className="hover:text-fg transition-colors">
              Portal Sign-In
            </Link>
            <a href="mailto:security@kairo.com" className="hover:text-fg transition-colors">
              Contact Security
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

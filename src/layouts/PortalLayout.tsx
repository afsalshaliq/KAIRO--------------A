import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { Logo } from "@/components/ui";
import { NotificationCenter } from "@/components/NotificationCenter";

export interface NavItem {
  to: string;
  label: string;
  icon?: string;
}
export interface NavGroup {
  heading?: string;
  items: NavItem[];
}

function roleLabel(kind: "admin" | "teacher", role?: string | null) {
  if (role === "super_admin") return "Super Admin";
  if (role === "principal" || (kind === "admin" && role === "admin")) return "Principal";
  if (role === "teacher_admin") return "Teacher Admin";
  return "Teacher";
}

function initials(name?: string | null, email?: string | null) {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function PortalLayout({
  groups,
  kind,
}: {
  groups: NavGroup[];
  kind: "admin" | "teacher";
}) {
  const { profile, signOut } = useAuth();
  const { school } = useTenant();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menu) setMenu(false);
        if (open) setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menu, open]);

  async function handleSignOut() {
    await signOut();
    nav(kind === "admin" ? "/admin/login" : "/teacher/login", { replace: true });
  }

  const name = profile?.full_name || profile?.email || "Signed in";
  const label = roleLabel(kind, profile?.role);

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <div className="flex-1 lg:grid lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-border bg-card p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${
            open ? "translate-x-0 shadow-card-elevated" : "-translate-x-full"
          }`}
          aria-label={`${label} navigation`}
        >
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Logo size={28} customLogo={school?.logo_url} />
              <span className="badge bg-accent-soft text-accent border border-accent/20 text-[10px] font-bold">
                {label}
              </span>
            </div>
            {school && (
              <span className="text-[11px] font-semibold text-muted truncate block px-0.5" title={school.name}>
                {school.name}
              </span>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
            {groups.map((group, gi) => (
              <div key={group.heading ?? gi} className="flex flex-col gap-1">
                {group.heading && (
                  <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted/60">
                    {group.heading}
                  </p>
                )}
                {group.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-accent-soft text-accent font-semibold border-l-4 border-accent shadow-xs"
                          : "text-muted hover:bg-surface hover:text-fg"
                      }`
                    }
                  >
                    <span>{it.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-3 flex items-center gap-3 px-1">
              <Avatar name={profile?.full_name} email={profile?.email} />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-fg">{name}</p>
                <p className="truncate text-[10px] text-muted">{label}</p>
              </div>
            </div>
            <button
              className="btn-outline w-full text-xs py-1.5 border-border hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="flex min-h-screen flex-col">
          {/* Persistent top header */}
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur-md shadow-xs sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                className="btn-outline lg:hidden text-xs px-2.5 py-1.5 font-semibold text-fg"
                onClick={() => setOpen(true)}
                aria-label="Open navigation menu"
              >
                Menu
              </button>
              <span className="lg:hidden">
                <Logo size={22} customLogo={school?.logo_url} />
              </span>
              {school && (
                <span className="hidden sm:inline-block font-semibold text-xs text-muted">
                  {school.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <NotificationCenter />

              {/* User identity + avatar menu */}
              <div className="relative">
                <button
                  onClick={() => setMenu((m) => !m)}
                  className="flex items-center gap-2.5 rounded-full py-1 pl-3 pr-1 text-left transition-colors hover:bg-surface border border-transparent hover:border-border"
                  aria-expanded={menu}
                  aria-haspopup="true"
                >
                  <div className="hidden sm:block text-right">
                    <p className="text-xs font-bold text-fg leading-tight">{name}</p>
                    <p className="text-[10px] text-muted">{label}</p>
                  </div>
                  <Avatar name={profile?.full_name} email={profile?.email} />
                </button>

                {menu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenu(false)}
                      aria-hidden="true"
                    />
                    <div
                      className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-card-elevated animate-fade-in-up"
                      role="menu"
                    >
                      <div className="border-b border-border px-3 py-2.5">
                        <p className="truncate text-xs font-bold text-fg">{name}</p>
                        <p className="truncate text-[10px] text-muted">{profile?.email}</p>
                        <span className="mt-1 inline-block badge bg-accent-soft text-accent text-[10px]">
                          {label}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setMenu(false);
                          handleSignOut();
                        }}
                        className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                        role="menuitem"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, email }: { name?: string | null; email?: string | null }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-700 text-[11px] font-bold text-white shadow-xs">
      {initials(name, email)}
    </span>
  );
}

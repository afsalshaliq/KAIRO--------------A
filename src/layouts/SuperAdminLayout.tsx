import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { AdminTenantSwitcher } from "@/components/AdminTenantSwitcher";
import { NotificationCenter } from "@/components/NotificationCenter";

export default function SuperAdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/super/overview" className="flex items-center gap-2">
              <Logo />
              <span className="badge bg-indigo-50 text-indigo-700 font-bold text-xs uppercase tracking-wide">
                Global Console
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm pl-4 border-l border-border">
              <NavLink
                to="/super/overview"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg hover:bg-surface"
                  }`
                }
              >
                Overview
              </NavLink>
              <NavLink
                to="/super/schools"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg hover:bg-surface"
                  }`
                }
              >
                Schools Directory
              </NavLink>
              <NavLink
                to="/super/users"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg hover:bg-surface"
                  }`
                }
              >
                Global Users
              </NavLink>
              <NavLink
                to="/super/settings"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg hover:bg-surface"
                  }`
                }
              >
                Platform Settings
              </NavLink>
              <NavLink
                to="/super/audit"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg hover:bg-surface"
                  }`
                }
              >
                Global Audit Log
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <AdminTenantSwitcher />
            <NotificationCenter />
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-fg">{profile?.full_name}</span>
              <span className="text-[10px] text-accent uppercase font-bold tracking-wider">
                SUPER ADMIN
              </span>
            </div>
            <button onClick={handleSignOut} className="btn-outline text-xs px-2.5 py-1">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation bar */}
      <div className="md:hidden border-b border-border bg-white/95 px-3 py-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max text-xs font-semibold">
          <NavLink
            to="/super/overview"
            className={({ isActive }) =>
              `px-2.5 py-1 rounded-md transition ${
                isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"
              }`
            }
          >
            Overview
          </NavLink>
          <NavLink
            to="/super/schools"
            className={({ isActive }) =>
              `px-2.5 py-1 rounded-md transition ${
                isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"
              }`
            }
          >
            Schools
          </NavLink>
          <NavLink
            to="/super/users"
            className={({ isActive }) =>
              `px-2.5 py-1 rounded-md transition ${
                isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"
              }`
            }
          >
            Users
          </NavLink>
          <NavLink
            to="/super/settings"
            className={({ isActive }) =>
              `px-2.5 py-1 rounded-md transition ${
                isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"
              }`
            }
          >
            Settings
          </NavLink>
          <NavLink
            to="/super/audit"
            className={({ isActive }) =>
              `px-2.5 py-1 rounded-md transition ${
                isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"
              }`
            }
          >
            Audit
          </NavLink>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface py-4 text-center text-xs text-muted">
        Kairo Global Admin Console · Platform-wide Security & Multi-tenant Controller
      </footer>
    </div>
  );
}

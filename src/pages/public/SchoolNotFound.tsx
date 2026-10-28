import { Logo } from "@/components/ui";

interface SchoolNotFoundProps {
  subdomain: string;
  onReset?: () => void;
}

export default function SchoolNotFound({ subdomain, onReset }: SchoolNotFoundProps) {
  const isDev = !import.meta.env.PROD;

  const handleGoMain = () => {
    if (onReset) {
      onReset();
    }
    // Navigate to root platform domain or root path
    if (typeof window !== "undefined") {
      if (window.location.hostname.includes("kairo.com")) {
        window.location.href = "https://kairo.com";
      } else {
        window.location.href = "/login";
      }
    }
  };

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="mx-auto w-full max-w-5xl flex items-center justify-between py-4">
        <a href="/" onClick={(e) => { e.preventDefault(); handleGoMain(); }} className="flex items-center gap-2 group">
          <Logo size={32} />
          <span className="font-bold text-sm tracking-tight text-fg group-hover:text-accent transition-colors">
            KAIRO
          </span>
        </a>
        <span className="chip bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold">
          Tenant Resolution Error
        </span>
      </header>

      {/* Main Error Container */}
      <main className="mx-auto w-full max-w-lg my-auto py-12">
        <div className="card p-8 sm:p-10 text-center shadow-card-elevated border-border bg-card">
          {/* Status Badge & Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shadow-xs">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.75"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
            404 — School Tenant Not Found
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-fg tracking-tight">
            Unregistered School Domain
          </h1>

          <div className="mt-4 rounded-lg bg-surface p-3 border border-border text-xs font-mono text-fg/80 break-all">
            {subdomain}.kairo.com
          </div>

          <p className="mt-4 text-sm text-muted leading-relaxed">
            The school subdomain you requested does not correspond to an active institution record on the KAIRO platform.
          </p>

          <div className="mt-6 text-left rounded-lg bg-surface/50 p-4 border border-border text-xs space-y-2 text-muted">
            <div className="font-semibold text-fg flex items-center gap-1.5">
              <span>Possible reasons:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>The institution name or subdomain may have a typo.</li>
              <li>The school account may be suspended or awaiting super-admin provisioning.</li>
              <li>The DNS record was pointed before the school tenant was registered in Supabase.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={handleGoMain}
              className="btn-primary w-full justify-center py-2.5 text-sm font-semibold"
            >
              Go to KAIRO Main Platform & School Directory
            </button>
            <a
              href="mailto:support@kairo.com?subject=Tenant%20Domain%20Inquiry%20-%20"
              className="btn-outline w-full justify-center py-2.5 text-sm"
            >
              Contact Platform Administration
            </a>
          </div>

          {/* Dev context reset helper */}
          {isDev && (
            <div className="mt-6 pt-4 border-t border-border">
              <span className="text-[11px] text-muted block mb-2 font-mono">
                [Dev Preview Controls]
              </span>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => {
                    sessionStorage.setItem("kairo_dev_subdomain", "royal");
                    window.location.search = "";
                    window.location.reload();
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-elevated text-fg"
                >
                  Switch to Royal
                </button>
                <button
                  onClick={() => {
                    sessionStorage.setItem("kairo_dev_subdomain", "oxford");
                    window.location.search = "";
                    window.location.reload();
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-elevated text-fg"
                >
                  Switch to Oxford
                </button>
                <button
                  onClick={() => {
                    sessionStorage.removeItem("kairo_dev_subdomain");
                    window.location.search = "";
                    window.location.reload();
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-elevated text-fg"
                >
                  Reset to Main
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-5xl text-center py-4 text-xs text-muted">
        &copy; {new Date().getFullYear()} KAIRO Platform. Enterprise Multi-Tenant Architecture.
      </footer>
    </div>
  );
}

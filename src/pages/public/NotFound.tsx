import { Link } from "react-router-dom";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6 text-center text-fg">
      <div className="card max-w-md p-10 border border-border shadow-card-elevated">
        <div className="mb-6 flex justify-center">
          <Logo size={40} />
        </div>
        <p className="text-6xl font-extrabold text-accent tracking-tight">404</p>
        <h1 className="mt-4 text-xl font-bold text-fg">Page Not Found</h1>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          The requested page or route does not exist or may have been moved.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/" className="btn-primary text-xs py-2 px-4">
            Return to Home
          </Link>
          <Link to="/login" className="btn-outline text-xs py-2 px-4">
            Portal Selection
          </Link>
        </div>
      </div>
    </div>
  );
}

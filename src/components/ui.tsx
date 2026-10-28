import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ---- Logo -----------------------------------------------------------------
export function Logo({
  size = 32,
  customLogo,
  title,
  showText = true,
}: {
  size?: number;
  customLogo?: string | null;
  title?: string;
  showText?: boolean;
}) {
  const [masterLogo, setMasterLogo] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kairo_platform_master_logo");
    }
    return null;
  });

  useEffect(() => {
    const handler = () => {
      setMasterLogo(localStorage.getItem("kairo_platform_master_logo"));
    };
    window.addEventListener("kairo_logo_changed", handler);
    return () => window.removeEventListener("kairo_logo_changed", handler);
  }, []);

  const logoSrc = customLogo || masterLogo || "/logo.svg";
  const isDefaultKairo = logoSrc === "/logo.svg" && !customLogo;
  const displayTitle = title || "KAIRO";

  return (
    <span className="inline-flex items-center gap-2 font-extrabold tracking-tight text-fg select-none">
      <span
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-accent to-blue-700 text-white shadow-xs shrink-0"
      >
        <img
          src={logoSrc}
          width={Math.round(size * 0.7)}
          height={Math.round(size * 0.7)}
          alt={displayTitle}
          className={isDefaultKairo ? "brightness-0 invert object-contain" : "object-contain rounded"}
          onError={(e) => {
            if (e.currentTarget.src !== window.location.origin + "/logo.svg") {
              e.currentTarget.src = "/logo.svg";
              e.currentTarget.className = "brightness-0 invert object-contain";
            }
          }}
        />
      </span>
      {showText && (
        <span style={{ fontSize: Math.max(14, Math.round(size * 0.54)) }} className="font-extrabold tracking-tight text-fg truncate">
          {displayTitle}
        </span>
      )}
    </span>
  );
}

// ---- Spinner / skeleton ---------------------------------------------------
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2.5 text-muted text-sm font-medium">
      <svg
        className="h-4 w-4 animate-spin text-accent"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

// ---- Empty state ----------------------------------------------------------
export function EmptyState({
  title,
  hint,
  description,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: string;
  icon?: React.ReactNode;
}) {
  const text = hint ?? description;
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-8 text-center border-dashed">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent text-xl font-bold">
        {icon ?? "◇"}
      </div>
      <p className="font-bold text-fg text-base">{title}</p>
      {text && <p className="max-w-md text-sm text-muted leading-relaxed">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  const map: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    suspended: "bg-amber-50 text-amber-800 border-amber-200",
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    uploaded: "bg-blue-50 text-blue-700 border-blue-200",
    queued: "bg-indigo-50 text-indigo-700 border-indigo-200",
    deactivated: "bg-slate-100 text-slate-600 border-slate-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200",
    failed: "bg-rose-50 text-rose-700 border-rose-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={`badge border ${map[norm] ?? "chip"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

// ---- Search Bar -----------------------------------------------------------
export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-3.5 pr-16"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 text-muted hover:text-fg text-xs font-semibold px-2 py-1 rounded bg-surface border border-border transition"
          aria-label="Clear search"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ---- Toasts ---------------------------------------------------------------
type Toast = { id: number; kind: "success" | "error" | "info"; msg: string };
const ToastCtx = createContext<(kind: Toast["kind"], msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((kind: Toast["kind"], msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, msg }]);
    const timer = setTimeout(() => {
      removeToast(id);
    }, 4500);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach((t) => clearTimeout(t));
      currentTimers.clear();
    };
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto card px-4 py-3 text-sm shadow-card-hover border-l-4 flex items-center justify-between gap-3 animate-fade-in-up ${
              t.kind === "success"
                ? "border-l-emerald-500 bg-card text-fg"
                : t.kind === "error"
                ? "border-l-rose-500 bg-card text-fg"
                : "border-l-accent bg-card text-fg"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                t.kind === "success"
                  ? "bg-emerald-100 text-emerald-800"
                  : t.kind === "error"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-blue-100 text-blue-800"
              }`}>
                {t.kind === "success" ? "Success" : t.kind === "error" ? "Notice" : "Info"}
              </span>
              <span className="font-medium text-xs leading-relaxed">{t.msg}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-muted hover:text-fg text-xs px-1.5 py-0.5 rounded hover:bg-surface font-semibold"
              aria-label="Dismiss notification"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- Modal & Confirm Dialog -------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog"}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`card w-full ${maxWidth} p-6 bg-card border border-border shadow-card-elevated relative max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="btn-outline text-xs px-2.5 py-1 absolute top-4 right-4 font-semibold"
          aria-label="Close dialog"
        >
          Close
        </button>
        {title && <h3 className="text-lg font-bold text-fg mb-4 pr-6">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
      onClick={onCancel}
    >
      <div
        className="card w-full max-w-md p-6 bg-card shadow-card-elevated animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-bold text-fg">
          {title}
        </h3>
        {body && (
          <p id="confirm-dialog-body" className="mt-2 text-sm text-muted leading-relaxed">
            {body}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2.5">
          <button className="btn-outline text-xs" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button
            className={danger ? "btn-danger text-xs" : "btn-primary text-xs"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
  badge,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-muted/40">/</span>}
                {b.to ? (
                  <Link to={b.to} className="hover:text-fg transition-colors">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-fg font-medium">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1.5 text-sm text-muted leading-relaxed max-w-3xl">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2.5 shrink-0 self-center">{action}</div>}
    </div>
  );
}

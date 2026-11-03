import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Building blocks for the Academy dashboards (learner, tutor, admin), in the RoboCoders look:
 * paper panels on a wash canvas, an ink chip with an amber icon.
 */

export type Tone = "blue" | "emerald" | "amber" | "sky" | "rose";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className="ac-d-stat-top">
        <span>{label}</span>
        <i className="ac-d-chip" data-tone={tone === "rose" ? "rose" : undefined}><Icon size={18} aria-hidden="true" /></i>
      </div>
      <p className="ac-d-num">{value}</p>
      {hint && <p className="ac-d-hint">{hint}</p>}
    </>
  );
  return href ? <Link href={href} className="ac-d-stat">{body}</Link> : <div className="ac-d-stat">{body}</div>;
}

/** A titled paper panel. */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`ac-d-panel ${className}`}>
      {(title || action) && (
        <div className="ac-d-panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      <div className="ac-d-panel-body">{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ac-d-empty">
      <i className="ac-d-chip"><Icon size={22} aria-hidden="true" /></i>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action && <div style={{ marginTop: "0.5rem" }}>{action}</div>}
    </div>
  );
}

const STATUS: Record<string, string> = {
  CONFIRMED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CREATED: "bg-gray-50 text-gray-600 ring-gray-500/20",
  DRAFT: "bg-gray-50 text-gray-600 ring-gray-500/20",
  HIDDEN: "bg-gray-50 text-gray-600 ring-gray-500/20",
  CANCELLED: "bg-gray-50 text-gray-500 ring-gray-500/20",
  DISABLED: "bg-gray-50 text-gray-500 ring-gray-500/20",
  NO_SHOW: "bg-amber-50 text-amber-700 ring-amber-600/20",
  REFUNDED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  FREE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS[status] ?? STATUS.CREATED}`}>
      {label ?? status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

/** Dashboard page frame: padding, heading row and a max width. */
export function DashboardPage({
  title,
  subtitle,
  action,
  children,
  width,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Kept for callers that set a Tailwind max-width; the frame has its own. */
  width?: string;
}) {
  void width;
  return (
    <div className="ac-d-page">
      <div className="ac-d-head">
        <div style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="ac-d-actions">{action}</div>}
      </div>
      {children}
    </div>
  );
}

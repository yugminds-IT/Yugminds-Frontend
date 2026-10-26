import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Small building blocks for the Academy dashboards, styled after the LMS
 * dashboard cards (white card, slate border, coloured icon chip).
 */

const TONES = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-600",
} as const;
export type Tone = keyof typeof TONES;

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
    <Card className={`h-full gap-0 p-4 shadow-none sm:p-5 ${href ? "transition-all hover:border-gray-300 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="mt-1 font-acdisplay text-3xl font-semibold tabular-nums text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

/** A titled white panel, like the LMS dashboard sections. */
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
    <Card className={`gap-0 p-0 shadow-none ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          {title && <h2 className="font-semibold text-gray-900">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
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
    <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ac-soft text-ac-brand">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 font-semibold text-gray-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
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

/** Dashboard page frame: LMS-style padding, grey canvas and header row. */
export function DashboardPage({
  title,
  subtitle,
  action,
  children,
  width = "max-w-7xl",
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div className="min-h-full bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className={`mx-auto ${width}`}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-6">
          <div className="min-w-0">
            <h1 className="font-acdisplay text-2xl font-bold text-gray-900 md:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-gray-600 md:text-base">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap gap-2">{action}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

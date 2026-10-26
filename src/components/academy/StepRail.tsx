import Link from "next/link";
import { Check, Lock } from "lucide-react";

export type Step = {
  id: string;
  title: string;
  state: "done" | "current" | "todo" | "locked";
  meta?: string;
  href?: string;
  onClick?: () => void;
};

/**
 * Build-manual step list: numbered because lessons really are a sequence.
 * Blue = done, amber ring = where you are, white = still to build.
 */
export function StepRail({ steps, start = 1, compact = false }: { steps: Step[]; start?: number; compact?: boolean }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const n = start + i;
        const last = i === steps.length - 1;
        const marker =
          s.state === "done" ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ac-brand text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
          ) : s.state === "locked" ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400"><Lock className="h-3.5 w-3.5" /></span>
          ) : (
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full font-acdisplay text-sm font-semibold ${
                s.state === "current" ? "bg-white text-amber-700 ring-[3px] ring-amber-400" : "border border-slate-300 bg-white text-slate-500"
              }`}
            >
              {n}
            </span>
          );
        const label = (
          <span className="min-w-0 flex-1">
            <span className={`block ${compact ? "text-sm" : "text-[0.95rem]"} ${s.state === "current" ? "font-semibold text-ac-ink" : s.state === "locked" ? "text-slate-400" : "text-slate-700"}`}>
              {s.title}
            </span>
            {s.meta && <span className="block text-xs text-slate-500">{s.meta}</span>}
          </span>
        );
        const row = `relative z-10 flex w-full items-start gap-3 rounded-lg ${compact ? "py-1.5" : "py-2.5"} text-left`;
        return (
          <li key={s.id} className="relative">
            {!last && (
              <span
                aria-hidden
                className={`absolute left-[13px] top-9 w-0.5 ${compact ? "h-[calc(100%-1.5rem)]" : "h-[calc(100%-1.75rem)]"} ${s.state === "done" ? "bg-ac-brand" : "bg-slate-200"}`}
              />
            )}
            {s.href && s.state !== "locked" ? (
              <Link href={s.href} className={`${row} outline-none hover:[&>span:last-child>span:first-child]:text-ac-brand focus-visible:ring-2 focus-visible:ring-ac-brand/40`}>
                {marker}
                {label}
              </Link>
            ) : s.onClick && s.state !== "locked" ? (
              <button type="button" onClick={s.onClick} className={`${row} outline-none hover:[&>span:last-child>span:first-child]:text-ac-brand focus-visible:ring-2 focus-visible:ring-ac-brand/40`} aria-current={s.state === "current" ? "step" : undefined}>
                {marker}
                {label}
              </button>
            ) : (
              <div className={row} aria-current={s.state === "current" ? "step" : undefined}>
                {marker}
                {label}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

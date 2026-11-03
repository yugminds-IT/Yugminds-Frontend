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

/** The lesson list: numbered because lessons really are a sequence. Amber = done, ringed = where you are. */
export function StepRail({ steps, start = 1 }: { steps: Step[]; start?: number; compact?: boolean }) {
  return (
    <ol className="ac-d-steps">
      {steps.map((s, i) => {
        const inner = (
          <>
            <span className="ac-d-step-n" aria-hidden="true">
              {s.state === "done" ? <Check size={14} strokeWidth={3} /> : s.state === "locked" ? <Lock size={12} /> : start + i}
            </span>
            <span>
              <b>{s.title}</b>
              {s.meta && <small>{s.meta}</small>}
            </span>
          </>
        );
        const cur = s.state === "current" ? "step" : undefined;
        return (
          <li key={s.id}>
            {s.href && s.state !== "locked" ? (
              <Link href={s.href} className="ac-d-step" data-state={s.state} aria-current={cur}>{inner}</Link>
            ) : s.onClick && s.state !== "locked" ? (
              <button type="button" onClick={s.onClick} className="ac-d-step" data-state={s.state} aria-current={cur}>{inner}</button>
            ) : (
              <div className="ac-d-step" data-state={s.state} aria-current={cur}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

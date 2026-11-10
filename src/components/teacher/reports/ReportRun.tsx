import Link from "next/link";
import { Check } from "lucide-react";
import Droid from "../../portal/Droid";
import { clock, toMin } from "../overview/utils";

export type RunSlot = {
  id: string;
  title: string;
  /** "Grade 4 · Section A" */
  detail: string;
  start?: string;
  /** done = reported, redo = rejected and can be sent again, todo = not reported yet */
  state: "done" | "redo" | "todo";
};

/**
 * Today's classes as a track. A node fills amber once its report is in and turns red when a rejected report
 * needs sending again. Pressing a node picks that class for the form below; the droid waits at the picked one.
 */
export default function ReportRun({
  slots,
  selectedId,
  onSelect,
  caption,
}: {
  slots: RunSlot[];
  selectedId: string;
  onSelect: (id: string) => void;
  caption: string;
}) {
  if (slots.length === 0) {
    return (
      <div className="sd-run-card sr-run-empty">
        <b>No classes today</b>
        <Link href="/lms/teacher/classes" className="sd-btn sd-btn--amber">See my classes</Link>
      </div>
    );
  }

  const n = slots.length;
  const picked = slots.findIndex((s) => s.id === selectedId);
  const open = slots.findIndex((s) => s.state !== "done");
  const at = picked >= 0 ? picked : open >= 0 ? open : n - 1;
  const done = slots.filter((s) => s.state === "done").length;
  const lastDone = slots.reduce((acc, s, i) => (s.state === "done" ? i : acc), -1);

  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        {lastDone >= 0 && n > 1 && <div className="sd-run-fill" style={{ "--f": lastDone / (n - 1) } as React.CSSProperties} />}
        <ol className="sd-days" aria-label="Today's classes">
          {slots.map((s, i) => {
            const t = toMin(s.start);
            return (
              <li key={s.id} className="sd-day" data-active={s.state === "done"} data-today={s.id === selectedId} data-late={s.state === "redo"} data-future={s.state === "todo" && s.id !== selectedId}>
                <button
                  type="button"
                  className="to-node sr-node"
                  disabled={s.state === "done"}
                  aria-pressed={s.id === selectedId}
                  aria-label={`${s.title}${s.detail ? `, ${s.detail}` : ""}${Number.isFinite(t) ? `, ${clock(t)}` : ""}: ${s.state === "done" ? "already reported" : s.state === "redo" ? "rejected, report again" : "not reported yet"}`}
                  onClick={() => onSelect(s.id)}
                >
                  <span className="sd-node">{s.state === "done" ? <Check aria-hidden="true" /> : i + 1}</span>
                  <span>{Number.isFinite(t) ? clock(t).replace(/ [ap]m$/, "") : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{done}<small>of {n} reported</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}

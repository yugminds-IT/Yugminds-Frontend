import Link from "next/link";
import Droid from "../portal/Droid";

export interface DaySlot {
  /** period number, shown inside the node */
  n: number;
  /** start time, shown under the node */
  label: string;
  state: "past" | "now" | "next";
}

/**
 * Today's school day as a track of periods. The droid waits at the period that is on now,
 * or at the next one, or at the last one once the day is over.
 */
export default function SchoolDayRun({
  slots,
  classCount,
  caption,
  loading,
}: {
  slots: DaySlot[];
  classCount: number;
  caption: string;
  loading: boolean;
}) {
  if (!loading && slots.length === 0) {
    return (
      <div className="sd-run-card so-run-empty">
        <b>No periods set up yet</b>
        <span>Add your bell times and the school day will show up here.</span>
        <Link href="/lms/school-admin/schedules" className="sd-btn sd-btn--amber">Set up the timetable</Link>
      </div>
    );
  }

  const n = Math.max(1, slots.length);
  const nowIdx = slots.findIndex((s) => s.state === "now");
  const nextIdx = slots.findIndex((s) => s.state === "next");
  const at = nowIdx >= 0 ? nowIdx : nextIdx >= 0 ? nextIdx : n - 1;
  const lastDone = slots.reduce((acc, s, i) => (s.state === "past" ? i : acc), -1);

  return (
    <div className="sd-run-card">
      <div
        className="sd-run so-run"
        style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}
      >
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        {lastDone >= 0 && n > 1 && <div className="sd-run-fill" style={{ "--f": lastDone / (n - 1) } as React.CSSProperties} />}
        <ol className="sd-days" aria-label="Today's periods">
          {slots.map((s) => (
            <li key={s.n} className="sd-day" data-active={s.state === "past"} data-today={s.state === "now"} data-future={s.state === "next"}>
              <span className="sd-node">{s.n}</span>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{loading ? "–" : classCount}<small>{classCount === 1 ? "class today" : "classes today"}</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}

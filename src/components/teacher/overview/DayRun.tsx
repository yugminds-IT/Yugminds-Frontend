import Link from "next/link";
import { Check } from "lucide-react";
import Droid from "../../portal/Droid";
import { clock, type DayRow } from "./utils";

/**
 * Today's teaching day as a track: one node per class. A node fills amber once its report is in, turns red when
 * the class is over and nothing was submitted, and the droid waits at the class that is on now, or the next one.
 * Each node opens the report form for that class.
 */
export default function DayRun({
  rows,
  caption,
  loading,
  empty,
}: {
  rows: DayRow[];
  caption: string;
  loading: boolean;
  empty: { title: string; text: string };
}) {
  if (loading) {
    return <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>;
  }
  if (rows.length === 0) {
    return (
      <div className="sd-run-card to-run-empty">
        <b>{empty.title}</b>
        <Link href="/lms/teacher/classes" className="sd-btn sd-btn--amber">See my classes</Link>
      </div>
    );
  }

  const n = rows.length;
  const live = rows.findIndex((r) => r.phase === "live");
  const next = rows.findIndex((r) => r.phase === "upcoming");
  const missed = rows.findIndex((r) => r.phase === "past" && !r.reported);
  const at = live >= 0 ? live : next >= 0 ? next : missed >= 0 ? missed : n - 1;
  const lastDone = rows.reduce((acc, r, i) => (r.reported ? i : acc), -1);
  const reported = rows.filter((r) => r.reported).length;

  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        {lastDone >= 0 && n > 1 && <div className="sd-run-fill" style={{ "--f": lastDone / (n - 1) } as React.CSSProperties} />}
        <ol className="sd-days" aria-label="Today's classes">
          {rows.map((r, i) => (
            <li
              key={r.key}
              className="sd-day"
              data-active={r.reported}
              data-today={r.phase === "live"}
              data-future={!r.reported && r.phase === "upcoming"}
              data-late={!r.reported && r.phase === "past"}
            >
              <Link
                href={r.href}
                className="to-node"
                aria-label={`${r.subject}${r.label ? `, ${r.label}` : ""}, ${clock(r.from)}: ${r.reported ? "report submitted" : "report not submitted"}`}
              >
                <span className="sd-node">{r.reported ? <Check aria-hidden="true" /> : i + 1}</span>
                <span>{clock(r.from).replace(/ [ap]m$/, "")}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{reported}<small>of {n} reported</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}

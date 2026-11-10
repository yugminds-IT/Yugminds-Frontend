import Link from "next/link";
import { Check, FileText } from "lucide-react";
import { classLabel, clock, plural, toMin } from "../overview/utils";
import { dayStatus, STATUS_LABEL } from "./utils";

type Period = { period_id?: string; grade?: string; section?: string | null; subject?: string; start_time?: string; end_time?: string };
export type TodayStatus = {
  date?: string;
  attendance?: { status?: string | null; late_report?: boolean } | null;
  periodsWithReports?: number;
  totalPeriods?: number;
  submittedReports?: number;
  submittedPeriods?: Period[];
  pendingPeriods?: Period[];
  notScheduledToday?: boolean;
  before_cutoff?: boolean;
};

const byStart = (a: Period, b: Period) => String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""));
const when = (p: Period) => (Number.isFinite(toMin(p.start_time)) ? clock(toMin(p.start_time)) : "");

/** Today's attendance: how it is marked, and what is still needed to be marked present. */
export default function TodayPanel({ today }: { today: TodayStatus | undefined }) {
  const st = dayStatus(today?.attendance?.status);
  const total = today?.totalPeriods ?? 0;
  const done = today?.periodsWithReports ?? 0;
  const left = total - done;
  const dateLabel = today?.date ? new Date(`${today.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "";
  const off = today?.notScheduledToday || today?.attendance?.status === "Holiday" || today?.attendance?.status === "Not-Scheduled";
  const submitted = [...(today?.submittedPeriods ?? [])].sort(byStart);
  const pending = [...(today?.pendingPeriods ?? [])].sort(byStart);

  return (
    <section className="sd-panel" aria-labelledby="at-today">
      <div className="sd-panel-head">
        <div><h2 id="at-today">Today</h2><p>{dateLabel || " "}</p></div>
        {st && <span className="at-chip" data-s={st}>{STATUS_LABEL[st]}</span>}
        {!st && today?.attendance?.status && <span className="at-chip">{today.attendance.status}</span>}
      </div>

      {!today ? (
        <div className="sd-empty"><b>No data for today</b><p>Your attendance for today has not loaded yet.</p></div>
      ) : st === "leave" ? (
        <div className="sd-empty">
          <b>You are on approved leave</b>
          <p>Reports will not change this.</p>
          <Link href="/lms/teacher/leaves" className="sd-btn sd-btn--line">Leave requests</Link>
        </div>
      ) : off ? (
        <div className="sd-empty"><b>No school for you today</b><p>It is a holiday or outside your working days, so no reports are due.</p></div>
      ) : total === 0 ? (
        <div className="sd-empty">
          <b>No classes today</b>
          <p>{(today.submittedReports ?? 0) > 0 ? `You submitted ${plural(today.submittedReports ?? 0, "report")} today.` : "You have no periods scheduled, so nothing is due."}</p>
        </div>
      ) : (
        <>
          <div className="at-progress">
            <p><b>{done}</b> of {total} reports in{left > 0 ? `, ${left} to go` : ""}</p>
            <div className="sd-meter" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Reports submitted today"><i style={{ "--p": `${(done / total) * 100}%` } as React.CSSProperties} /></div>
          </div>
          <div>
            {pending.map((p, i) => (
              <Link key={p.period_id ?? `p${i}`} href={p.period_id ? `/lms/teacher/reports?period_id=${p.period_id}` : "/lms/teacher/reports"} className="so-row at-period">
                <span className="so-row-text"><b>{p.subject || "Class"}</b><small>{[classLabel(p.grade, p.section), when(p)].filter(Boolean).join(" · ")}</small></span>
                <span className="at-chip" data-s="unreported">Not reported</span>
              </Link>
            ))}
            {submitted.map((p, i) => (
              <div key={p.period_id ?? `s${i}`} className="so-row at-period">
                <span className="so-row-text"><b>{p.subject || "Class"}</b><small>{[classLabel(p.grade, p.section), when(p)].filter(Boolean).join(" · ")}</small></span>
                <span className="at-chip" data-s="present"><Check aria-hidden="true" />Reported</span>
              </div>
            ))}
          </div>
          {left <= 0 ? (
            <p className="at-note">{st === "present" ? "Every report is in and you are marked present." : "Every report is in. You will be marked present."}</p>
          ) : (
            <div className="at-note" data-warn="true">
              <p>
                {today.attendance?.late_report
                  ? "Your reports came in after 8 PM, so today stays absent."
                  : today.before_cutoff === false
                    ? "The 8 PM cutoff has passed, so today is marked absent. Reports are still saved."
                    : `Submit ${plural(left, "more report")} before 8 PM to be marked present.`}
              </p>
              {st === "rejected" && <p>Your leave was rejected, so reports decide today.</p>}
              <Link href="/lms/teacher/reports" className="sd-btn sd-btn--amber"><FileText aria-hidden="true" />Submit report</Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}

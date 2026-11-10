"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useTeacherSchool } from "../context";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useTeacherMonthlyAttendance, useTeacherReports, useTeacherReportsStats, useTeacherLeaves } from "@/hooks/useTeacherData";
import { ChipGroup } from "@/components/portal/notifications";
import OutcomeRun from "@/components/teacher/analytics/OutcomeRun";
import { ColumnChart, MiniSeg, SegmentBar, type Col, type Part } from "@/components/teacher/analytics/Charts";
import { lastMonths, monthName, rollUp, type MonthRow } from "@/components/teacher/attendance/utils";
import { daysBetween, statusOf } from "@/components/teacher/leaves/utils";
import type { Leave } from "@/components/teacher/leaves/utils";
import { plural } from "@/components/teacher/overview/utils";
import "@/components/school-admin/overview.css"; // hero meta, two-column grid
import "@/components/teacher/overview/overview.css"; // report track
import "@/components/teacher/analytics/analytics.css";

type Range = "6" | "12";

/** How you are doing: attendance over the months, how your reports were reviewed, and your leave. */
export default function AnalyticsPage() {
  const { selectedSchool } = useTeacherSchool();
  const queryClient = useQueryClient();
  const [now] = useState(() => new Date());
  const [range, setRange] = useState<Range>("12");

  const school = selectedSchool?.id;
  const monthlyQ = useTeacherMonthlyAttendance(school, 12);
  // The list backs the monthly chart and is capped at 500; the counts come from the server so they stay exact.
  const reportsQ = useTeacherReports(school, { limit: 500 });
  const statsQ = useTeacherReportsStats(school);
  const leavesQ = useTeacherLeaves(school);
  useSmartRefresh({
    customRefresh: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher", "monthly-attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher", "reports"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher", "reports-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher", "leaves"] }),
      ]);
    },
    minRefreshInterval: 60000,
  });

  const months = useMemo(() => rollUp(monthlyQ.data as MonthRow[] | undefined), [monthlyQ.data]);
  const keys = useMemo(() => lastMonths(now, Number(range)), [now, range]);
  const logged = keys.filter((k) => months.has(k));
  const lastLogged = logged[logged.length - 1];

  // Share of working days present across every logged month in view (weighted, so a short month counts less)
  const present = logged.reduce((n, k) => n + (months.get(k)?.present ?? 0), 0);
  const worked = logged.reduce((n, k) => n + (months.get(k)?.total ?? 0), 0);
  const attendancePct = worked > 0 ? Math.round((present / worked) * 100) : null;

  const attendanceCols: Col[] = keys.map((k) => {
    const m = months.get(k);
    return { key: k, label: monthName(k, false).replace(/ \d{4}$/, ""), full: monthName(k), value: m ? m.pct : null, text: m ? `${m.pct}% present (${m.present} of ${m.total} days)` : "no attendance logged", hot: k === lastLogged };
  });

  const stats = statsQ.data;
  const outcomes = { pending: stats?.pending ?? 0, reviewed: stats?.reviewed ?? 0, approved: stats?.approved ?? 0, rejected: stats?.rejected ?? 0 };
  const decided = outcomes.approved + outcomes.rejected;
  const approvalPct = decided > 0 ? Math.round((outcomes.approved / decided) * 100) : null;

  const perMonth = useMemo(() => {
    const m = new Map<string, number>();
    (reportsQ.data ?? []).forEach((r) => {
      const k = String(r.date ?? "").slice(0, 7);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [reportsQ.data]);
  const reportMax = Math.max(1, ...keys.map((k) => perMonth.get(k) ?? 0));
  const reportCols: Col[] = keys.map((k) => ({ key: k, label: monthName(k, false).replace(/ \d{4}$/, ""), full: monthName(k), value: perMonth.get(k) ?? 0, text: plural(perMonth.get(k) ?? 0, "report"), hot: k === keys[keys.length - 1] }));

  const leaves = (leavesQ.data ?? []) as Leave[];
  const leaveCount = (s: string) => leaves.filter((l) => statusOf(l) === s).length;
  const approvedLeaves = leaves.filter((l) => statusOf(l) === "approved");
  const approvedDays = approvedLeaves.reduce((n, l) => n + daysBetween(l.start_date, l.end_date), 0);

  const reportParts: Part[] = [
    { label: "Approved", value: outcomes.approved, tone: "ink" },
    { label: "Reviewed", value: outcomes.reviewed, tone: "blue" },
    { label: "Waiting for review", value: outcomes.pending, tone: "amber" },
    { label: "Rejected", value: outcomes.rejected, tone: "red" },
  ];
  const leaveParts: Part[] = [
    { label: "Approved", value: leaveCount("approved"), tone: "ink" },
    { label: "Waiting", value: leaveCount("pending"), tone: "amber" },
    { label: "Rejected", value: leaveCount("rejected"), tone: "red" },
    { label: "Cancelled", value: leaveCount("cancelled"), tone: "line" },
  ];
  const mixRows = logged.slice(-6).reverse();

  const failed = monthlyQ.isError || statsQ.isError;
  let status: React.ReactNode;
  if (failed) status = "Some numbers did not load. Try again.";
  else if (monthlyQ.isLoading || statsQ.isLoading) status = "Adding it up…";
  else if (approvalPct != null && attendancePct != null) status = <><strong>{approvalPct}% of your reviewed reports are approved.</strong> You were present {attendancePct}% of working days over {plural(logged.length, "month")}.</>;
  else if (approvalPct != null) status = <><strong>{approvalPct}% of your reviewed reports are approved.</strong> Attendance shows up once a month is logged.</>;
  else if (attendancePct != null) status = <><strong>You were present {attendancePct}% of working days</strong> over {plural(logged.length, "month")}. Reports appear here once your admin reviews them.</>;
  else status = "These numbers fill in as you report your classes.";

  const ledger = [
    { label: "Reports submitted", value: stats ? String(stats.total) : "–", hint: "All time" },
    { label: "Approval rate", value: approvalPct != null ? `${approvalPct}%` : "–", hint: decided > 0 ? `${outcomes.approved} of ${decided} reviewed reports` : "Nothing reviewed yet" },
    { label: "Attendance", value: attendancePct != null ? `${attendancePct}%` : "–", hint: logged.length ? `Over ${plural(logged.length, "logged month")}` : "No attendance logged yet" },
    { label: "Leave approved", value: String(approvedLeaves.length), hint: approvedLeaves.length ? `${plural(approvedDays, "day")} in all` : "None yet" },
  ];
  const loading = monthlyQ.isLoading || statsQ.isLoading;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ta-title">
        <div className="sd-hero-copy">
          <h1 id="ta-title" className="mc-hero-title">Analytics</h1>
          <p className="sd-where">{selectedSchool?.name ?? "All your schools"}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <Link href="/lms/teacher/assignments" className="sd-btn sd-btn--amber"><ClipboardList aria-hidden="true" />Assignments and retakes</Link>
          </div>
        </div>
        {statsQ.isLoading ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <OutcomeRun counts={outcomes} caption={approvalPct != null ? `${approvalPct}% of reviewed approved.` : "Nothing reviewed yet."} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Your numbers">
        {ledger.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {loading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className="sd-n">{failed ? "–" : m.value}</b>}
            <small>{m.hint}</small>
          </div>
        ))}
      </div>

      <div className="so-grid">
        <div className="so-col">
          <section className="sd-panel" aria-labelledby="ta-att">
            <div className="ta-head">
              <div><h2 id="ta-att">Attendance by month</h2><p>Share of working days you were present</p></div>
              <ChipGroup<Range> label="How far back" value={range} options={[["6", "6 months"], ["12", "12 months"]]} onChange={setRange} />
            </div>
            {monthlyQ.isLoading ? (
              <div className="sd-skel" style={{ height: "11rem" }} />
            ) : monthlyQ.isError ? (
              <div className="sd-empty"><b>Could not load attendance</b><p>Check your connection and try again.</p><button className="sd-btn sd-btn--ink" onClick={() => void monthlyQ.refetch()}>Try again</button></div>
            ) : logged.length === 0 ? (
              <div className="sd-empty"><b>No attendance logged yet</b><p>A month appears here once you have reported your classes in it.</p></div>
            ) : (
              <ColumnChart cols={attendanceCols} label="Attendance percentage by month" />
            )}
          </section>

          <section className="sd-panel" aria-labelledby="ta-mix">
            <div className="ta-head"><div><h2 id="ta-mix">Where your days went</h2><p>The last {Math.min(6, mixRows.length) || 6} logged months, newest first</p></div></div>
            {monthlyQ.isLoading ? (
              <div className="sd-skel" style={{ height: "8rem" }} />
            ) : mixRows.length === 0 ? (
              <p className="ta-empty">Nothing logged yet.</p>
            ) : (
              <>
                <ul className="ta-mix">
                  {mixRows.map((k) => {
                    const m = months.get(k)!;
                    return (
                      <li key={k}>
                        <span>{monthName(k, false).replace(/ \d{4}$/, "")}</span>
                        <MiniSeg parts={[
                          { label: "Present", value: m.present, tone: "ink" },
                          { label: "Leave", value: m.leave, tone: "amber" },
                          { label: "Absent", value: m.absent, tone: "red" },
                          { label: "Not reported", value: m.unreported, tone: "line" },
                        ]} />
                        <small>{m.present} of {m.total}</small>
                      </li>
                    );
                  })}
                </ul>
                <p className="ta-key">
                  <span><i data-t="ink" />Present</span><span><i data-t="amber" />Leave</span><span><i data-t="red" />Absent</span><span><i data-t="line" />Not reported</span>
                </p>
              </>
            )}
          </section>
        </div>

        <div className="so-col">
          <section className="sd-panel" aria-labelledby="ta-out">
            <div className="ta-head"><div><h2 id="ta-out">How your reports were reviewed</h2><p>Every report you have submitted</p></div></div>
            {statsQ.isLoading ? <div className="sd-skel" style={{ height: "8rem" }} /> : <SegmentBar parts={reportParts} empty="No reports yet. Submit one after a class and its review shows here." />}
          </section>

          <section className="sd-panel" aria-labelledby="ta-rep">
            <div className="ta-head"><div><h2 id="ta-rep">Reports each month</h2><p>How many you submitted</p></div></div>
            {reportsQ.isLoading ? (
              <div className="sd-skel" style={{ height: "11rem" }} />
            ) : (reportsQ.data ?? []).length === 0 ? (
              <p className="ta-empty">No reports yet.</p>
            ) : (
              <ColumnChart cols={reportCols} max={reportMax} label="Reports submitted by month" />
            )}
          </section>

          <section className="sd-panel" aria-labelledby="ta-leave">
            <div className="ta-head"><div><h2 id="ta-leave">Your leave requests</h2><p><Link href="/lms/teacher/leaves" className="sd-link">See all requests</Link></p></div></div>
            {leavesQ.isLoading ? <div className="sd-skel" style={{ height: "6rem" }} /> : <SegmentBar parts={leaveParts} empty="You have not asked for leave yet." />}
          </section>
        </div>
      </div>
    </div>
  );
}

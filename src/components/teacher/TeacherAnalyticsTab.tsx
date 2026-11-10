"use client";

import { useState } from "react";
import Link from "next/link";
import { useTeacherMonthlyAttendance, useTeacherReportsStats } from "../../hooks/useTeacherData";
import { ColumnChart, SegmentBar, type Col } from "./analytics/Charts";
import { lastMonths, monthName, rollUp, type MonthRow } from "./attendance/utils";
import "@/components/teacher/analytics/analytics.css";

interface TeacherAnalyticsTabProps {
  selectedSchoolId?: string;
}

/** The dashboard's Analytics tab: attendance over six months and how your reports were reviewed. */
export default function TeacherAnalyticsTab({ selectedSchoolId }: TeacherAnalyticsTabProps) {
  const monthlyQ = useTeacherMonthlyAttendance(selectedSchoolId, 6);
  const statsQ = useTeacherReportsStats(selectedSchoolId);
  const [now] = useState(() => new Date());
  const months = rollUp(monthlyQ.data as MonthRow[] | undefined);
  const keys = lastMonths(now, 6);
  const last = [...keys].reverse().find((k) => months.has(k));
  const cols: Col[] = keys.map((k) => {
    const m = months.get(k);
    return { key: k, label: monthName(k, false).replace(/ \d{4}$/, ""), full: monthName(k), value: m ? m.pct : null, text: m ? `${m.pct}% present` : "no attendance logged", hot: k === last };
  });
  const s = statsQ.data;

  return (
    <div className="so-grid">
      <section className="sd-panel" aria-labelledby="tt-att">
        <div className="ta-head">
          <div><h2 id="tt-att">Attendance by month</h2><p>Share of working days you were present</p></div>
          <Link href="/lms/teacher/analytics" className="sd-link">Full analytics</Link>
        </div>
        {monthlyQ.isLoading ? (
          <div className="sd-skel" style={{ height: "11rem" }} />
        ) : monthlyQ.isError ? (
          <div className="sd-empty"><b>Could not load attendance</b><p>Check your connection and try again.</p><button className="sd-btn sd-btn--ink" onClick={() => void monthlyQ.refetch()}>Try again</button></div>
        ) : !last ? (
          <div className="sd-empty"><b>No attendance logged yet</b><p>A month appears here once you have reported your classes in it.</p></div>
        ) : (
          <ColumnChart cols={cols} label="Attendance percentage by month" />
        )}
      </section>

      <section className="sd-panel" aria-labelledby="tt-out">
        <div className="ta-head"><div><h2 id="tt-out">How your reports were reviewed</h2><p>Every report you have submitted</p></div></div>
        {statsQ.isLoading ? (
          <div className="sd-skel" style={{ height: "8rem" }} />
        ) : (
          <SegmentBar
            parts={[
              { label: "Approved", value: s?.approved ?? 0, tone: "ink" },
              { label: "Reviewed", value: s?.reviewed ?? 0, tone: "blue" },
              { label: "Waiting for review", value: s?.pending ?? 0, tone: "amber" },
              { label: "Rejected", value: s?.rejected ?? 0, tone: "red" },
            ]}
            empty="No reports yet. Submit one after a class and its review shows here."
          />
        )}
      </section>
    </div>
  );
}

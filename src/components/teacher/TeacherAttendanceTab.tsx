"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTeacherSchool } from "../../app/lms/teacher/context";
import { useTodayAttendanceStatus, useTeacherMonthlyAttendance } from "../../hooks/useTeacherData";
import TodayPanel, { type TodayStatus } from "./attendance/TodayPanel";
import { lastMonths, monthName, rollUp, type MonthRow } from "./attendance/utils";
import "@/components/teacher/attendance/attendance.css";

/** The dashboard's Attendance tab: today, and the last six months at a glance. */
export default function TeacherAttendanceTab() {
  const { selectedSchool } = useTeacherSchool();
  const todayQ = useTodayAttendanceStatus(selectedSchool?.id);
  const monthlyQ = useTeacherMonthlyAttendance(selectedSchool?.id, 6);
  const [now] = useState(() => new Date());
  const months = useMemo(() => rollUp(monthlyQ.data as MonthRow[] | undefined), [monthlyQ.data]);
  const keys = lastMonths(now, 6);

  return (
    <div className="so-grid">
      {todayQ.isLoading ? (
        <section className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /></section>
      ) : (
        <TodayPanel today={todayQ.data as TodayStatus | undefined} />
      )}

      <section className="sd-panel" aria-labelledby="ta-months">
        <div className="sd-panel-head">
          <div><h2 id="ta-months">Last six months</h2><p>Share of working days you were present</p></div>
          <Link href="/lms/teacher/attendance" className="sd-link">Full details</Link>
        </div>
        {monthlyQ.isLoading ? (
          <><div className="sd-skel" /><div className="sd-skel" /></>
        ) : monthlyQ.isError ? (
          <div className="sd-empty">
            <b>Could not load your months</b>
            <p>Check your connection and try again.</p>
            <button className="sd-btn sd-btn--ink" onClick={() => void monthlyQ.refetch()}>Try again</button>
          </div>
        ) : months.size === 0 ? (
          <div className="sd-empty"><b>No attendance yet</b><p>Months appear here once you start reporting your classes.</p></div>
        ) : (
          <ul className="at-bars">
            {[...keys].reverse().map((k) => {
              const m = months.get(k);
              return (
                <li key={k} className="at-bar">
                  <span>{monthName(k, false)}</span>
                  <div className="sd-meter" data-low={!!m && m.pct < 75}><i style={{ "--p": `${m?.pct ?? 0}%` } as React.CSSProperties} /></div>
                  <b>{m ? `${m.pct}%` : "–"}</b>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Pager, initialsOf } from "../../portal/notifications";
import { type TeacherPerformance } from "./types";

const PAGE_SIZE = 20;
export const levelOf = (rate: number) => (rate >= 90 ? "great" : rate >= 70 ? "good" : "low");
const LEVEL_LABEL = { great: "Excellent", good: "Good", low: "Needs attention" } as const;
const day = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); };

/** One row per teacher in the current view, the least consistent first. */
export default function PerformanceTab({ rows, loading }: { rows: TeacherPerformance[]; loading: boolean }) {
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => [...rows].sort((a, b) => a.attendance_rate - b.attendance_rate || a.teacher_name.localeCompare(b.teacher_name)), [rows]);
  const lastPage = Math.max(0, Math.ceil(sorted.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const visible = sorted.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);

  if (loading && rows.length === 0) return <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>;
  if (rows.length === 0) {
    return (
      <section className="sd-panel">
        <div className="sd-empty"><b>No teachers to compare yet</b><p>Teachers appear here once they have sent a report that matches your filters.</p></div>
      </section>
    );
  }
  return (
    <section className="sd-panel as-list mc-swap" aria-label="Teacher performance">
      <p className="ar-cap">Reporting rate is the share of the last 20 weekdays (Monday to Friday) with a report. It shows how consistent a teacher is, not their attendance record.</p>
      <div className="ar-phead">
        <span>Teacher</span><span>Reports</span><span>Hours</span><span>Reporting rate</span><span>Last report</span>
      </div>
      {visible.map((t) => {
        const lvl = levelOf(t.attendance_rate);
        return (
          <div key={t.teacher_id} className="ar-prow" data-level={lvl}>
            <span className="ar-person">
              <span className="sd-avatar" aria-hidden="true">{initialsOf(t.teacher_name)}</span>
              <span><b>{t.teacher_name}</b><small>{t.school_name}</small></span>
            </span>
            <span className="ar-num"><b>{t.total_reports}</b><small>{t.avg_students} students each</small></span>
            <span className="ar-num"><b>{t.total_hours}</b><small>{t.total_hours === 1 ? "hour" : "hours"}</small></span>
            <span className="ar-rate">
              <b>{Math.round(t.attendance_rate)}%</b>
              <span className="sd-meter" role="img" aria-label={`${Math.round(t.attendance_rate)} percent, ${LEVEL_LABEL[lvl]}`}><i style={{ "--p": `${Math.max(3, t.attendance_rate)}%` } as React.CSSProperties} /></span>
              <small>{LEVEL_LABEL[lvl]}</small>
            </span>
            <span className="ar-num"><small>{day(t.last_report_date)}</small></span>
          </div>
        );
      })}
      <Pager offset={at * PAGE_SIZE} count={visible.length} total={sorted.length} pageSize={PAGE_SIZE} noun="teachers" onPrev={() => setPage(Math.max(0, at - 1))} onNext={() => setPage(at + 1)} />
    </section>
  );
}

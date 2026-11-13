"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ClockAlert, RefreshCw, Search } from "lucide-react";
import ConfirmModal from "../../portal/ConfirmModal";
import { Pager, initialsOf } from "../../portal/notifications";
import { MiniSeg } from "../../teacher/analytics/Charts";
import { formatWorkingSchedule, type DaySlotMap } from "@/lib/weekday-utils";
import { band, plural } from "./utils";
import "../../teacher/analytics/analytics.css"; // segmented bar

export interface MonthlyRow {
  id?: string;
  teacher_id?: string;
  teacherId?: string;
  month?: string;
  present_days?: number;
  absent_days?: number;
  leave_days?: number;
  unreported_days?: number;
  late_report_days?: number;
  total_working_days?: number;
  total_days?: number;
  attendance_percentage?: number;
  profiles?: { full_name?: string; email?: string };
  schools?: { name?: string };
  by_school?: Array<{
    school_id: string;
    school_name: string;
    working_days?: number[];
    day_slots?: DaySlotMap | null;
    present_days: number;
    absent_days: number;
    leave_days: number;
    unreported_days: number;
    late_report_days?: number;
    total_working_days: number;
    attendance_percentage: number;
  }>;
}

const PAGE_SIZE = 20;
const days = (m: MonthlyRow) => m.total_working_days ?? m.total_days ?? 0;
const pctOf = (m: MonthlyRow) =>
  typeof m.attendance_percentage === "number" ? m.attendance_percentage : days(m) ? Math.round(((m.present_days ?? 0) / days(m)) * 100) : 0;
const nameOf = (m: MonthlyRow) => m.profiles?.full_name || "Unknown teacher";
const keyOf = (m: MonthlyRow, i: number) => m.id ?? `${m.teacher_id ?? m.teacherId ?? i}-${m.month ?? i}`;
const parts = (p: number, a: number, l: number, u: number) => [
  { label: "Present", value: p, tone: "ink" as const },
  { label: "Absent", value: a, tone: "red" as const },
  { label: "Leave", value: l, tone: "blue" as const },
  { label: "Unreported", value: u, tone: "amber" as const },
];

/** The month at a glance, one row per teacher with the weakest first, and the 8 PM rule written where it applies. */
export default function AttendanceTab({
  rows,
  loading,
  month,
  onMonth,
  schoolFilter,
  onSchoolFilter,
  schoolOptions,
  onRefresh,
  onMarkMissing,
  marking,
}: {
  rows: MonthlyRow[];
  loading: boolean;
  month: string;
  onMonth: (m: string) => void;
  schoolFilter: string;
  onSchoolFilter: (id: string) => void;
  schoolOptions: { id: string; name: string }[];
  onRefresh: () => void;
  onMarkMissing: () => Promise<void> | void;
  marking: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"low" | "name">("low");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const monthName = useMemo(() => {
    const d = new Date(`${month}-01T00:00:00`);
    return Number.isNaN(d.getTime()) ? month : d.toLocaleString("en-IN", { month: "long", year: "numeric" });
  }, [month]);

  const total = (f: (m: MonthlyRow) => number) => rows.reduce((n, m) => n + f(m), 0);
  const present = total((m) => m.present_days ?? 0);
  const absent = total((m) => m.absent_days ?? 0);
  const late = total((m) => m.late_report_days ?? 0);
  const unreported = total((m) => m.unreported_days ?? 0);
  const average = rows.length ? Math.round((rows.reduce((n, m) => n + pctOf(m), 0) / rows.length) * 10) / 10 : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.map((m, i) => ({ m, k: keyOf(m, i) })).filter(({ m }) => !q || `${nameOf(m)} ${m.profiles?.email ?? ""}`.toLowerCase().includes(q));
    return list.sort((a, b) => (sort === "low" ? pctOf(a.m) - pctOf(b.m) || nameOf(a.m).localeCompare(nameOf(b.m)) : nameOf(a.m).localeCompare(nameOf(b.m))));
  }, [rows, search, sort]);
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const visible = filtered.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);
  const toggle = (k: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k); return next; });

  return (
    <>
      <div className="at-bar">
        <label className="at-field"><span>Month</span><input type="month" className="sd-field" value={month} onChange={(e) => { if (e.target.value) { onMonth(e.target.value); setPage(0); } }} /></label>
        <label className="at-field">
          <span>School</span>
          <select className="sd-field" value={schoolFilter} onChange={(e) => { onSchoolFilter(e.target.value); setPage(0); }} title="Count working days at one school, or combine every school a teacher works at">
            <option value="all">All schools combined</option>
            {schoolOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <button className="sd-btn sd-btn--line" onClick={onRefresh} disabled={loading} aria-label="Refresh attendance"><RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" /></button>
        <button className="sd-btn sd-btn--line" onClick={() => setConfirming(true)} disabled={marking || loading}>
          {marking ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <ClockAlert aria-hidden="true" />}Mark missing attendance
        </button>
      </div>

      <div className="sd-ledger" role="group" aria-label={`Attendance totals for ${monthName}`}>
        <div><span className="sd-l">Average attendance</span><b className="sd-n">{average == null ? "–" : `${average}%`}</b><small>{plural(rows.length, "teacher")} in {monthName}</small></div>
        <div><span className="sd-l">Present days</span><b className="sd-n">{present.toLocaleString("en-IN")}</b><small>All reports in by 8 PM</small></div>
        <div data-hot={absent > 0 ? "true" : undefined} className={absent > 0 ? "at-hot" : undefined}><span className="sd-l">Absent days</span><b className="sd-n">{absent.toLocaleString("en-IN")}</b><small>{late > 0 ? `${plural(late, "late report")} among them` : "No report by 8 PM"}</small></div>
        <div><span className="sd-l">Unreported days</span><b className="sd-n">{unreported.toLocaleString("en-IN")}</b><small>Still open until 8 PM</small></div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : rows.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No attendance for {monthName}</b>
            <p>Pick another month or school. Attendance appears once teachers submit their reports.</p>
          </div>
        </section>
      ) : (
        <section className="sd-panel at-list mc-swap" aria-label={`Monthly attendance, ${monthName}`}>
          <div className="at-month-head">
            <div className="sd-search" style={{ width: "min(100%, 20rem)" }}>
              <Search aria-hidden="true" />
              <input type="search" placeholder="Search by teacher" aria-label="Search teachers" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <select className="sd-field at-sort" aria-label="Sort teachers" value={sort} onChange={(e) => { setSort(e.target.value as "low" | "name"); setPage(0); }}>
              <option value="low">Lowest attendance first</option>
              <option value="name">Name, A to Z</option>
            </select>
          </div>
          <p className="at-rule"><span>A teacher is present only if every report for the day is in before 8:00 PM IST. A working day with no report by then counts as absent, and today shows as unreported until 8 PM. Leave counts once it is fully approved.</span></p>
          {filtered.length === 0 && <div className="sd-empty" style={{ padding: "1rem 1.25rem" }}><b>No teachers match</b><p>Try a different search.</p></div>}
          {visible.map(({ m, k }) => {
            const p = pctOf(m);
            const multi = (m.by_school?.length ?? 0) > 0;
            const isOpen = open.has(k);
            const name = nameOf(m);
            return (
              <div key={k} className="at-mrow">
                <div className="at-mmain">
                  <span className="sd-avatar" aria-hidden="true">{initialsOf(name)}</span>
                  <span className="at-who at-who--static"><b>{name}</b><small>{m.profiles?.email || ""}</small></span>
                  <span className="at-mschool">
                    {multi ? (
                      <button type="button" className="at-expand" aria-expanded={isOpen} onClick={() => toggle(k)}>
                        {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}{m.by_school!.length} schools
                      </button>
                    ) : <small>{m.schools?.name || ""}</small>}
                  </span>
                  <span className="at-mbar">
                    <MiniSeg parts={parts(m.present_days ?? 0, m.absent_days ?? 0, m.leave_days ?? 0, m.unreported_days ?? 0)} />
                    <small>
                      {m.present_days ?? 0} present · {m.absent_days ?? 0} absent · {m.leave_days ?? 0} leave · {m.unreported_days ?? 0} unreported
                      {(m.late_report_days ?? 0) > 0 ? ` · ${plural(m.late_report_days ?? 0, "late report")}` : ""}
                    </small>
                  </span>
                  <span className="at-pct" data-b={band(p)} title={`${days(m)} working days`}>{p.toFixed(1)}%</span>
                </div>
                {multi && isOpen && (
                  <div className="at-sub">
                    {m.by_school!.map((s) => (
                      <div key={s.school_id} className="at-subrow">
                        <span className="at-who at-who--static"><b>{s.school_name}</b><small>{formatWorkingSchedule(s.working_days, s.day_slots)}</small></span>
                        <span className="at-mbar">
                          <MiniSeg parts={parts(s.present_days, s.absent_days, s.leave_days, s.unreported_days)} />
                          <small>{s.present_days} present · {s.absent_days} absent · {s.leave_days} leave · {s.unreported_days} unreported · {plural(s.total_working_days, "working day")}</small>
                        </span>
                        <span className="at-pct" data-b={band(s.attendance_percentage)}>{s.attendance_percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Pager offset={at * PAGE_SIZE} count={visible.length} total={filtered.length} pageSize={PAGE_SIZE} noun="teachers" onPrev={() => setPage(Math.max(0, at - 1))} onNext={() => setPage(at + 1)} />
        </section>
      )}

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        busy={marking}
        title={`Mark missing attendance for ${monthName}?`}
        confirmLabel="Mark missing"
        onConfirm={async () => { await onMarkMissing(); setConfirming(false); }}
      >
        <p>Teachers who had scheduled periods but sent no report get an absent mark for those days. This changes the attendance records for the whole month.</p>
      </ConfirmModal>
    </>
  );
}

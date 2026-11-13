"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarOff, FileText, RefreshCw } from "lucide-react";
import { useTeacherSchool } from "../context";
import { useTeacherAttendance, useTeacherMonthlyAttendance, useTodayAttendanceStatus } from "@/hooks/useTeacherData";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import AttendanceRun from "@/components/teacher/attendance/AttendanceRun";
import MonthGrid from "@/components/teacher/attendance/MonthGrid";
import TodayPanel, { type TodayStatus } from "@/components/teacher/attendance/TodayPanel";
import { dayStatus, lastMonths, monthName, rollUp, STATUS_LABEL, type DayRecord, type Month, type MonthRow } from "@/components/teacher/attendance/utils";
import { plural } from "@/components/teacher/overview/utils";
import "@/components/school-admin/overview.css"; // hero meta, rows, two-column grid
import "@/components/teacher/overview/overview.css"; // day track
import "@/components/teacher/attendance/attendance.css";

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Attendance. There is no "mark attendance" button: a day is marked present when every scheduled class has a
 * report before 8 PM IST, absent after that, and approved leave stays as leave.
 */
export default function AttendancePage() {
  const { selectedSchool, schools } = useTeacherSchool();
  const queryClient = useQueryClient();
  const [now] = useState(() => new Date());
  const keys = useMemo(() => lastMonths(now, 6), [now]);
  const [ym, setYm] = useState(keys[keys.length - 1]);

  const school = selectedSchool?.id;
  // School attendance (selected school) vs overall attendance (all schools); only the Monthly tab shows overall.
  const monthlyQ = useTeacherMonthlyAttendance(school, 12);
  const overallQ = useTeacherMonthlyAttendance(undefined, 12);
  const [tab, setTab] = useState<"overview" | "monthly">("overview");
  const dailyQ = useTeacherAttendance(school, ym);
  const todayQ = useTodayAttendanceStatus(school);

  // School figures (hero, ledger) follow the switcher; the Monthly tab is the overall total across every school.
  const months = useMemo(() => rollUp(overallQ.data as MonthRow[] | undefined), [overallQ.data]);
  const schoolMonths = useMemo(() => rollUp(monthlyQ.data as MonthRow[] | undefined), [monthlyQ.data]);
  const cur = schoolMonths.get(ym);
  const allKeys = useMemo(() => lastMonths(now, 12).reverse(), [now]);
  const bySchool = useMemo(() => {
    const m = new Map<string, Array<[string, Month]>>();
    for (const r of (overallQ.data as MonthRow[] | undefined) ?? []) {
      const key = String(r.month ?? "").slice(0, 7);
      m.set(key, (r.by_school ?? []).flatMap((b) => { const x = rollUp([b]).get(key); return b.school_id && x ? [[b.school_id, x] as [string, Month]] : []; }));
    }
    return m;
  }, [overallQ.data]);
  const records = useMemo(
    () => ((dailyQ.data ?? []) as DayRecord[]).filter((r) => r.date?.startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date)),
    [dailyQ.data, ym],
  );
  const today = todayQ.data as TodayStatus | undefined;
  const todayKey = today?.date ?? localKey(now);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["teacher", "monthly-attendance"] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "attendance"] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "today-attendance"] }),
    ]);
  };
  useSmartRefresh({ customRefresh: refresh, minRefreshInterval: 60000 });
  const refreshing = monthlyQ.isFetching || overallQ.isFetching || dailyQ.isFetching || todayQ.isFetching;

  /* ───────── what the hero says about today ───────── */
  const st = dayStatus(today?.attendance?.status);
  const total = today?.totalPeriods ?? 0;
  const left = total - (today?.periodsWithReports ?? 0);
  const off = !!today && (today.notScheduledToday || today.attendance?.status === "Holiday" || today.attendance?.status === "Not-Scheduled");
  const failed = monthlyQ.isError || overallQ.isError || todayQ.isError;

  let status: React.ReactNode;
  if (failed) status = "Your attendance did not load. Try again.";
  else if (todayQ.isLoading || !today) status = "Checking today…";
  else if (st === "leave") status = <><strong>You are on approved leave today.</strong> Reports will not change that.</>;
  else if (off) status = "No school for you today, so no reports are due.";
  else if (st === "present") status = <><strong>You are marked present today.</strong> Every report is in.</>;
  else if (total === 0) status = "You have no classes today, so nothing is due.";
  else if (today.attendance?.late_report) status = <><strong>Marked absent today.</strong> Your reports came in after 8 PM.</>;
  else if (st === "absent") status = <><strong>Marked absent today.</strong> The 8 PM cutoff has passed.</>;
  else status = <><strong>{plural(left, "report")}</strong> still decide{left === 1 ? "s" : ""} today. Submit {left === 1 ? "it" : "them"} before 8 PM to be marked present.</>;

  const pct = (n: number) => (cur && cur.total > 0 ? `${Math.round((n / cur.total) * 100)}% of working days` : "No working days logged");
  const ledger = [
    { label: "Present", value: cur?.present, hint: pct(cur?.present ?? 0) },
    { label: "Absent", value: cur?.absent, hint: pct(cur?.absent ?? 0) },
    { label: "On leave", value: cur?.leave, hint: pct(cur?.leave ?? 0) },
    { label: "Not reported", value: cur?.unreported, hint: cur && cur.unreported > 0 ? "Days with no report" : "None missed" },
  ];

  if (schools.length === 0) {
    return (
      <div className="sd-page">
        <section className="sd-panel"><div className="sd-empty"><b>No school assigned</b><p>You are not assigned to any school yet. Ask your admin to add you to one.</p></div></section>
      </div>
    );
  }

  const loadingMonths = monthlyQ.isLoading;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="at-title">
        <div className="sd-hero-copy">
          <h1 id="at-title" className="mc-hero-title">Attendance</h1>
          <p className="sd-where">{selectedSchool?.name ?? "All your schools"}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            {left > 0 && !off && st !== "leave" && !failed && today ? (
              <Link href="/lms/teacher/reports" className="sd-btn sd-btn--amber"><FileText aria-hidden="true" />Submit {plural(left, "report")}</Link>
            ) : null}
            <Link href="/lms/teacher/leaves" className={`sd-btn ${left > 0 && !off && st !== "leave" && today ? "sd-btn--ghost-dark" : "sd-btn--amber"}`}><CalendarOff aria-hidden="true" />Leave requests</Link>
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => void refresh()} disabled={refreshing} aria-label={refreshing ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {loadingMonths ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : monthlyQ.isError ? (
          <div className="sd-run-card to-run-empty">
            <b>Your months did not load</b>
            <button className="sd-btn sd-btn--amber" onClick={() => void monthlyQ.refetch()}>Try again</button>
          </div>
        ) : (
          <AttendanceRun keys={keys} data={schoolMonths} selected={ym} onSelect={setYm} />
        )}
      </section>

      <div className="mc-tabs" role="tablist" aria-label="Views" style={{ margin: "0.5rem 0" }}>
        {([["overview", "Overview"], ["monthly", "Overall attendance"]] as const).map(([id, label]) => (
          <button key={id} role="tab" id={`at-tab-${id}`} aria-selected={tab === id} aria-controls={`at-panel-${id}`} className="mc-tab" onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "monthly" ? (
        <section className="sd-panel" id="at-panel-monthly" role="tabpanel" aria-labelledby="at-tab-monthly">
          <div className="sd-panel-head"><div><h2>Overall attendance</h2><p>All your schools combined{schools.length > 1 ? ", with each school underneath" : ""}, last 12 months</p></div></div>
          {overallQ.isLoading ? (
            <div style={{ padding: "0 1.25rem 1.25rem" }}><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : (
            <div style={{ overflowX: "auto", padding: "0 1.25rem 1.25rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Month", "Present", "Absent", "Leave", "Not reported", "Working days", "Attendance"].map((h) => <th key={h} style={{ padding: "0.5rem 0.6rem", fontWeight: 600 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {allKeys.map((k) => {
                    const m = months.get(k);
                    const parts = bySchool.get(k) ?? [];
                    const cell = { padding: "0.5rem 0.6rem" } as const;
                    return (
                      <React.Fragment key={k}>
                        <tr style={{ borderTop: "1px solid var(--border, #e5e7eb)", cursor: "pointer" }} onClick={() => { if (keys.includes(k)) setYm(k); }}>
                          <td style={cell}><b>{monthName(k)}</b></td>
                          <td style={cell}>{m?.present ?? "–"}</td><td style={cell}>{m?.absent ?? "–"}</td><td style={cell}>{m?.leave ?? "–"}</td><td style={cell}>{m?.unreported ?? "–"}</td>
                          <td style={cell}>{m?.total ?? "–"}</td>
                          <td style={cell}>{m && m.total > 0 ? <b>{m.pct}%</b> : "–"}</td>
                        </tr>
                        {parts.length > 1 && parts.map(([sid, p]) => (
                          <tr key={`${k}-${sid}`} style={{ opacity: 0.7, fontSize: "0.82rem" }}>
                            <td style={{ ...cell, paddingLeft: "1.4rem" }}>{schools.find((s) => s.id === sid)?.name ?? "School"}</td>
                            <td style={cell}>{p.present}</td><td style={cell}>{p.absent}</td><td style={cell}>{p.leave}</td><td style={cell}>{p.unreported}</td><td style={cell}>{p.total}</td><td style={cell}>{p.total > 0 ? `${p.pct}%` : "–"}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (<>
      <div className="sd-ledger" role="group" aria-label={`Attendance in ${monthName(ym)}, ${selectedSchool?.name ?? "selected school"}`}>
        {ledger.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {loadingMonths ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className="sd-n">{m.value ?? "–"}</b>}
            <small>{m.hint}</small>
          </div>
        ))}
      </div>

      <div className="so-grid">
        <div className="so-col">
          <TodayPanel today={todayQ.isLoading ? undefined : today} schools={schools} />

          <section className="sd-panel as-list" aria-labelledby="at-days">
            <div className="sd-panel-head" style={{ margin: 0, padding: "1.25rem 1.25rem 0.9rem" }}>
              <div><h2 id="at-days">Day by day</h2><p>{monthName(ym)}, newest first</p></div>
            </div>
            {dailyQ.isLoading ? (
              <div style={{ padding: "0 1.25rem 1.25rem" }}><div className="sd-skel" /><div className="sd-skel" /></div>
            ) : dailyQ.isError ? (
              <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}>
                <b>Could not load these days</b>
                <p>Check your connection and try again.</p>
                <button className="sd-btn sd-btn--ink" onClick={() => void dailyQ.refetch()}>Try again</button>
              </div>
            ) : records.length === 0 ? (
              <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}>
                <b>Nothing recorded in {monthName(ym)}</b>
                <p>Days appear here once you report your classes. Pick another month above to look back.</p>
              </div>
            ) : (
              records.map((r) => {
                const s = dayStatus(r.status);
                return (
                  <div key={r.id} className="so-row at-rec">
                    <span className="so-row-text">
                      <b>{new Date(`${r.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</b>
                      <small>
                        {r.late_report ? <span className="at-late">Reports came in after 8 PM. </span> : null}
                        {r.recorded_at ? `Recorded ${new Date(r.recorded_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
                      </small>
                    </span>
                    <span className="at-chip" data-s={s ?? undefined}>{s ? STATUS_LABEL[s] : r.status}</span>
                  </div>
                );
              })
            )}
          </section>
        </div>

        <div className="so-col">
          <section className="sd-panel" aria-labelledby="at-cal">
            <div className="sd-panel-head"><div><h2 id="at-cal">{monthName(ym)}</h2><p>How each day was marked</p></div></div>
            <MonthGrid ym={ym} records={records} todayKey={todayKey} />
          </section>

          <section className="sd-panel" aria-labelledby="at-how">
            <div className="sd-panel-head"><div><h2 id="at-how">How a day is marked</h2></div></div>
            <ul className="at-how">
              <li>Report every class you teach before 8 PM IST and the day is marked present.</li>
              <li>After 8 PM an unreported day is marked absent, even if you report later.</li>
              <li>Approved leave stays as leave, whatever you report.</li>
            </ul>
          </section>
        </div>
      </div>
      </>)}
    </div>
  );
}

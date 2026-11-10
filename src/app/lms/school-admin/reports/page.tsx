"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Download, SquareCheckBig, Users, X } from "lucide-react";
import { formatGradeSection } from "@/hooks/useTeacherData";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";
import ConfirmModal from "@/components/portal/ConfirmModal";
import { initialsOf } from "@/components/portal/notifications";
import { csvCell, downloadText } from "@/components/school-admin/student-utils";
import ReportsRun, { type ReportDay } from "@/components/school-admin/reports/ReportsRun";
import "@/components/school-admin/students.css";
import "@/components/school-admin/teachers.css";
import "@/components/school-admin/reports/reports.css";

interface TeacherReport {
  id: string;
  teacher_id: string;
  school_id: string;
  date: string;
  grade: string;
  section?: string | null;
  topics_taught: string;
  activities?: string;
  student_count: number;
  duration_hours: number;
  notes: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  teacher: { full_name: string; email: string };
  // 'Reviewed' is set by a platform admin (via /admin/teacher-reports) as an
  // in-between "looked at, not yet decided" state: still actionable here, same as 'Pending'.
  status: "Pending" | "Reviewed" | "Approved" | "Rejected";
  class_name?: string;
}

interface ScheduleRow { teacher_id?: string; is_active?: boolean; period_id?: string }
interface PeriodRow { id: string; start_time: string; end_time: string }
interface TeacherRow { id: string; full_name: string; email: string }

type View = "inbox" | "approved" | "rejected" | "all";
type BulkAction = "approve" | "reject";

const isActionable = (status: TeacherReport["status"]) => status === "Pending" || status === "Reviewed";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function dateKey(iso: string): string {
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : new Date(iso).toISOString().slice(0, 10);
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDayLabel(key: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = parseKey(key);
  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === yesterday.getTime()) return "Yesterday";
  return target.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function shiftDateKey(key: string, delta: number): string {
  const date = parseKey(key);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

const hoursBetween = (p?: PeriodRow) => {
  if (!p) return 0;
  return (new Date(`2000-01-01T${p.end_time}`).getTime() - new Date(`2000-01-01T${p.start_time}`).getTime()) / 3_600_000;
};

export default function ReportsManagement() {
  const [reports, setReports] = useState<TeacherReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<View>("inbox");
  const [tab, setTab] = useState<"reports" | "workload">("reports");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<TeacherReport | null>(null);
  const [bulk, setBulk] = useState<BulkAction | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const [reportsRes, schedulesRes, periodsRes, teachersRes] = await Promise.all([
        schoolAdminApi.reports.list({ limit: 500 }),
        schoolAdminApi.schedules.list(),
        schoolAdminApi.periods.list(),
        schoolAdminApi.teachers.list({ limit: 500 }),
      ]);

      const reportsData = reportsRes.data ?? {};
      setReports(((reportsData as { reports?: unknown[] }).reports ?? (Array.isArray(reportsData) ? reportsData : [])) as TeacherReport[]);
      setStats((reportsData as { stats?: typeof stats }).stats ?? { total: 0, pending: 0, approved: 0, rejected: 0 });

      const schedulesData = schedulesRes.data ?? {};
      setSchedules(((schedulesData as { schedules?: ScheduleRow[] }).schedules ?? (Array.isArray(schedulesData) ? schedulesData : [])) as ScheduleRow[]);
      const periodsData = periodsRes.data ?? {};
      setPeriods(((periodsData as { periods?: PeriodRow[] }).periods ?? (Array.isArray(periodsData) ? periodsData : [])) as PeriodRow[]);

      type RawTeacher = {
        id?: string;
        teacher_id?: string;
        full_name?: string;
        email?: string;
        profile?: { id?: string; full_name?: string; fullName?: string; email?: string };
        teacher?: { full_name?: string; email?: string; profile_id?: string };
      };
      const teachersData = teachersRes.data ?? {};
      const raw = ((teachersData as { teachers?: RawTeacher[] }).teachers ?? (Array.isArray(teachersData) ? teachersData : [])) as RawTeacher[];
      setTeachers(
        raw
          .map((t) => {
            const profile = t.profile ?? {};
            const teacher = t.teacher ?? {};
            return {
              id: String(profile.id || t.teacher_id || teacher.profile_id || t.id || ""),
              full_name: t.full_name || profile.full_name || profile.fullName || teacher.full_name || "Unknown",
              email: t.email || profile.email || teacher.email || "",
            };
          })
          .filter((t) => t.id),
      );
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  /* ───────── decisions ───────── */
  const decide = async (id: string, action: "approve" | "reject") => {
    try {
      setBusyId(id);
      await schoolAdminApi.reports.update(id, { action });
      setSelected((prev) => prev.filter((x) => x !== id));
      setRejecting(null);
      await loadReports();
      toast.success(action === "approve" ? "Report approved." : "Report rejected.");
    } catch (error) {
      toast.error(`Could not ${action} the report: ${error instanceof Error ? error.message : "Try again."}`);
    } finally {
      setBusyId(null);
    }
  };

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    try {
      const response = await schoolAdminApi.reports.bulk({ report_ids: selected, action: bulk });
      const data = (response.data ?? {}) as { approved?: number };
      const n = data.approved ?? selected.length;
      toast.success(`${bulk === "approve" ? "Approved" : "Rejected"} ${plural(n, "report")}.`);
      setSelected([]);
      setBulk(null);
      await loadReports();
    } catch (error) {
      toast.error(`Could not ${bulk} the reports: ${error instanceof Error ? error.message : "Try again."}`);
    } finally {
      setBulkBusy(false);
    }
  };

  /* ───────── filtering ───────── */
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return reports.filter((r) => {
      const matchesSearch =
        r.teacher.full_name.toLowerCase().includes(q) ||
        r.topics_taught.toLowerCase().includes(q) ||
        (r.grade || "").toLowerCase().includes(q) ||
        (r.section || "").toLowerCase().includes(q);
      const matchesView =
        view === "all" ? true : view === "inbox" ? isActionable(r.status) : view === "approved" ? r.status === "Approved" : r.status === "Rejected";
      const label = formatGradeSection(r.grade, r.section);
      return (
        matchesSearch &&
        matchesView &&
        (teacherFilter === "all" || r.teacher_id === teacherFilter) &&
        (gradeFilter === "all" || label === gradeFilter || r.grade === gradeFilter) &&
        (!focusDate || dateKey(r.date) === focusDate)
      );
    });
  }, [reports, searchTerm, view, teacherFilter, gradeFilter, focusDate]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, TeacherReport[]>();
    for (const r of filtered) {
      const key = dateKey(r.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.teacher.full_name.localeCompare(b.teacher.full_name) || (a.grade || "").localeCompare(b.grade || ""));
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const actionable = filtered.filter((r) => isActionable(r.status));
  const inbox = reports.filter((r) => isActionable(r.status));
  const teacherOptions = useMemo(
    () => [...new Map(reports.map((r) => [r.teacher_id, r.teacher.full_name || "Unknown"])).entries()].map(([id, name]) => ({ id, name })),
    [reports],
  );
  const classOptions = useMemo(() => [...new Set(reports.map((r) => formatGradeSection(r.grade, r.section)).filter(Boolean))].sort(), [reports]);

  /* ───────── the week track ───────── */
  const week: ReportDay[] = useMemo(() => {
    const today = todayKey();
    return Array.from({ length: 7 }, (_, i) => {
      const key = shiftDateKey(today, i - 6);
      const day = reports.filter((r) => dateKey(r.date) === key);
      const d = parseKey(key);
      return {
        key,
        label: `${d.toLocaleDateString(undefined, { weekday: "short" })} ${d.getDate()}`,
        pending: day.filter((r) => isActionable(r.status)).length,
        total: day.length,
      };
    });
  }, [reports]);
  const olderWaiting = inbox.filter((r) => dateKey(r.date) < week[0].key).length;
  const oldestWaiting = inbox.length ? inbox.map((r) => dateKey(r.date)).sort()[0] : null;

  /* ───────── selection ───────── */
  const toggleSelect = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allSelected = actionable.length > 0 && actionable.every((r) => selected.includes(r.id));
  const toggleAll = () => setSelected(allSelected ? [] : actionable.map((r) => r.id));
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const changeView = (v: View) => {
    setView(v);
    setSelected([]);
  };

  /* ───────── export ───────── */
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.warning("There are no reports to export.");
      return;
    }
    const headers = ["Teacher name", "Teacher email", "Date", "Class", "Topics taught", "Activities", "Students", "Duration (hours)", "Status", "Notes"];
    const rows = filtered.map((r) => [
      r.teacher.full_name || "Unknown",
      r.teacher.email || "",
      dateKey(r.date),
      formatGradeSection(r.grade, r.section) || "N/A",
      r.topics_taught || "",
      r.activities || "",
      r.student_count || 0,
      r.duration_hours || 0,
      r.status,
      r.notes || "",
    ]);
    let filename = "teacher_reports";
    if (focusDate) filename += `_${focusDate}`;
    if (gradeFilter !== "all") filename += `_${gradeFilter}`;
    downloadText(`${filename}.csv`, [headers.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n"));
  };

  /* ───────── workload ───────── */
  const activeSchedules = schedules.filter((s) => s.is_active);
  const scheduledHours = activeSchedules.reduce((acc, s) => acc + hoursBetween(periods.find((p) => p.id === s.period_id)), 0);
  const avgLoad = scheduledHours / (teachers.length || 1);
  const workloadFor = (teacherId: string) => {
    const mine = activeSchedules.filter((s) => s.teacher_id === teacherId);
    const hours = mine.reduce((acc, s) => acc + hoursBetween(periods.find((p) => p.id === s.period_id)), 0);
    return { hours, periods: mine.length, level: hours > 30 ? "over" : hours > 24 ? "high" : "ok" };
  };

  /* ───────── copy ───────── */
  let status: React.ReactNode;
  if (loading) status = "Loading reports…";
  else if (inbox.length === 0) status = reports.length === 0 ? "No teaching reports yet. They show up here when teachers submit them." : "Nothing is waiting for your review.";
  else {
    status = (
      <>
        <strong>{plural(inbox.length, "report")}</strong> {inbox.length === 1 ? "needs" : "need"} your review.
        {oldestWaiting ? <> The oldest is from {formatDayLabel(oldestWaiting).toLowerCase() === "today" ? "today" : formatDayLabel(oldestWaiting)}.</> : null}
      </>
    );
  }

  const ledger: { id: View; label: string; value: number; hint: string }[] = [
    { id: "inbox", label: "Needs review", value: inbox.length, hint: "Waiting for a decision" },
    { id: "approved", label: "Approved", value: stats.approved, hint: "Accepted as written" },
    { id: "rejected", label: "Rejected", value: stats.rejected, hint: "Sent back" },
    { id: "all", label: "All reports", value: stats.total, hint: "Everything submitted" },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="rp-title">
        <div className="sd-hero-copy">
          <h1 id="rp-title" className="mc-hero-title">Teacher reports</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            {actionable.length > 0 && tab === "reports" && view === "inbox" && (
              <button className="sd-btn sd-btn--amber" onClick={toggleAll}>
                <SquareCheckBig aria-hidden="true" />{allSelected ? "Clear selection" : `Select all ${actionable.length}`}
              </button>
            )}
            <button className="sd-btn sd-btn--ghost-dark" onClick={handleExportCSV}><Download aria-hidden="true" />Export</button>
          </div>
        </div>
        <ReportsRun days={week} focus={focusDate} onFocus={(k) => { setFocusDate(k); setTab("reports"); }} waiting={inbox.length} older={olderWaiting} />
      </section>

      <div className="mc-tabs" role="tablist" aria-label="Reports and workload" style={{ justifySelf: "start" }}>
        <button role="tab" className="mc-tab" aria-selected={tab === "reports"} onClick={() => setTab("reports")}>Daily reports{inbox.length > 0 && <b>{inbox.length}</b>}</button>
        <button role="tab" className="mc-tab" aria-selected={tab === "workload"} onClick={() => setTab("workload")}>Workload</button>
      </div>

      {tab === "reports" ? (
        <>
          <div className="sd-ledger" role="group" aria-label="Show reports by status">
            {ledger.map((b) => (
              <button key={b.id} type="button" aria-pressed={view === b.id} onClick={() => changeView(b.id)}>
                <span className="sd-l">{b.label}</span>
                {loading ? <span className="sd-skel" style={{ height: "2.2rem", width: "3.5rem" }} /> : <b className="sd-n">{b.value}</b>}
                <small>{b.hint}</small>
              </button>
            ))}
          </div>

          <div className="rp-bar">
            <input type="search" className="sd-field" placeholder="Search teacher, topic or class" aria-label="Search reports" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <select className="sd-field" aria-label="Teacher" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
              <option value="all">All teachers</option>
              {teacherOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="sd-field" aria-label="Class" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
              <option value="all">All classes</option>
              {classOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <div className="rp-daynav" role="group" aria-label="Pick a day">
              <button className="pl-ico" onClick={() => setFocusDate((p) => shiftDateKey(p || todayKey(), -1))} aria-label="Previous day"><ChevronLeft /></button>
              <input type="date" className="sd-field" aria-label="Day" value={focusDate || ""} onChange={(e) => setFocusDate(e.target.value || null)} />
              <button className="pl-ico" onClick={() => setFocusDate((p) => shiftDateKey(p || todayKey(), 1))} aria-label="Next day"><ChevronRight /></button>
              {focusDate ? (
                <button className="sd-btn sd-btn--line" onClick={() => setFocusDate(null)}>All days</button>
              ) : (
                <button className="sd-btn sd-btn--line" onClick={() => setFocusDate(todayKey())}>Today</button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : groupedByDate.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>{view === "inbox" ? "All caught up" : "No reports found"}</b>
                <p>
                  {view === "inbox"
                    ? focusDate ? `No reports need review for ${formatDayLabel(focusDate)}.` : "No teaching reports are waiting for you right now."
                    : "Try another day, or clear the filters."}
                </p>
                {view === "inbox" && (stats.approved > 0 || stats.rejected > 0) && (
                  <button className="sd-btn sd-btn--line" onClick={() => changeView("all")}>See all reports</button>
                )}
              </div>
            </section>
          ) : (
            groupedByDate.map(([day, list]) => {
              const waiting = list.filter((r) => isActionable(r.status));
              const ids = waiting.map((r) => r.id);
              const daySelected = ids.length > 0 && ids.every((id) => selected.includes(id));
              return (
                <section key={day} className="sd-panel as-list mc-swap" aria-label={formatDayLabel(day)}>
                  <p className="as-group">
                    {formatDayLabel(day)}
                    <span>{plural(list.length, "report")}{waiting.length > 0 ? `, ${waiting.length} awaiting approval` : ""}</span>
                    {waiting.length > 0 && view !== "approved" && view !== "rejected" && (
                      <button className="sm-reset" style={{ marginLeft: "auto", color: "var(--sd-blue-deep)" }} onClick={() => setSelected((prev) => (daySelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]))}>
                        {daySelected ? "Unselect day" : "Select day"}
                      </button>
                    )}
                  </p>
                  {list.map((r) => {
                    const canAct = isActionable(r.status);
                    const open = expanded.has(r.id);
                    const isSel = selected.includes(r.id);
                    const label = formatGradeSection(r.grade, r.section) || "N/A";
                    const busy = busyId === r.id;
                    return (
                      <article key={r.id} className="rp-row" data-pending={canAct} data-selected={isSel}>
                        {canAct ? (
                          <input type="checkbox" className="sm-check" checked={isSel} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.teacher.full_name}, ${label}`} />
                        ) : <span className="rp-spacer" />}
                        <span className="sd-avatar" aria-hidden="true">{initialsOf(r.teacher.full_name)}</span>
                        <div className="rp-main">
                          <div className="rp-top">
                            <b>{r.teacher.full_name}</b>
                            <span className="sm-chip" data-class="true">{label}</span>
                            {r.status === "Approved" && <span className="sm-chip" data-tone="done">Approved</span>}
                            {r.status === "Rejected" && <span className="sm-chip" data-tone="red">Rejected</span>}
                            {r.status === "Reviewed" && <span className="sm-chip">Looked at by the main admin</span>}
                          </div>
                          <p className="rp-topics" data-clamp={!open}>{r.topics_taught || "No topics listed"}</p>
                          {open && (r.activities || r.notes) && (
                            <div className="rp-extra">
                              {r.activities && <p><b>Activities: </b>{r.activities}</p>}
                              {r.notes && <p><b>Notes: </b>{r.notes}</p>}
                            </div>
                          )}
                          <div className="rp-meta">
                            <span><Users aria-hidden="true" />{plural(r.student_count, "student")}</span>
                            <span><Clock aria-hidden="true" />{Number(r.duration_hours || 0).toFixed(2)} hours</span>
                            {(r.activities || r.notes || (r.topics_taught || "").length > 110) && (
                              <button className="nt-more" onClick={() => toggleExpanded(r.id)} aria-expanded={open}>{open ? "Show less" : "Show details"}</button>
                            )}
                          </div>
                        </div>
                        {canAct && (
                          <div className="rp-acts">
                            <button className="sd-btn sd-btn--line tm-reject" disabled={busy} onClick={() => setRejecting(r)}><X aria-hidden="true" />Reject</button>
                            <button className="sd-btn sd-btn--amber" disabled={busy} onClick={() => void decide(r.id, "approve")}><Check aria-hidden="true" />Approve</button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              );
            })
          )}
        </>
      ) : (
        <>
          <div className="sd-ledger" data-cols="3">
            <div><span className="sd-l">Scheduled hours</span><b className="sd-n">{scheduledHours.toFixed(1)}h</b><small>Total weekly teaching</small></div>
            <div><span className="sd-l">Teachers</span><b className="sd-n">{teachers.length}</b><small>Assigned to your school</small></div>
            <div><span className="sd-l">Average load</span><b className="sd-n">{avgLoad.toFixed(1)}h</b><small>Per teacher, per week</small></div>
          </div>
          {loading ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : teachers.length === 0 ? (
            <section className="sd-panel"><div className="sd-empty"><b>No workload yet</b><p>Add classes to the timetable and each teacher&apos;s week shows up here.</p></div></section>
          ) : (
            <section className="sd-panel as-list mc-swap" aria-label="Teacher workload and report compliance">
              <div className="rp-wl-head"><span>Teacher</span><span>Classes</span><span>Weekly load</span><span>Report coverage</span></div>
              {teachers.map((t) => {
                const w = workloadFor(t.id);
                const approved = reports.filter((r) => r.teacher_id === t.id && r.status === "Approved").length;
                const coverage = Math.min(100, Math.round((approved / Math.max(1, w.periods)) * 100));
                return (
                  <article key={t.id} className="rp-wl">
                    <div className="rp-person"><span className="sd-avatar" aria-hidden="true">{initialsOf(t.full_name)}</span><span><b>{t.full_name}</b><small>{t.email}</small></span></div>
                    <b className="rp-count">{w.periods}<small>{w.periods === 1 ? "class" : "classes"}</small></b>
                    <div className="rp-load" data-level={w.level}>
                      <b>{w.hours.toFixed(1)}h</b>
                      <i className="tm-bar"><u style={{ width: `${Math.min(100, (w.hours / 30) * 100)}%` }} /></i>
                      <small>{w.level === "over" ? "Over the limit" : w.level === "high" ? "Heavy" : "Fine"}</small>
                    </div>
                    <div className="rp-comp">
                      {w.periods === 0 ? (
                        <span>No classes scheduled yet</span>
                      ) : (
                        <>
                          <span>{plural(approved, "approved report")} for {plural(w.periods, "weekly class", "weekly classes")}<b>{coverage}%</b></span>
                          <i className="tm-bar"><u style={{ width: `${coverage}%` }} /></i>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}

      {selected.length > 0 && tab === "reports" && (
        <div className="rp-bulk" role="region" aria-label="Selected reports">
          <button className="rp-sel" onClick={toggleAll}><b>{selected.length} selected</b></button>
          <button className="sd-btn sd-btn--amber" onClick={() => setBulk("approve")}><Check aria-hidden="true" />Approve</button>
          <button className="sd-btn sd-btn--line" onClick={() => setBulk("reject")}><X aria-hidden="true" />Reject</button>
          <button className="sd-btn sd-btn--line" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <ConfirmModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        busy={!!rejecting && busyId === rejecting.id}
        danger
        title="Reject this report?"
        subtitle={rejecting ? `${rejecting.teacher.full_name}'s report for ${formatDayLabel(dateKey(rejecting.date))} will be rejected.` : undefined}
        confirmLabel="Reject report"
        onConfirm={() => rejecting && void decide(rejecting.id, "reject")}
      >
        <p>The teacher will see that it was rejected.</p>
      </ConfirmModal>

      <ConfirmModal
        open={!!bulk}
        onClose={() => setBulk(null)}
        busy={bulkBusy}
        danger={bulk === "reject"}
        title={`${bulk === "reject" ? "Reject" : "Approve"} ${plural(selected.length, "report")}?`}
        subtitle={bulk === "reject" ? "The teachers will see that these were rejected." : "These will be marked as approved."}
        confirmLabel={bulk === "reject" ? "Reject all" : "Approve all"}
        onConfirm={() => void runBulk()}
      >
        <p>
          From {plural(new Set(reports.filter((r) => selected.includes(r.id)).map((r) => r.teacher_id)).size, "teacher")}, across {plural(new Set(reports.filter((r) => selected.includes(r.id)).map((r) => dateKey(r.date))).size, "day")}.
        </p>
      </ConfirmModal>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { useTeacherSchool } from "../../context";
import { formatGradeSection, useTeacherReports, type TeacherReport } from "@/hooks/useTeacherData";
import "@/components/school-admin/overview.css";
import "@/components/school-admin/students.css";
import "@/components/school-admin/teachers.css";
import "@/components/school-admin/reports/reports.css";

type Row = TeacherReport & {
  id: string; school_id: string; date: string; subject?: string; topics_taught?: string; activities?: string | null; notes?: string | null;
  student_count: number; duration_hours: number; report_status: "Pending" | "Reviewed" | "Approved" | "Rejected";
};
type View = "all" | "waiting" | "Approved" | "Rejected";

const DAYS_PER_PAGE = 7;
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const waiting = (r: Row) => r.report_status === "Pending" || r.report_status === "Reviewed";
const key = (d: Date) => d.toLocaleDateString("en-CA");
const parse = (k: string) => new Date(`${k}T12:00:00`);
const shift = (k: string, n: number) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
const dayLabel = (k: string) => {
  const today = key(new Date());
  if (k === today) return "Today";
  if (k === shift(today, -1)) return "Yesterday";
  return parse(k).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

/** Every report this teacher has submitted, day by day, across all their schools. Read-only; resubmit from Submit report. */
export default function MyReportsPage() {
  const { schools } = useTeacherSchool();
  const q = useTeacherReports(undefined, { limit: 500 });
  const [view, setView] = useState<View>("all");
  const [school, setSchool] = useState("all");
  const [klass, setKlass] = useState("all");
  const [search, setSearch] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [days, setDays] = useState(DAYS_PER_PAGE);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const all = useMemo(() => (q.data ?? []) as Row[], [q.data]);
  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? "School";
  const classOf = (r: Row) => formatGradeSection(r.grade, r.section) || "Class";

  // Tiles count within the chosen school so they match the list below.
  const inSchool = useMemo(() => all.filter((r) => school === "all" || r.school_id === school), [all, school]);
  const counts = { all: inSchool.length, waiting: inSchool.filter(waiting).length, Approved: inSchool.filter((r) => r.report_status === "Approved").length, Rejected: inSchool.filter((r) => r.report_status === "Rejected").length };
  const classes = useMemo(() => [...new Set(inSchool.map(classOf).filter(Boolean))].sort(), [inSchool]);

  const grouped = useMemo(() => {
    const s = search.toLowerCase();
    const map = new Map<string, Row[]>();
    for (const r of inSchool) {
      if (view === "waiting" ? !waiting(r) : view !== "all" && r.report_status !== view) continue;
      if (klass !== "all" && classOf(r) !== klass) continue;
      if (day && r.date !== day) continue;
      if (s && !`${r.topics_taught} ${classOf(r)} ${r.subject}`.toLowerCase().includes(s)) continue;
      (map.get(r.date) ?? map.set(r.date, []).get(r.date)!).push(r);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [inSchool, view, klass, day, search]);

  const reset = (fn: () => void) => { fn(); setDays(DAYS_PER_PAGE); };
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const showSchool = schools.length > 1;

  const status = q.isError ? "Your reports did not load. Try again." : q.isLoading ? "Loading your reports…"
    : all.length === 0 ? "You have not submitted a report yet."
    : <><strong>{plural(all.length, "report")}</strong> submitted{showSchool ? ` across ${schools.length} schools` : ""}. {counts.waiting > 0 && <>{counts.waiting} waiting for a decision.</>}</>;

  const tiles: { id: View; label: string; value: number; hint: string }[] = [
    { id: "all", label: "All reports", value: counts.all, hint: "Everything you submitted" },
    { id: "waiting", label: "Waiting", value: counts.waiting, hint: "Not decided yet" },
    { id: "Approved", label: "Approved", value: counts.Approved, hint: "Accepted as written" },
    { id: "Rejected", label: "Rejected", value: counts.Rejected, hint: "Report that class again" },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="mr-title">
        <div className="sd-hero-copy">
          <h1 id="mr-title" className="mc-hero-title">My reports</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <Link href="/lms/teacher/reports" className="sd-btn sd-btn--amber">Submit a report</Link>
          </div>
        </div>
      </section>

      <div className="sd-ledger" role="group" aria-label="Show reports by status">
        {tiles.map((t) => (
          <button key={t.id} type="button" aria-pressed={view === t.id} onClick={() => reset(() => setView(t.id))}>
            <span className="sd-l">{t.label}</span>
            {q.isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "3.5rem" }} /> : <b className="sd-n">{t.value}</b>}
            <small>{t.hint}</small>
          </button>
        ))}
      </div>

      <div className="rp-bar">
        <input type="search" className="sd-field" placeholder="Search topic or class" aria-label="Search reports" value={search} onChange={(e) => reset(() => setSearch(e.target.value))} />
        {showSchool && (
          <select className="sd-field" aria-label="School" value={school} onChange={(e) => reset(() => { setSchool(e.target.value); setKlass("all"); })}>
            <option value="all">All schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select className="sd-field" aria-label="Class" value={klass} onChange={(e) => reset(() => setKlass(e.target.value))}>
          <option value="all">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="rp-daynav" role="group" aria-label="Pick a day">
          <button className="pl-ico" onClick={() => reset(() => setDay(shift(day || key(new Date()), -1)))} aria-label="Previous day"><ChevronLeft /></button>
          <input type="date" className="sd-field" aria-label="Day" value={day || ""} onChange={(e) => reset(() => setDay(e.target.value || null))} />
          <button className="pl-ico" onClick={() => reset(() => setDay(shift(day || key(new Date()), 1)))} aria-label="Next day"><ChevronRight /></button>
          {day ? <button className="sd-btn sd-btn--line" onClick={() => reset(() => setDay(null))}>All days</button> : <button className="sd-btn sd-btn--line" onClick={() => reset(() => setDay(key(new Date())))}>Today</button>}
        </div>
      </div>

      {q.isLoading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : q.isError ? (
        <section className="sd-panel"><div className="sd-empty"><b>Could not load your reports</b><p>Check your connection and try again.</p><button className="sd-btn sd-btn--line" onClick={() => void q.refetch()}>Try again</button></div></section>
      ) : grouped.length === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No reports found</b><p>{all.length === 0 ? "Your reports show up here once you submit them." : "Try another day, or clear the filters."}</p></div></section>
      ) : (
        <>
          {grouped.slice(0, days).map(([d, list]) => {
            const wait = list.filter(waiting).length;
            return (
              <section key={d} className="sd-panel as-list mc-swap" aria-label={dayLabel(d)}>
                <p className="as-group">{dayLabel(d)}<span>{plural(list.length, "report")}{wait > 0 ? `, ${wait} awaiting approval` : ""}</span></p>
                {list.map((r) => {
                  const isOpen = open.has(r.id);
                  const more = !!(r.activities || r.notes || (r.topics_taught ?? "").length > 110);
                  return (
                    <article key={r.id} className="rp-row" data-pending={waiting(r)}>
                      <span className="rp-spacer" />
                      <span className="sd-avatar" aria-hidden="true">{(r.grade ?? "").replace(/\D/g, "").slice(0, 2) || "R"}</span>
                      <div className="rp-main">
                        <div className="rp-top">
                          <b>{classOf(r)}</b>
                          {r.subject && <span className="sm-chip">{r.subject}</span>}
                          {showSchool && <span className="sm-chip" data-class="true">{schoolName(r.school_id)}</span>}
                          {r.report_status === "Approved" && <span className="sm-chip" data-tone="done">Approved</span>}
                          {r.report_status === "Rejected" && <span className="sm-chip" data-tone="red">Rejected</span>}
                          {r.report_status === "Reviewed" && <span className="sm-chip">Looked at by the main admin</span>}
                          {r.report_status === "Pending" && <span className="sm-chip">Waiting</span>}
                        </div>
                        <p className="rp-topics" data-clamp={!isOpen}>{r.topics_taught || "No topics listed"}</p>
                        {isOpen && (r.activities || r.notes) && (
                          <div className="rp-extra">
                            {r.activities && <p><b>Activities: </b>{r.activities}</p>}
                            {r.notes && <p><b>Notes: </b>{r.notes}</p>}
                          </div>
                        )}
                        <div className="rp-meta">
                          <span><Users aria-hidden="true" />{plural(r.student_count, "student")}</span>
                          <span><Clock aria-hidden="true" />{Number(r.duration_hours || 0).toFixed(2)} hours</span>
                          {more && <button className="nt-more" onClick={() => toggle(r.id)} aria-expanded={isOpen}>{isOpen ? "Show less" : "Show details"}</button>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
          {grouped.length > days && (
            <div className="lv-more"><button className="sd-btn sd-btn--line" onClick={() => setDays(days + DAYS_PER_PAGE)}>Show {Math.min(DAYS_PER_PAGE, grouped.length - days)} more days</button></div>
          )}
        </>
      )}
    </div>
  );
}

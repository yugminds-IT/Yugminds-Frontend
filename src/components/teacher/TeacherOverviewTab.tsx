"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarOff, Check, ChevronRight, type LucideIcon } from "lucide-react";
import Droid from "../portal/Droid";
import { ago } from "../portal/notifications";
import type { TeacherClassRow, TeacherLeave, TeacherReport } from "../../hooks/useTeacherData";
import { classLabel, clock, plural, type DayRow } from "./overview/utils";

export type Todo = { id: string; href: string; icon: LucideIcon; title: string; sub: string; count: number; tone?: "red" };

interface Props {
  /** today's classes, already in time order */
  day: DayRow[];
  dayName: string;
  dayLoading: boolean;
  todos: Todo[];
  todosLoading: boolean;
  classes: TeacherClassRow[];
  classesLoading: boolean;
  reports: TeacherReport[];
  reportsLoading: boolean;
  leaves: TeacherLeave[];
  now: number;
}

const SHOWN_CLASSES = 8;

type Recent = { id: string; href: string; title: string; sub: string; chip: string; at: string };

export default function TeacherOverviewTab({
  day,
  dayName,
  dayLoading,
  todos,
  todosLoading,
  classes,
  classesLoading,
  reports,
  reportsLoading,
  leaves,
  now,
}: Props) {
  /* The newest reports, plus one line when leave requests are still waiting. Only entries with a real time. */
  const recent = useMemo(() => {
    const out: Recent[] = [];
    reports.slice(0, 4).forEach((r) => {
      const c = Array.isArray(r.classes) ? r.classes[0] : r.classes;
      const at = r.created_at ?? r.date;
      if (!at) return;
      out.push({
        id: `report-${r.id}`,
        href: "/lms/teacher/reports",
        title: classLabel(r.grade || c?.grade, r.section ?? c?.section) || "Report",
        sub: r.topics_taught?.trim() || (r.date ? `For ${new Date(r.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}` : "Report submitted"),
        chip: r.report_status || "Submitted",
        at: String(at),
      });
    });
    const waiting = leaves.filter((l) => l.status === "Pending");
    if (waiting.length > 0) {
      const newest = waiting.map((l) => String((l as { created_at?: string }).created_at ?? "")).filter(Boolean).sort().pop();
      out.push({
        id: "leaves",
        href: "/lms/teacher/leaves",
        title: plural(waiting.length, "leave request") + " waiting",
        sub: "Your admin has not answered yet",
        chip: "Waiting",
        at: newest ?? waiting[0].start_date,
      });
    }
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5);
  }, [reports, leaves]);

  const assigned = useMemo(() => {
    const seen = new Set<string>();
    return classes.filter((c) => {
      const k = c.id ?? `${c.grade}-${c.section}-${c.subject}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [classes]);
  const shownClasses = assigned.slice(0, SHOWN_CLASSES);

  return (
    <div className="so-grid">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="to-todo">
          <div className="sd-panel-head"><div><h2 id="to-todo">Needs your attention</h2><p>Each one opens where you can deal with it.</p></div></div>
          {todosLoading ? (
            <><div className="sd-skel" /><div className="sd-skel" /></>
          ) : todos.length === 0 ? (
            <div className="so-clear">
              <span className="so-clear-droid"><Droid /></span>
              <div><b>You are all caught up</b><p>Missing reports, flagged reports and waiting leave requests will show up here.</p></div>
            </div>
          ) : (
            <div>
              {todos.map((t) => (
                <Link key={t.id} href={t.href} className="so-todo" data-tone={t.tone}>
                  <span className="so-todo-ico" aria-hidden="true"><t.icon /></span>
                  <span className="so-todo-text"><b>{t.title}</b><small data-hot={t.tone === "red"}>{t.sub}</small></span>
                  <span className="so-count">{t.count}</span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="sd-panel as-list" aria-labelledby="to-today">
          <div className="sd-panel-head" style={{ margin: 0, padding: "1.25rem 1.25rem 0.9rem" }}>
            <div><h2 id="to-today">Today&apos;s classes</h2><p>{dayName}, in time order. Open one to write its report.</p></div>
            <Link href="/lms/teacher/reports" className="sd-link">All reports</Link>
          </div>
          {dayLoading ? (
            <div style={{ padding: "0 1.25rem 1.25rem" }}><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : day.length === 0 ? (
            <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}>
              <b>No classes today</b>
              <p>Nothing is scheduled for you today, so no reports are due.</p>
              <Link href="/lms/teacher/classes" className="sd-btn sd-btn--line">See my classes</Link>
            </div>
          ) : (
            day.map((r) => {
              const late = !r.reported && r.phase === "past";
              return (
                <Link key={r.key} href={r.href} className="so-class to-class" data-state={r.phase === "live" ? "now" : undefined} data-late={late}>
                  <span className="so-class-time">{clock(r.from)}{Number.isFinite(r.to) && <small>to {clock(r.to)}</small>}</span>
                  <span className="so-class-main"><b>{r.subject}</b>{r.label && <small>{r.label}</small>}</span>
                  <span className="to-chips">
                    {r.phase === "live" && <span className="so-chip" data-now="true">On now</span>}
                    <span className="to-chip" data-s={r.reported ? "done" : late ? "late" : "todo"}>
                      {r.reported && <Check aria-hidden="true" />}
                      {r.reported ? "Reported" : late ? "Report due" : "Not reported"}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </section>
      </div>

      <div className="so-col">
        <section className="sd-panel" aria-labelledby="to-recent">
          <div className="sd-panel-head">
            <div><h2 id="to-recent">Recent activity</h2><p>Your latest reports and requests</p></div>
            <Link href="/lms/teacher/reports" className="sd-link">Reports</Link>
          </div>
          {reportsLoading ? (
            <><div className="sd-skel" /><div className="sd-skel" /></>
          ) : recent.length === 0 ? (
            <div className="sd-empty"><b>Nothing yet</b><p>Reports you submit and leave requests you make will appear here.</p></div>
          ) : (
            <div>
              {recent.map((a) => (
                <Link key={a.id} href={a.href} className="so-row to-recent">
                  {a.id === "leaves" && <span className="to-recent-ico" aria-hidden="true"><CalendarOff /></span>}
                  <span className="so-row-text"><b>{a.title}</b><small>{a.sub}</small></span>
                  <span className="to-chip" data-s={a.chip.toLowerCase()}>{a.chip}</span>
                  <time dateTime={a.at}>{ago(a.at, now)}</time>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="sd-panel" aria-labelledby="to-classes">
          <div className="sd-panel-head">
            <div><h2 id="to-classes">My classes</h2><p>{classesLoading ? " " : `${plural(assigned.length, "class", "classes")} assigned to you`}</p></div>
            <Link href="/lms/teacher/classes" className="sd-link">All classes</Link>
          </div>
          {classesLoading ? (
            <><div className="sd-skel" /><div className="sd-skel" /></>
          ) : assigned.length === 0 ? (
            <div className="sd-empty"><b>No classes assigned yet</b><p>Your school admin assigns classes to you. They will show up here.</p></div>
          ) : (
            <>
              <ul className="to-classes">
                {shownClasses.map((c, i) => (
                  <li key={c.id ?? i}>
                    <b>{classLabel(c.grade, c.section) || c.class_name || "Class"}</b>
                    {c.subject && <small>{c.subject}</small>}
                  </li>
                ))}
              </ul>
              {assigned.length > shownClasses.length && (
                <p className="to-more">and {assigned.length - shownClasses.length} more. <Link href="/lms/teacher/classes" className="sd-link">See all</Link></p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

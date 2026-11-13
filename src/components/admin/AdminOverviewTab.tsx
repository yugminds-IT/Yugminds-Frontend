"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarOff, ChevronRight, KeyRound, MessageSquare, School, type LucideIcon } from "lucide-react";
import Droid from "../portal/Droid";
import { ChipGroup, ago, initialsOf } from "../portal/notifications";
import { SegmentBar } from "../teacher/analytics/Charts";
import type { NeedsAttentionItem } from "./NeedsAttentionPanel";
import type { AdminDashboardStats, QuickPreviewGroup, TeacherPerformance } from "../../hooks/useAdminDashboard";
import { GROWTH_LABEL } from "./overview/GrowthRun";
import "../teacher/analytics/analytics.css"; // segmented bar
import "./overview/overview.css";

const TODO_ICON: Record<string, LucideIcon> = { leaves: CalendarOff, "password-resets": KeyRound, "contact-submissions": MessageSquare, "inactive-schools": School };
const KIND_HREF = { schools: "/lms/admin/schools", teachers: "/lms/admin/teachers", students: "/lms/admin/students", courses: "/lms/admin/courses" } as const;
type Kind = keyof typeof KIND_HREF;
type Filter = "all" | Kind;

const SHOWN = 8;
const whole = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0);

/** Everything on the Overview tab that is not the hero: what needs the admin, how the platform is doing, what was added lately. */
export default function AdminOverviewTab({
  stats,
  previews,
  todos,
  teacherPerformance,
  now,
}: {
  stats: AdminDashboardStats;
  previews: QuickPreviewGroup[];
  todos: NeedsAttentionItem[];
  teacherPerformance?: TeacherPerformance;
  now: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const added = previews
    .flatMap((g) => g.data.filter((d) => d.created_at).map((d) => ({
      key: `${g.id}-${d.id ?? d.name ?? d.title}-${d.created_at}`,
      kind: g.id as Kind,
      name: d.name || d.full_name || d.title || "Unnamed",
      sub: d.email || (d.status ? d.status : ""),
      at: d.created_at,
    })))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const visible = (filter === "all" ? added : added.filter((a) => a.kind === filter)).slice(0, SHOWN);

  const health = whole(stats.systemHealth);
  const attendance = whole(stats.avgAttendance);
  const completion = whole(stats.completionRate);
  const perf = teacherPerformance;
  const perfTotal = perf ? perf.excellent + perf.good + perf.average + perf.needsImprovement : 0;

  return (
    <div className="so-grid">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="ao-todo">
          <div className="sd-panel-head"><div><h2 id="ao-todo">Needs your attention</h2><p>Each one opens where you can deal with it.</p></div></div>
          {todos.length === 0 ? (
            <div className="so-clear">
              <span className="so-clear-droid"><Droid /></span>
              <div><b>You are all caught up</b><p>Leave requests, password resets, contact messages and system alerts show up here.</p></div>
            </div>
          ) : (
            <div>
              {todos.map((t) => {
                const Icon = TODO_ICON[t.id] ?? AlertCircle;
                const body = (
                  <>
                    <span className="so-todo-ico" aria-hidden="true"><Icon /></span>
                    <span className="so-todo-text"><b>{t.label}</b></span>
                    <span className="so-count">{t.count}</span>
                    {t.href ? <ChevronRight aria-hidden="true" /> : <span />}
                  </>
                );
                return t.href ? (
                  <Link key={t.id} href={t.href} className="so-todo" data-tone={t.tone === "red" ? "red" : undefined}>{body}</Link>
                ) : (
                  <div key={t.id} className="so-todo" data-tone={t.tone === "red" ? "red" : undefined}>{body}</div>
                );
              })}
            </div>
          )}
        </section>

        <section className="sd-panel" aria-labelledby="ao-status">
          <div className="sd-panel-head"><div><h2 id="ao-status">How the platform is doing</h2><p>Right now, across every school</p></div></div>
          <ul className="ao-stats">
            {health > 0 && (
              <li>
                <span><b>Requests that worked</b><small>Share of recent requests with no server error. It starts again when the server restarts.</small></span>
                <span className="ao-val" data-hot={health < 70}>{health}%</span>
                <span className="sd-meter" data-t={health < 70 ? "low" : undefined}><i style={{ "--p": `${Math.min(100, health)}%` } as React.CSSProperties} /></span>
              </li>
            )}
            {attendance > 0 && (
              <li>
                <span><b>Teacher attendance</b><small>Average this month</small></span>
                <span className="ao-val">{attendance}%</span>
                <span className="sd-meter" data-t={attendance < 75 ? "low" : undefined}><i style={{ "--p": `${Math.min(100, attendance)}%` } as React.CSSProperties} /></span>
              </li>
            )}
            {completion > 0 && (
              <li>
                <span><b>Lesson progress</b><small>Average progress across lesson activity in the last 30 days</small></span>
                <span className="ao-val">{completion}%</span>
                <span className="sd-meter"><i style={{ "--p": `${Math.min(100, completion)}%` } as React.CSSProperties} /></span>
              </li>
            )}
            <li>
              <span><b>People on the platform</b><small>Teachers and students with an active account</small></span>
              <span className="ao-val">{whole(stats.activeUsers).toLocaleString("en-IN")}</span>
            </li>
            <li>
              <Link href="/lms/admin/teachers?tab=leaves" className="ao-link">
                <span><b>Leave requests waiting</b><small>{stats.pendingEmergencyLeaves ? `${stats.pendingEmergencyLeaves} marked emergency` : "From teachers across your schools"}</small></span>
                <span className="ao-val" data-hot={whole(stats.pendingLeaves) > 0}>{whole(stats.pendingLeaves)}</span>
              </Link>
            </li>
            <li>
              <Link href="/lms/admin/password-reset-requests" className="ao-link">
                <span><b>Password resets waiting</b><small>Someone may be locked out</small></span>
                <span className="ao-val" data-hot={whole(stats.pendingPasswordResets) > 0}>{whole(stats.pendingPasswordResets)}</span>
              </Link>
            </li>
          </ul>
          {perf && perfTotal > 0 && (
            <div className="ao-perf">
              <h3>Teacher performance</h3>
              <SegmentBar
                parts={[
                  { label: "Excellent", value: perf.excellent, tone: "ink" },
                  { label: "Good", value: perf.good, tone: "blue" },
                  { label: "Average", value: perf.average, tone: "amber" },
                  { label: "Needs help", value: perf.needsImprovement, tone: "red" },
                ]}
                empty="No teacher ratings yet."
              />
            </div>
          )}
        </section>
      </div>

      <div className="so-col">
        <section className="sd-panel" aria-labelledby="ao-recent">
          <div className="sd-panel-head">
            <div><h2 id="ao-recent">Recently added</h2><p>The newest schools, teachers, students and courses</p></div>
            {filter !== "all" && <Link href={KIND_HREF[filter]} className="sd-link">See all</Link>}
          </div>
          <div className="ao-chips">
            <ChipGroup<Filter>
              label="Show"
              value={filter}
              options={[["all", "Everything"], ["schools", "Schools"], ["teachers", "Teachers"], ["students", "Students"], ["courses", "Courses"]]}
              onChange={setFilter}
            />
          </div>
          {visible.length === 0 ? (
            <div className="sd-empty"><b>Nothing added yet</b><p>New {filter === "all" ? "schools, teachers, students and courses" : GROWTH_LABEL[filter].toLowerCase()} appear here as they join.</p></div>
          ) : (
            <div>
              {visible.map((a) => (
                <Link key={a.key} href={KIND_HREF[a.kind]} className="ao-recent" style={{ color: "inherit", textDecoration: "none" }}>
                  <span className="sd-avatar" aria-hidden="true">{initialsOf(a.name)}</span>
                  <span className="so-row-text"><b>{a.name}</b>{a.sub && <small>{a.sub}</small>}</span>
                  <span className="so-chip">{a.kind.replace(/s$/, "")}</span>
                  <time dateTime={a.at} className="so-row-time" style={{ flex: "none", fontSize: "0.85rem", color: "var(--sd-ink-soft)" }}>{ago(a.at, now)}</time>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

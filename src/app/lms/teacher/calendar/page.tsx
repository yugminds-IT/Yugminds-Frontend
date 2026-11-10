"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import { teacherApi, setAuthToken } from "@/lib/api";
import { getSession } from "@/lib/session-utils";
import { useTeacherSchool } from "../context";
import CalendarRun, { type RunDay } from "@/components/teacher/calendar/CalendarRun";
import { DayDetail, EventRow, MonthGrid } from "@/components/teacher/calendar/MonthView";
import {
  buildIndex, datesOf, dayInfo, shortDate, WORKS, ymd,
  type CalendarEntry, type MonthData, type ScheduleDay,
} from "@/components/teacher/calendar/utils";
import { plural } from "@/components/teacher/overview/utils";
import "@/components/school-admin/overview.css"; // hero meta, two-column grid
import "@/components/teacher/overview/overview.css"; // day track
import "@/components/teacher/calendar/calendar.css";

/** One month of the school calendar plus which of your schools you teach at each day. */
function useMonth(year: number, month: number, enabled = true) {
  return useQuery<MonthData>({
    queryKey: ["teacher", "calendar", year, month],
    enabled,
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error("Not authenticated");
      setAuthToken(session.access_token || null);
      const { data } = await teacherApi.calendar.list({ year: String(year), month: String(month).padStart(2, "0") });
      const body = data as { calendar?: CalendarEntry[]; schedule?: ScheduleDay[]; unassigned_dates?: string[] };
      return { calendar: body?.calendar ?? [], schedule: body?.schedule ?? [], unassignedDates: body?.unassigned_dates ?? [] };
    },
  });
}

/**
 * Read-only view of the holiday, break and make-up-day calendars of the schools you teach at. It answers
 * "why did today behave differently at school A and school B", and which school you are at on any day.
 */
export default function TeacherCalendarPage() {
  const { schools } = useTeacherSchool();
  const [now] = useState(() => new Date());
  const today = ymd(now);
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [picked, setPicked] = useState<string | null>(null);

  // The week ahead can run into next month, so load that too
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentQ = useMonth(now.getFullYear(), now.getMonth() + 1);
  const nextQ = useMonth(nextMonth.getFullYear(), nextMonth.getMonth() + 1);
  const viewQ = useMonth(view.y, view.m);

  const heroIx = useMemo(() => buildIndex([currentQ.data, nextQ.data]), [currentQ.data, nextQ.data]);
  const viewIx = useMemo(() => buildIndex([viewQ.data]), [viewQ.data]);
  const multi = schools.length > 1;
  const schoolIdx = useMemo(() => new Map(schools.map((s, i) => [s.id ?? "", i])), [schools]);

  /* ───────── the week ahead ───────── */
  const days: RunDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const date = ymd(d);
    return { date, weekday: d.toLocaleDateString("en-IN", { weekday: "short" }), day: d.getDate(), info: dayInfo(heroIx, date), today: i === 0 };
  });
  const todayInfo = days[0].info;

  const nextClosure = useMemo(() => {
    let best: { date: string; e: CalendarEntry } | null = null;
    for (const e of heroIx.all) {
      if (e.type !== "Holiday" && e.type !== "Break") continue;
      for (const d of datesOf(e)) if (d > today && (!best || d < best.date)) best = { date: d, e };
    }
    return best;
  }, [heroIx, today]);
  const inDays = nextClosure ? Math.round((new Date(`${nextClosure.date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000) : 0;
  const caption = nextClosure ? `Next closure: ${nextClosure.e.name}, ${shortDate(nextClosure.date)}${inDays > 0 ? ` (in ${plural(inDays, "day")})` : ""}` : "No holidays or breaks coming up";

  const names = (list: { school_name: string }[]) => [...new Set(list.map((s) => s.school_name || "your school"))].join(" and ");
  let status: React.ReactNode;
  if (currentQ.isLoading) status = "Loading your calendar…";
  else if (currentQ.isError) status = "Your calendar did not load. Try again.";
  else if (todayInfo.kind === "closed") status = <><strong>Today is a {todayInfo.closedAt[0]?.type === "Break" ? "break" : "holiday"}</strong> at {names(todayInfo.closedAt)}{todayInfo.closedAt[0]?.name ? `: ${todayInfo.closedAt[0].name}` : ""}. No classes are held.</>;
  else if (todayInfo.kind === "half") status = <><strong>Today is a half day</strong> at {names(todayInfo.scheduled)}.</>;
  else if (todayInfo.kind === "comp") status = <><strong>Today is a make-up working day.</strong> Classes are held.</>;
  else if (todayInfo.kind === "off") status = <><strong>Today is your weekly off.</strong> No reports are due.</>;
  else if (todayInfo.kind === "unassigned") status = "You are not assigned to a school yet.";
  else {
    const open = todayInfo.scheduled.filter((s) => !todayInfo.closedAt.some((c) => c.school_id === s.school_id));
    status = <><strong>You teach today</strong> at {names(open)}.{todayInfo.closedAt.length > 0 ? ` ${names(todayInfo.closedAt)} is closed for ${todayInfo.closedAt[0].name}.` : ""}</>;
  }

  /* ───────── the month you are looking at ───────── */
  const isCurrent = view.y === now.getFullYear() && view.m === now.getMonth() + 1;
  const selected = picked ?? (isCurrent ? today : null);
  const monthDays = Array.from({ length: new Date(view.y, view.m, 0).getDate() }, (_, i) => dayInfo(viewIx, ymd(new Date(view.y, view.m - 1, i + 1))));
  const count = (f: (k: string) => boolean) => monthDays.filter((d) => f(d.kind)).length;
  const monthLabel = new Date(view.y, view.m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const events = useMemo(() => [...viewIx.all].sort((a, b) => a.date.localeCompare(b.date)), [viewIx]);
  const perSchool = (id: string) => monthDays.filter((_, i) => (viewIx.schedule.get(ymd(new Date(view.y, view.m - 1, i + 1))) ?? []).some((s) => s.school_id === id)).length;

  const ledger = [
    { label: "Teaching days", value: count((k) => WORKS.includes(k as never)), hint: "Days you are scheduled and open" },
    { label: "Holiday and break days", value: count((k) => k === "closed"), hint: multi ? "Closed at all your schools" : "Closed at your school" },
    { label: "Half days", value: count((k) => k === "half"), hint: "Shorter school day" },
    { label: "Make-up days", value: count((k) => k === "comp"), hint: "Extra working days" },
  ];

  const go = (by: number) => {
    const d = new Date(view.y, view.m - 1 + by, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
    setPicked(null);
  };
  const pick = (date: string) => {
    const [y, m] = date.split("-").map(Number);
    setView({ y, m });
    setPicked(date);
  };

  if (schools.length === 0) {
    return (
      <div className="sd-page">
        <section className="sd-panel"><div className="sd-empty"><b>No school assigned</b><p>You are not assigned to any school yet. Ask your admin to add you to one.</p></div></section>
      </div>
    );
  }

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="cd-title">
        <div className="sd-hero-copy">
          <h1 id="cd-title" className="mc-hero-title">School calendar</h1>
          <p className="sd-where">{multi ? `All ${schools.length} of your schools` : schools[0]?.name ?? "Your school"}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <Link href="/lms/teacher/leaves?apply=1" className="sd-btn sd-btn--amber"><CalendarOff aria-hidden="true" />Apply for leave</Link>
          </div>
        </div>
        {currentQ.isLoading ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <CalendarRun days={days} caption={caption} onPick={pick} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label={`${monthLabel} at a glance`}>
        {ledger.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {viewQ.isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className="sd-n">{viewQ.isError ? "–" : m.value}</b>}
            <small>{m.hint}</small>
          </div>
        ))}
      </div>

      <div className="so-grid">
        <div className="so-col">
          <section className="sd-panel" aria-labelledby="cd-month">
            <div className="cd-head">
              <div><h2 id="cd-month">{monthLabel}</h2><p>Pick a day to see where you teach and what is on</p></div>
              <div className="cd-nav">
                {!isCurrent && <button className="sd-btn sd-btn--line" onClick={() => { setView({ y: now.getFullYear(), m: now.getMonth() + 1 }); setPicked(null); }}>Today</button>}
                <span className="mc-cal-nav">
                  <button type="button" onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></button>
                  <button type="button" onClick={() => go(1)} aria-label="Next month"><ChevronRight aria-hidden="true" /></button>
                </span>
              </div>
            </div>
            {viewQ.isLoading ? (
              <><div className="sd-skel" style={{ height: "14rem" }} /></>
            ) : viewQ.isError ? (
              <div className="sd-empty">
                <b>Could not load {monthLabel}</b>
                <p>Check your connection and try again.</p>
                <button className="sd-btn sd-btn--ink" onClick={() => void viewQ.refetch()}>Try again</button>
              </div>
            ) : (
              <>
                <MonthGrid year={view.y} month={view.m} index={viewIx} today={today} selected={selected} onSelect={setPicked} schoolIdx={schoolIdx} multi={multi} />
                {selected && selected.startsWith(`${view.y}-${String(view.m).padStart(2, "0")}`) && (
                  <DayDetail date={selected} info={dayInfo(viewIx, selected)} schoolIdx={schoolIdx} multi={multi} />
                )}
              </>
            )}
          </section>
        </div>

        <div className="so-col">
          <section className="sd-panel" aria-labelledby="cd-events">
            <div className="sd-panel-head"><div><h2 id="cd-events">On the calendar</h2><p>{monthLabel}</p></div></div>
            {viewQ.isLoading ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : events.length === 0 ? (
              <div className="sd-empty"><b>Nothing this month</b><p>No holidays, breaks or make-up days are set for your schools in {monthLabel}.</p></div>
            ) : (
              <ul className="cd-events">{events.map((e) => <EventRow key={e.id + e.school_id} e={e} multi={multi} />)}</ul>
            )}
          </section>

          {multi && (
            <section className="sd-panel" aria-labelledby="cd-schools">
              <div className="sd-panel-head"><div><h2 id="cd-schools">Your schools</h2><p>Days you teach at each in {monthLabel}</p></div></div>
              <ul className="cd-schools">
                {schools.map((s, i) => (
                  <li key={s.id}>
                    <em data-sc={i % 6} />
                    <b>{s.name}</b>
                    <small>{viewQ.isLoading ? " " : plural(perSchool(s.id ?? ""), "day")}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

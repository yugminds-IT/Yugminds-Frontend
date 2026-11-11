"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCw } from "lucide-react";
import { useTeacherSchool } from "../context";
import { useTeacherClasses, useTeacherSchedules } from "@/hooks/useTeacherData";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { WEEKDAY_NAMES, WEEKDAY_NAMES_MON_FIRST } from "@/lib/weekday-utils";
import WeekRun, { type RunDay } from "@/components/school-admin/schedule/WeekRun";
import { naturalSort } from "@/components/school-admin/schedule/utils";
import { formatGradeBadge, formatSectionLabel } from "@/components/school-admin/student-utils";
import Timetable, { Agenda } from "@/components/teacher/classes/Timetable";
import ClassList, { type ClassEntry } from "@/components/teacher/classes/ClassList";
import { buildPeriods, minutesOf, periodKey, startOf, type ClassRow, type Sched } from "@/components/teacher/classes/utils";
import { clock, plural, toMin } from "@/components/teacher/overview/utils";
import "@/components/school-admin/overview.css"; // hero meta + refresh button
import "@/components/school-admin/students.css"; // chips
import "@/components/school-admin/schedule/schedule.css"; // week track, timetable grid, subject hues
import "@/components/teacher/classes/classes.css";

type Tab = "timetable" | "classes";
const GRID_DAYS = WEEKDAY_NAMES_MON_FIRST.slice(0, 6); // Monday to Saturday; Sunday only when something is scheduled

export default function ClassesPage() {
  const { selectedSchool, schools } = useTeacherSchool();
  const queryClient = useQueryClient();
  // Always every assigned school: the school choice below narrows the view here, so picking another school never lands on data that was never fetched.
  const classesQ = useTeacherClasses();
  const schedulesQ = useTeacherSchedules();

  const [tab, setTab] = useState<Tab>("timetable");
  const [focus, setFocus] = useState("all");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  // The school choice follows the school picked in the top bar until you choose one here; changing the top bar resets it.
  const activeKey = selectedSchool?.id ?? "all";
  const [pick, setPick] = useState<{ forActive: string; value: string } | null>(null);
  const school = pick?.forActive === activeKey ? pick.value : activeKey;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowDate = new Date(now);
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const today = WEEKDAY_NAMES[nowDate.getDay()];

  const retry = () => { void classesQ.refetch(); void schedulesQ.refetch(); };
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["teacher", "schedules"] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] }),
    ]);
  };
  useSmartRefresh({ queryKeys: [["teacher", "schedules", undefined], ["teacher", "classes", undefined]], minRefreshInterval: 60000 });

  const allSchedules = useMemo<Sched[]>(() => (Array.isArray(schedulesQ.data) ? schedulesQ.data : []), [schedulesQ.data]);
  const allClasses = useMemo<ClassRow[]>(() => (Array.isArray(classesQ.data) ? classesQ.data : []), [classesQ.data]);

  /* ───────── narrowing: school, grade, section ───────── */
  const inSchool = (id?: string | null) => school === "all" || String(id ?? "") === school;
  const inGrade = (g?: string | null) => grade === "all" || g === grade;
  const inSection = (s?: string | null) => section === "all" || (s ?? "") === section;

  const grades = useMemo(() => [...new Set([...allSchedules.map((s) => s.grade), ...allClasses.map((c) => c.grade)].filter((g): g is string => !!g))].sort(naturalSort), [allSchedules, allClasses]);
  const sections = useMemo(
    () => [...new Set([...allSchedules, ...allClasses].filter((x) => grade === "all" || x.grade === grade).map((x) => x.section).filter((s): s is string => !!s))].sort(naturalSort),
    [allSchedules, allClasses, grade],
  );

  const base = useMemo(
    () => allSchedules.filter((s) => inSchool(s.school_id) && inGrade(s.grade) && inSection(s.section)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the three predicates only close over school, grade and section
    [allSchedules, school, grade, section],
  );
  const classes = useMemo(
    () => allClasses.filter((c) => inSchool(c.school_id) && inGrade(c.grade) && inSection(c.section)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same
    [allClasses, school, grade, section],
  );
  const filtered = school !== (selectedSchool?.id ?? "all") || grade !== "all" || section !== "all";

  /* ───────── the week ───────── */
  const hasSunday = base.some((s) => s.day_of_week === "Sunday");
  const dayNames = hasSunday ? WEEKDAY_NAMES_MON_FIRST : GRID_DAYS;
  const runDays: RunDay[] = dayNames.map((d) => ({ name: d, count: base.filter((s) => s.day_of_week === d).length, open: true, today: d === today }));
  const busiest = runDays.reduce<RunDay | null>((a, d) => (d.count > (a?.count ?? 0) ? d : a), null);
  const weekMinutes = base.reduce((n, s) => n + minutesOf(s), 0);

  const shown = useMemo(() => (focus === "all" ? base : base.filter((s) => s.day_of_week === focus)), [base, focus]);
  const merge = school === "all" && schools.length > 1;
  const periods = useMemo(() => buildPeriods(shown, merge), [shown, merge]);
  const gridDays = focus === "all" ? dayNames : [focus];
  const cell = (day: string, key: string) => shown.filter((s) => s.day_of_week === day && periodKey(s, merge) === key);
  const dayRows = (day: string) => shown.filter((s) => s.day_of_week === day).sort((a, b) => startOf(a).localeCompare(startOf(b)));
  const showSchool = school === "all" && schools.length > 1;

  const todayRows = base.filter((s) => s.day_of_week === today).sort((a, b) => startOf(a).localeCompare(startOf(b)));
  const nextToday = todayRows.find((s) => toMin(startOf(s)) > nowMin);

  /* ───────── classes ───────── */
  const entries = useMemo<ClassEntry[]>(() => {
    const seen = new Set<string>();
    const out: ClassEntry[] = [];
    classes.forEach((c, i) => {
      const key = c.id ?? `${i}-${c.grade}-${c.section}`;
      if (seen.has(key)) return;
      seen.add(key);
      const mine = base.filter((s) => s.grade === c.grade && (s.section ?? "") === (c.section ?? "") && (!c.school_id || !s.school_id || c.school_id === s.school_id));
      const subjects = [...new Set(mine.map((s) => s.subject).filter((x): x is string => !!x))];
      if (subjects.length === 0 && c.subject) subjects.push(c.subject);
      out.push({ key, grade: c.grade ?? "", section: c.section ?? "", school: c.school_name ?? "", subjects, periods: mine.length, active: c.is_active !== false });
    });
    return out;
  }, [classes, base]);
  const gradeCount = new Set(classes.map((c) => c.grade).filter(Boolean)).size;

  /* ───────── copy ───────── */
  const loading = classesQ.isLoading || schedulesQ.isLoading;
  const failed = classesQ.error || schedulesQ.error;
  const schoolName = school === "all" ? "All your schools" : schools.find((s) => s.id === school)?.name ?? "Your school";
  const lastRefresh = Math.max(classesQ.dataUpdatedAt || 0, schedulesQ.dataUpdatedAt || 0);

  let status: React.ReactNode;
  if (failed) status = "Your classes did not load. Try again.";
  else if (loading) status = "Loading your timetable…";
  else if (classes.length === 0 && base.length === 0) status = filtered ? "Nothing matches these choices." : "No classes are assigned to you yet.";
  else status = <><strong>{plural(classes.length, "class", "classes")}</strong> and <strong>{plural(base.length, "period")}</strong> a week{filtered ? ", with your choices applied" : ""}.</>;

  const ledger = [
    { label: "Classes", value: String(classes.length), hint: gradeCount > 0 ? `In ${plural(gradeCount, "grade")}` : "None assigned" },
    { label: "Periods a week", value: String(base.length), hint: weekMinutes > 0 ? `About ${Math.round(weekMinutes / 60)} hours of teaching` : "Nothing on the timetable" },
    {
      label: "Today",
      value: String(todayRows.length),
      hint: todayRows.length === 0 ? "No periods today" : nextToday ? `Next: ${nextToday.subject ?? "class"} at ${clock(toMin(startOf(nextToday)))}` : "Done for today",
    },
    { label: "Busiest day", value: busiest ? busiest.name : "–", hint: busiest ? plural(busiest.count, "period") : "Nothing yet", text: true },
  ];

  const firstStart = periods.length > 0 ? toMin(periods[0].start) : NaN;
  const lastEnd = periods.length > 0 ? toMin(periods[periods.length - 1].end) : NaN;
  const daySpan = focus === "all" && Number.isFinite(firstStart) && Number.isFinite(lastEnd) ? `, ${clock(firstStart)} to ${clock(lastEnd)}` : "";

  const clearAll = () => {
    setPick({ forActive: activeKey, value: activeKey });
    setGrade("all");
    setSection("all");
    setFocus("all");
  };

  const toTimetable = (g: string, s: string) => {
    setGrade(g || "all");
    setSection(s || "all");
    setFocus("all");
    setTab("timetable");
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "timetable", label: "Timetable", count: base.length },
    { id: "classes", label: "Classes", count: classes.length },
  ];

  if (schools.length === 0) {
    return (
      <div className="sd-page">
        <section className="sd-panel">
          <div className="sd-empty"><b>No school assigned</b><p>You are not assigned to any school yet. Ask your admin to add you to one.</p></div>
        </section>
      </div>
    );
  }

  const refreshing = classesQ.isFetching || schedulesQ.isFetching;
  const nothing = !loading && !failed && classes.length === 0 && base.length === 0;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="cl-title">
        <div className="sd-hero-copy">
          <h1 id="cl-title" className="mc-hero-title">My classes</h1>
          <p className="sd-where">{schoolName}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <Link href="/lms/teacher/reports" className="sd-btn sd-btn--amber"><FileText aria-hidden="true" />Submit report</Link>
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={refresh} disabled={refreshing} aria-label={refreshing ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            {lastRefresh > 0 && <p className="cl-updated" style={{ alignSelf: "center", margin: 0 }}>Updated {new Date(lastRefresh).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
          </div>
        </div>
        {loading ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : failed ? (
          <div className="sd-run-card cl-run-empty">
            <b>Your week did not load</b>
            <button className="sd-btn sd-btn--amber" onClick={retry}>Try again</button>
          </div>
        ) : (
          <WeekRun days={runDays} focus={focus} onFocus={(d) => { setFocus(d); setTab("timetable"); }} total={base.length} />
        )}
      </section>

      <div className="sd-ledger cl-ledger" role="group" aria-label="Your teaching load">
        {ledger.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {loading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className={m.text || failed ? "cl-text" : undefined}>{failed ? "–" : m.value}</b>}
            <small>{failed ? " " : m.hint}</small>
          </div>
        ))}
      </div>

      <div className="cl-bar">
        <div className="mc-tabs" role="tablist" aria-label="Views">
          {tabs.map((t) => (
            <button key={t.id} role="tab" id={`cl-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`cl-panel-${t.id}`} className="mc-tab" onClick={() => setTab(t.id)}>
              {t.label}<b>{loading || failed ? "–" : t.count}</b>
            </button>
          ))}
        </div>
        <div className="cl-filters" role="group" aria-label="Narrow down">
          {schools.length > 1 && (
            <select className="mc-select" aria-label="School" value={school} onChange={(e) => setPick({ forActive: activeKey, value: e.target.value })}>
              <option value="all">All schools</option>
              {schools.map((s) => <option key={s.id} value={s.id ?? ""}>{s.name}</option>)}
            </select>
          )}
          <select className="mc-select" aria-label="Grade" value={grade} onChange={(e) => { setGrade(e.target.value); setSection("all"); }}>
            <option value="all">All grades</option>
            {grades.map((g) => <option key={g} value={g}>{formatGradeBadge(g)}</option>)}
          </select>
          <select className="mc-select" aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} disabled={sections.length === 0}>
            <option value="all">All sections</option>
            {sections.map((s) => <option key={s} value={s}>{formatSectionLabel(s)}</option>)}
          </select>
          {(filtered || focus !== "all") && <button type="button" className="cl-clear" onClick={clearAll}>Clear choices</button>}
        </div>
      </div>

      <div role="tabpanel" id={`cl-panel-${tab}`} aria-labelledby={`cl-tab-${tab}`} className="mc-swap" key={tab}>
        {failed ? (
          <section className="sd-panel">
            <div className="sd-empty">
              <b>Could not load your classes</b>
              <p>Your classes or timetable did not load. Check your connection and try again.</p>
              <button className="sd-btn sd-btn--ink" onClick={retry}>Try again</button>
            </div>
          </section>
        ) : loading ? (
          <section className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></section>
        ) : nothing ? (
          <section className="sd-panel">
            <div className="sd-empty">
              <b>{filtered ? "No classes match" : "No classes assigned yet"}</b>
              <p>{filtered ? "Nothing fits the school, grade and section you picked." : "Your school admin assigns classes and builds the timetable. They will show up here."}</p>
              {filtered && <button className="sd-btn sd-btn--line" onClick={clearAll}>Clear choices</button>}
            </div>
          </section>
        ) : tab === "timetable" ? (
          shown.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>{focus !== "all" ? `Nothing on ${focus}` : "Nothing on the timetable yet"}</b>
                <p>{focus !== "all" ? "You have no periods that day." : "Your classes are assigned, but no periods are scheduled for them."}</p>
                {focus !== "all" && <button className="sd-btn sd-btn--line" onClick={() => setFocus("all")}>Show the whole week</button>}
              </div>
            </section>
          ) : (
            <section className="sd-panel cl-gridwrap" aria-labelledby="cl-tt">
              <div className="sd-panel-head">
                <div>
                  <h2 id="cl-tt">{focus === "all" ? "Your week" : focus}</h2>
                  <p>
                    {plural(shown.length, "period")}
                    {daySpan}
                    {todayRows.length > 0 ? ". Today's classes open their report." : ""}
                  </p>
                </div>
              </div>
              <div className="cl-wide">
                <Timetable periods={periods} days={gridDays} cell={cell} today={today} nowMin={nowMin} showSchool={showSchool} />
              </div>
              <div className="cl-narrow">
                <Agenda days={gridDays} rows={dayRows} today={today} nowMin={nowMin} showSchool={showSchool} />
              </div>
            </section>
          )
        ) : (
          <section className="sd-panel as-list" aria-labelledby="cl-list">
            <div className="sd-panel-head" style={{ margin: 0, padding: "1.25rem 1.25rem 0.9rem" }}>
              <div><h2 id="cl-list">Assigned classes</h2><p>{filtered ? `${classes.length} of ${allClasses.length} shown` : "Write a report or see where a class sits in your week."}</p></div>
            </div>
            <ClassList rows={entries} onTimetable={toTimetable} />
          </section>
        )}
      </div>
    </div>
  );
}

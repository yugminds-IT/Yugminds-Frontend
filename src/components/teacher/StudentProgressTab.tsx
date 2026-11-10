"use client";

import { useMemo, useState } from "react";
import { CheckCircle, ChevronDown, Clock, PlayCircle, RefreshCw } from "lucide-react";
import { useTeacherStudentProgress, type StudentProgressData } from "../../hooks/useStudentProgress";
import { ChipGroup, Pager, initialsOf } from "../portal/notifications";
import ProgressRun, { STAGE_LABEL, stageOf, type Stage } from "../school-admin/progress/ProgressRun";
import { formatSectionLabel } from "../school-admin/student-utils";
import { classLabel, plural } from "./overview/utils";
import "../school-admin/students.css"; // chips, who button
import "../school-admin/teachers.css"; // progress bar
import "../school-admin/progress/progress.css"; // track, rows, detail
import "./studentProgress.css";

const PAGE_SIZE = 25;
type Tab = "students" | "courses" | "sections";
type Sort = "name" | "high" | "low" | "recent" | "stale";
type Known = { sections: string[]; courses: { id: string; name: string }[] };

const SORTS: Record<Sort, { label: string; key: keyof StudentProgressData; dir: 1 | -1 }> = {
  name: { label: "Name, A to Z", key: "full_name", dir: 1 },
  high: { label: "Progress, highest first", key: "average_progress", dir: -1 },
  low: { label: "Progress, lowest first", key: "average_progress", dir: 1 },
  recent: { label: "Most recently active", key: "last_activity", dir: -1 },
  stale: { label: "Least recently active", key: "last_activity", dir: 1 },
};

const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

function activeLabel(value: Date | string | null | undefined): string {
  if (!value) return "Not active yet";
  const d = new Date(value);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return "Not active yet";
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days} days ago`;
  return `Active ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

const courseState = (status: string) =>
  status === "completed" ? { Icon: CheckCircle, text: "Finished" } : status === "in_progress" ? { Icon: PlayCircle, text: "In progress" } : { Icon: Clock, text: "Not started" };

/** How far the students in your sections have got, as a track you can filter by, and the same numbers by course and section. */
export default function StudentProgressTab({ selectedSchoolId, schoolName }: { selectedSchoolId?: string; schoolName?: string }) {
  const [tab, setTab] = useState<Tab>("students");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [course, setCourse] = useState("all");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [sort, setSort] = useState<Sort>("name");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  // The server narrows the list as you filter, so the choices are remembered from everything seen.
  const [known, setKnown] = useState<Known>({ sections: [], courses: [] });

  const { data, isLoading, isFetching, error, refetch } = useTeacherStudentProgress(selectedSchoolId, {
    courseId: course !== "all" ? course : undefined,
    section: section !== "all" ? section : undefined,
  });
  const students = useMemo(() => data?.students ?? [], [data]);
  const summary = data?.summary;

  // Remember the choices when new data arrives (done while rendering, which React allows for derived state).
  const [seenData, setSeenData] = useState<typeof data>(undefined);
  if (data !== seenData) {
    setSeenData(data);
    setKnown((prev) => {
      const sections = [...new Set([...prev.sections, ...students.map((s) => s.section ?? "").filter(Boolean)])];
      const courses = new Map(prev.courses.map((c) => [c.id, c]));
      students.forEach((s) => s.courses?.forEach((c) => { if (!courses.has(c.course_id)) courses.set(c.course_id, { id: c.course_id, name: c.course_name }); }));
      return sections.length === prev.sections.length && courses.size === prev.courses.length ? prev : { sections: sections.sort(byNumber), courses: [...courses.values()] };
    });
  }

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { none: 0, started: 0, half: 0, done: 0 };
    students.forEach((s) => { c[stageOf(s.average_progress ?? 0)] += 1; });
    return c;
  }, [students]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { key, dir } = SORTS[sort];
    return students
      .filter((s) => (!q || s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)) && (stage === "all" || stageOf(s.average_progress ?? 0) === stage))
      .sort((a, b) => {
        let av: string | number = key === "last_activity" ? (a.last_activity ? +new Date(a.last_activity) : 0) : ((a[key] as string | number | null | undefined) ?? "");
        let bv: string | number = key === "last_activity" ? (b.last_activity ? +new Date(b.last_activity) : 0) : ((b[key] as string | number | null | undefined) ?? "");
        if (typeof av === "string") { av = av.toLowerCase(); bv = String(bv).toLowerCase(); }
        return av === bv ? 0 : av > bv ? dir : -dir;
      });
  }, [students, search, stage, sort]);

  // Changing any filter or the sort goes back to page 1.
  const filterKey = `${search}|${stage}|${sort}|${section}|${course}`;
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Courses and sections, worked out from the students you can see
  const courseRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; chapters: number; enrolled: number; finished: number; going: number; sum: number }>();
    students.forEach((s) => s.courses?.forEach((c) => {
      const r = map.get(c.course_id) ?? { id: c.course_id, name: c.course_name, chapters: c.total_chapters, enrolled: 0, finished: 0, going: 0, sum: 0 };
      r.enrolled += 1;
      r.sum += c.progress_percentage ?? 0;
      if (c.status === "completed") r.finished += 1;
      else if (c.status === "in_progress") r.going += 1;
      map.set(c.course_id, r);
    }));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const sectionRows = useMemo(() => {
    const map = new Map<string, { grade: string; section: string; students: number; finished: number; sum: number }>();
    for (const s of students) {
      const key = `${s.grade}\0${s.section ?? ""}`;
      const r = map.get(key) ?? { grade: s.grade, section: s.section ?? "", students: 0, finished: 0, sum: 0 };
      r.students += 1;
      r.sum += s.average_progress ?? 0;
      if ((s.average_progress ?? 0) >= 100) r.finished += 1;
      map.set(key, r);
    }
    return [...map.values()].map((r) => ({ ...r, label: classLabel(r.grade, r.section) || "No class", avg: r.students ? Math.round(r.sum / r.students) : 0 })).sort((a, b) => byNumber(a.label, b.label));
  }, [students]);

  const hasFilters = !!search || section !== "all" || course !== "all" || stage !== "all";
  const clearFilters = () => { setSearch(""); setSection("all"); setCourse("all"); setStage("all"); };
  const total = summary?.total_students ?? 0;
  const finished = summary?.students_completed ?? 0;
  const avg = summary ? Math.round(summary.average_school_progress ?? summary.average_system_progress ?? 0) : null;

  let status: React.ReactNode;
  if (error) status = "The progress numbers did not load. Try again.";
  else if (isLoading) status = "Loading progress…";
  else if (total === 0) status = hasFilters ? "No students match these choices." : "No students are in your sections yet.";
  else status = <><strong>{avg ?? 0}%</strong> is your class average. {finished} of {total} {total === 1 ? "student has" : "students have"} finished everything{counts.none > 0 ? <>, and {counts.none} {counts.none === 1 ? "has" : "have"} not started</> : null}.</>;

  const tiles = [
    { label: "Students", value: total, hint: "In your sections" },
    { label: "Started", value: summary?.students_with_progress ?? 0, hint: "Opened at least one course" },
    { label: "Finished", value: finished, hint: "Completed every course" },
    { label: "Courses", value: summary?.total_courses ?? 0, hint: "Your students are on" },
  ];

  return (
    <div className="sd-page tp">
      <section className="sd-hero mc-band" aria-labelledby="sp-title">
        <div className="sd-hero-copy">
          <h1 id="sp-title" className="mc-hero-title">Student progress</h1>
          <p className="sd-where">{schoolName ?? "All your schools"}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "animate-spin" : ""} aria-hidden="true" />{isFetching ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        <ProgressRun counts={counts} selected={stage} onSelect={(s) => { setStage(s); setTab("students"); }} average={avg} averageLabel="class average" />
      </section>

      <div className="sd-ledger" role="group" aria-label="Progress summary">
        {tiles.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{error ? "–" : m.value.toLocaleString("en-IN")}</b>}
            <small>{m.hint}</small>
          </div>
        ))}
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Progress views" style={{ justifySelf: "start" }}>
        {([["students", "Students", rows.length], ["courses", "Courses", courseRows.length], ["sections", "Sections", sectionRows.length]] as const).map(([id, label, n]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<b>{n}</b></button>
        ))}
      </div>

      {error ? (
        <section className="sd-panel">
          <div className="sd-empty"><b>We could not load student progress</b><p>Check your connection, then try again.</p><button className="sd-btn sd-btn--amber" onClick={() => void refetch()}>Try again</button></div>
        </section>
      ) : isLoading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : tab === "students" ? (
        <>
          <div className="sp-bar">
            <input type="search" className="sd-field" placeholder="Search by name or email" aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
            {known.sections.length > 1 && <ChipGroup label="Section" value={section} options={[["all", "All sections"] as const, ...known.sections.map((s) => [s, formatSectionLabel(s)] as const)]} onChange={setSection} />}
            {known.courses.length > 1 && (
              <select className="sd-field" aria-label="Course" value={course} onChange={(e) => setCourse(e.target.value)}>
                <option value="all">All courses</option>
                {known.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <select className="sd-field" aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}
            </select>
            {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
          </div>

          {rows.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>{hasFilters ? "No students match" : "No students in your sections yet"}</b>
                <p>{hasFilters ? "Try a different search, or clear the filters." : "You see the students in the sections your admin assigned to you. They show up here once they start a course."}</p>
                {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
              </div>
            </section>
          ) : (
            <section className="sd-panel as-list mc-swap" aria-label="Students">
              <div className="sp-row sp-head">
                <span /><span>Student</span><span>Class</span><span>Courses</span><span>Progress</span><span>Last active</span><span />
              </div>
              {pageRows.map((s) => {
                const open = expanded === s.student_id;
                const pct = Math.round(s.average_progress ?? 0);
                const cls = classLabel(s.grade, s.section);
                return (
                  <div key={s.student_id} className="sp-item">
                    <article className="sp-row">
                      <span className="sd-avatar" aria-hidden="true">{initialsOf(s.full_name || s.email)}</span>
                      <button className="sm-who" onClick={() => setExpanded(open ? null : s.student_id)} aria-expanded={open}>
                        <b>{s.full_name || "Unnamed student"}</b>
                        <small>{s.email}</small>
                      </button>
                      <span className="sm-chip" data-class={cls ? "true" : undefined}>{cls || "No class"}</span>
                      <span className="sp-courses">{s.completed_courses ?? 0} of {s.total_courses ?? 0} finished{(s.in_progress_courses ?? 0) > 0 && <small>{s.in_progress_courses} in progress</small>}</span>
                      <span className="sp-prog" data-stage={stageOf(pct)}>
                        <b>{pct}% <small className="sm-muted" style={{ fontFamily: "var(--sd-body)", fontWeight: 600, fontSize: "0.8rem" }}>{STAGE_LABEL[stageOf(pct)].toLowerCase()}</small></b>
                        <i className="tm-bar" aria-hidden="true"><u style={{ width: `${pct}%` }} /></i>
                      </span>
                      <span className="sp-active">{activeLabel(s.last_activity)}</span>
                      <button className="pl-ico" onClick={() => setExpanded(open ? null : s.student_id)} aria-label={`${open ? "Hide" : "Show"} courses for ${s.full_name}`} aria-expanded={open}>
                        <ChevronDown style={{ transition: "rotate 0.2s ease", rotate: open ? "180deg" : "0deg" }} />
                      </button>
                    </article>
                    {open && (
                      <div className="sp-detail">
                        {s.courses?.length ? (
                          <ol aria-label={`Courses for ${s.full_name}`}>
                            {s.courses.map((c) => {
                              const st = courseState(c.status);
                              const cp = Math.round(c.progress_percentage ?? 0);
                              return (
                                <li key={c.course_id}>
                                  <b>{c.course_name}</b>
                                  <span className="sp-chap">{c.completed_chapters} of {c.total_chapters} chapters</span>
                                  <span className="sp-prog" data-stage={stageOf(cp)}><b>{cp}%</b><i className="tm-bar" aria-hidden="true"><u style={{ width: `${cp}%` }} /></i></span>
                                  <span className="sp-state"><st.Icon aria-hidden="true" />{st.text}</span>
                                </li>
                              );
                            })}
                          </ol>
                        ) : <p className="sm-muted">No course data for this student yet.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              <Pager offset={(page - 1) * PAGE_SIZE} count={pageRows.length} total={rows.length} pageSize={PAGE_SIZE} onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(page + 1)} />
            </section>
          )}
        </>
      ) : tab === "courses" ? (
        courseRows.length === 0 ? (
          <section className="sd-panel"><div className="sd-empty"><b>No courses yet</b><p>Courses your students are enrolled in show up here with how far they have got.</p></div></section>
        ) : (
          <section className="sd-panel as-list mc-swap" aria-label="Progress by course">
            {courseRows.map((c) => {
              const avgC = c.enrolled ? Math.round(c.sum / c.enrolled) : 0;
              const rate = c.enrolled ? Math.round((c.finished / c.enrolled) * 100) : 0;
              return (
                <article key={c.id} className="sp-crow">
                  <b>{c.name}</b>
                  <span className="sm-chip" data-class="true">{plural(c.chapters, "chapter")}</span>
                  <span className="sp-nums">
                    <span className="sp-num">{c.enrolled}<small>enrolled</small></span>
                    <span className="sp-num">{c.going}<small>in progress</small></span>
                    <span className="sp-num">{c.finished}<small>finished</small></span>
                  </span>
                  <span className="sp-pct sp-avg"><b>{avgC}%</b><i className="tm-bar" aria-hidden="true"><u style={{ width: `${avgC}%` }} /></i><small>average progress</small></span>
                  <span className="sp-pct sp-rate"><b>{rate}%</b><i className="tm-bar" aria-hidden="true"><u style={{ width: `${rate}%` }} /></i><small>finished the course</small></span>
                </article>
              );
            })}
          </section>
        )
      ) : sectionRows.length === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No sections yet</b><p>Once students are in your sections, you will see how each one is doing here.</p></div></section>
      ) : (
        <section className="sd-panel as-list mc-swap" aria-label="Progress by section">
          {sectionRows.map((g) => (
            <article key={g.label} className="sp-grow">
              <b>{g.label}</b>
              <span className="sp-nums">
                <span className="sp-num">{g.students}<small>students</small></span>
                <span className="sp-num">{g.finished}<small>finished</small></span>
                <span className="sp-num">{g.students - g.finished}<small>still going</small></span>
              </span>
              <span className="sp-pct"><b>{g.avg}%</b><i className="tm-bar" aria-hidden="true"><u style={{ width: `${g.avg}%` }} /></i><small>average progress</small></span>
              <button className="sd-btn sd-btn--line" onClick={() => { setSection(g.section || "all"); setTab("students"); }} aria-label={`See the students in ${g.label}`}>See students</button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

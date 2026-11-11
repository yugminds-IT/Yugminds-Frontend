"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Pager } from "@/components/portal/notifications";
import ProgressRun from "@/components/admin/progress/ProgressRun";
import StudentsTab from "@/components/admin/progress/StudentsTab";
import BreakdownTab, { type Item } from "@/components/admin/progress/BreakdownTab";
import { WEEK, STAGE_LABEL, average, gradeLabel, groupBy, plural, toRows, type Row, type Stage } from "@/components/admin/progress/utils";
import { useAdminStudentProgress } from "@/hooks/useStudentProgress";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/progress/progress.css";

type Tab = "students" | "schools" | "courses" | "grades";
const TABS: [Tab, string][] = [["students", "Students"], ["schools", "Schools"], ["courses", "Courses"], ["grades", "Grades"]];

type Sort = "name" | "high" | "low" | "recent" | "school";
const SORTS: [Sort, string][] = [["name", "Name, A to Z"], ["high", "Most progress first"], ["low", "Least progress first"], ["recent", "Most recently active"], ["school", "School, A to Z"]];

const PAGE_SIZE = 50;
const COMPARE = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const sorters: Record<Sort, (a: Row, b: Row) => number> = {
  name: (a, b) => COMPARE(a.name, b.name),
  high: (a, b) => b.progress - a.progress || COMPARE(a.name, b.name),
  low: (a, b) => a.progress - b.progress || COMPARE(a.name, b.name),
  recent: (a, b) => b.lastMs - a.lastMs || COMPARE(a.name, b.name),
  school: (a, b) => COMPARE(a.school, b.school) || COMPARE(a.name, b.name),
};

export default function CourseProgressPage() {
  // Everything is fetched once and filtered here, so the school, grade, section and course lists, every tab
  // and every number describe the same students (the old page only ever saw the current page of 50).
  const { data, isLoading, isFetching, error, refetch } = useAdminStudentProgress({ limit: 5000, offset: 0 });
  const [now] = useState(() => Date.now());

  const [tab, setTab] = useState<Tab>("students");
  const [stage, setStage] = useState<Stage | null>(null);
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [courseId, setCourseId] = useState("");
  const [recent, setRecent] = useState(false);
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const students = useMemo(() => data?.students ?? [], [data]);
  const courseMeta = useMemo(() => new Map((data?.courses ?? []).map((c) => [c.course_id, c])), [data]);

  const all = useMemo(() => toRows(students, courseId), [students, courseId]);

  // Filter lists come from every student, narrowed by the choices before them (school, then grade).
  const schoolOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) if (s.school_id) m.set(s.school_id, s.school_name || "School");
    return [...m.entries()].sort((a, b) => COMPARE(a[1], b[1]));
  }, [students]);
  const gradeOptions = useMemo(
    () => [...new Set(students.filter((s) => !schoolId || s.school_id === schoolId).map((s) => s.grade).filter(Boolean))].sort(COMPARE),
    [students, schoolId],
  );
  const sectionOptions = useMemo(
    () => [...new Set(students.filter((s) => (!schoolId || s.school_id === schoolId) && (!grade || s.grade === grade)).map((s) => s.section ?? "").filter(Boolean))].sort(COMPARE),
    [students, schoolId, grade],
  );
  const courseOptions = useMemo(
    () => [...(data?.courses ?? [])].sort((a, b) => COMPARE(a.course_name, b.course_name)),
    [data],
  );

  // Everything except the stage, so the track can show how the current view splits across the stages.
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!schoolId || r.schoolId === schoolId) &&
        (!grade || r.grade === grade) &&
        (!section || r.section === section) &&
        (!recent || r.lastMs > now - WEEK) &&
        (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.school.toLowerCase().includes(q)),
    );
  }, [all, schoolId, grade, section, recent, search, now]);

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { none: 0, idle: 0, going: 0, done: 0 };
    for (const r of base) c[r.stage] += 1;
    return c;
  }, [base]);

  const shown = useMemo(() => (stage ? base.filter((r) => r.stage === stage) : base).slice().sort(sorters[sort]), [base, stage, sort]);

  const lastPage = Math.max(0, Math.ceil(shown.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const pageRows = shown.slice(at * PAGE_SIZE, (at + 1) * PAGE_SIZE);

  const schoolItems = useMemo<Item[]>(
    () =>
      groupBy(shown, (r) => r.schoolId, (k) => schoolOptions.find(([id]) => id === k)?.[1] ?? "No school")
        .sort((a, b) => b.students - a.students || COMPARE(a.name, b.name))
        .map((g) => ({ key: g.key, name: g.name, facts: [{ label: "Students", value: g.students }, { label: "Enrolled", value: g.enrolled }, { label: "Finished", value: g.finished }], pct: g.avg, pctLabel: "Average progress" })),
    [shown, schoolOptions],
  );
  const gradeItems = useMemo<Item[]>(
    () =>
      groupBy(shown, (r) => r.grade, (k) => gradeLabel(k) || "No grade")
        .sort((a, b) => COMPARE(a.key, b.key))
        .map((g) => ({ key: g.key, name: g.name, facts: [{ label: "Students", value: g.students }, { label: "Enrolled", value: g.enrolled }, { label: "Finished", value: g.finished }], pct: g.avg, pctLabel: "Average progress" })),
    [shown],
  );
  const courseItems = useMemo<Item[]>(() => {
    const m = new Map<string, { name: string; enrolled: number; finished: number; sum: number }>();
    for (const r of shown) {
      for (const c of r.courses) {
        const e = m.get(c.course_id) ?? { name: c.course_name || "Untitled course", enrolled: 0, finished: 0, sum: 0 };
        e.enrolled += 1;
        e.finished += c.status === "completed" ? 1 : 0;
        e.sum += c.progress_percentage ?? 0;
        m.set(c.course_id, e);
      }
    }
    return [...m.entries()]
      .sort((a, b) => b[1].enrolled - a[1].enrolled || COMPARE(a[1].name, b[1].name))
      .map(([key, e]) => {
        const chapters = courseMeta.get(key)?.total_chapters;
        return { key, name: e.name, sub: chapters != null ? plural(chapters, "chapter") : undefined, facts: [{ label: "Enrolled", value: e.enrolled }, { label: "Finished", value: e.finished }], pct: Math.round(e.sum / e.enrolled), pctLabel: "Average progress" };
      });
  }, [shown, courseMeta]);

  const hasFilters = !!(stage || search || schoolId || grade || section || courseId || recent);
  const clearFilters = () => {
    setStage(null); setSearch(""); setSchoolId(""); setGrade(""); setSection(""); setCourseId(""); setRecent(false); setPage(0);
  };
  const pickStage = (s: Stage | null) => { setStage(s); setPage(0); setOpenId(null); setTab("students"); };
  const openGroup = (kind: "school" | "grade" | "course", key: string) => {
    if (kind === "school") { setSchoolId(key); setGrade(""); setSection(""); }
    if (kind === "grade") { setGrade(key); setSection(""); }
    if (kind === "course") setCourseId(key);
    setPage(0);
    setOpenId(null);
    setTab("students");
  };

  const avg = average(base);
  const enrolledCount = base.length - counts.none;
  const dash = !!error && !data;
  const loading = isLoading;

  let statusLine: React.ReactNode;
  if (dash) statusLine = "Some numbers did not load. Try refreshing.";
  else if (loading) statusLine = "Checking progress…";
  else if (students.length === 0) statusLine = "No students on the platform yet.";
  else if (base.length === 0) statusLine = "No students match these filters.";
  else if (enrolledCount === 0) statusLine = <><strong>No one is enrolled in a course yet.</strong> Enroll students from a school&apos;s course settings.</>;
  else statusLine = <><strong>{avg}% average progress</strong> across {plural(enrolledCount, "enrolled student")}.{counts.none > 0 && <> {counts.none} {counts.none === 1 ? "has" : "have"} no course yet.</>}</>;

  const runCaption = loading ? "Loading…" : enrolledCount > 0 ? `${avg}% average progress` : "Nothing started yet";
  const truncated = data?.pagination && data.pagination.total > students.length;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ps-title">
        <div className="sd-hero-copy">
          <h1 id="ps-title" className="mc-hero-title">Course progress</h1>
          <p className="sd-where">How students are doing in every school</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <Link className="sd-btn sd-btn--amber" href="/lms/admin/courses">Manage courses</Link>
            {counts.none > 0 && stage !== "none" && (
              <button className="sd-btn sd-btn--ghost-dark" onClick={() => pickStage("none")}>Show {plural(counts.none, "student")} with no course</button>
            )}
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => void refetch()} disabled={isFetching} aria-label={isFetching ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={isFetching ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <ProgressRun counts={counts} selected={stage} onSelect={pickStage} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Progress numbers">
        <button type="button" aria-pressed={!hasFilters} onClick={clearFilters}>
          <span className="sd-l">Students</span><b className="sd-n">{dash || loading ? "–" : base.length}</b><small>{dash ? "Not loaded" : loading ? " " : hasFilters ? "In this view" : `${plural(schoolOptions.length, "school")} on the platform`}</small>
        </button>
        <button type="button" aria-pressed={false} onClick={() => setTab("schools")}>
          <span className="sd-l">Average progress</span><b className="sd-n">{dash || loading ? "–" : `${avg}%`}</b><small>{dash ? "Not loaded" : loading ? " " : "Of enrolled students"}</small>
        </button>
        <button type="button" aria-pressed={stage === "done"} onClick={() => pickStage(stage === "done" ? null : "done")}>
          <span className="sd-l">Finished every course</span><b className="sd-n">{dash || loading ? "–" : counts.done}</b><small>{dash ? "Not loaded" : loading ? " " : counts.done > 0 ? "Tap to see who" : "No one yet"}</small>
        </button>
        <button type="button" aria-pressed={recent} onClick={() => { setRecent(!recent); setPage(0); setTab("students"); }}>
          <span className="sd-l">Active this week</span><b className="sd-n">{dash || loading ? "–" : base.filter((r) => r.lastMs > now - WEEK).length}</b><small>{dash ? "Not loaded" : loading ? " " : "Opened a lesson in the last 7 days"}</small>
        </button>
      </div>

      {students.length > 0 && (
        <div className="ps-bar">
          <div className="sd-search" style={{ flex: "1 1 16rem", maxWidth: "26rem", width: "auto" }}>
            <Search aria-hidden="true" />
            <input type="search" placeholder="Search by name, email or school" aria-label="Search students" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          {schoolOptions.length > 1 && (
            <select className="sd-field" aria-label="Show one school" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setGrade(""); setSection(""); setPage(0); }}>
              <option value="">All schools</option>
              {schoolOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          {gradeOptions.length > 1 && (
            <select className="sd-field" aria-label="Show one grade" value={grade} onChange={(e) => { setGrade(e.target.value); setSection(""); setPage(0); }}>
              <option value="">All grades</option>
              {gradeOptions.map((g) => <option key={g} value={g}>{gradeLabel(g) || g}</option>)}
            </select>
          )}
          {sectionOptions.length > 1 && (
            <select className="sd-field" aria-label="Show one section" value={section} onChange={(e) => { setSection(e.target.value); setPage(0); }}>
              <option value="">All sections</option>
              {sectionOptions.map((s) => <option key={s} value={s}>Section {s}</option>)}
            </select>
          )}
          {courseOptions.length > 0 && (
            <select className="sd-field" aria-label="Show one course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setPage(0); }}>
              <option value="">All courses</option>
              {courseOptions.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
            </select>
          )}
          {tab === "students" && (
            <select className="sd-field" aria-label="Sort students" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(0); }}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
          {stage && <span className="sm-chip" data-class="true">{STAGE_LABEL[stage]}</span>}
          {recent && <span className="sm-chip" data-class="true">Active this week</span>}
          {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
        </div>
      )}

      <div className="mc-tabs" role="tablist" aria-label="Group progress by" style={{ justifySelf: "start" }}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}{id === "students" && !loading && !dash && <b>{shown.length}</b>}</button>
        ))}
      </div>

      {loading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : dash ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load student progress</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void refetch()}>Try again</button>
          </div>
        </section>
      ) : students.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No students yet</b>
            <p>Progress shows up here once students join a school and are enrolled in courses.</p>
            <Link className="sd-btn sd-btn--amber" href="/lms/admin/students">Go to students</Link>
          </div>
        </section>
      ) : shown.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{courseId && all.length === 0 ? "No one is enrolled in this course" : "No students match"}</b>
            <p>{courseId && all.length === 0 ? "Pick another course, or clear the filters." : "Try a different search, or clear the filters."}</p>
            <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>
          </div>
        </section>
      ) : (
        <>
          {tab === "students" && (
            <>
              <StudentsTab rows={pageRows} now={now} openId={openId} onOpen={setOpenId} />
              <Pager offset={at * PAGE_SIZE} count={pageRows.length} total={shown.length} pageSize={PAGE_SIZE} noun="students" onPrev={() => { setPage(Math.max(0, at - 1)); setOpenId(null); }} onNext={() => { setPage(at + 1); setOpenId(null); }} />
            </>
          )}
          {tab === "schools" && <BreakdownTab items={schoolItems} label="Progress by school" noun="school" active={schoolId} onOpen={(k) => openGroup("school", k)} />}
          {tab === "courses" && (courseItems.length === 0
            ? <section className="sd-panel"><div className="sd-empty"><b>No enrolled courses in this view</b><p>No student here is enrolled in a course yet.</p></div></section>
            : <BreakdownTab items={courseItems} label="Progress by course" noun="course" active={courseId} onOpen={(k) => openGroup("course", k)} />)}
          {tab === "grades" && <BreakdownTab items={gradeItems} label="Progress by grade" noun="grade" active={grade} onOpen={(k) => openGroup("grade", k)} />}
        </>
      )}

      {truncated && <p className="ps-note">Showing the first {students.length} of {data?.pagination.total} students. Filter by school to narrow it down.</p>}
    </div>
  );
}

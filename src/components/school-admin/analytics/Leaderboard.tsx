"use client";

import { useMemo, useState } from "react";
import { ChipGroup, Pager, initialsOf } from "../../portal/notifications";
import { formatGradeBadge, formatSectionLabel } from "../student-utils";
import { BAND_LABEL, pct, studentBand, type Band, type LeaderboardStudent } from "./types";

const PAGE_SIZE = 25;
type Sort = "rank" | "course" | "daily" | "name";
const SORTS: Record<Sort, string> = {
  rank: "School rank",
  course: "Course score, highest first",
  daily: "Daily score, highest first",
  name: "Name, A to Z",
};

const schoolRank = (s: LeaderboardStudent) => s.school_rank ?? s.rank;
const classOf = (s: LeaderboardStudent) => [formatGradeBadge(s.grade), s.section && formatSectionLabel(s.section).replace(/^section\s*/i, "")].filter(Boolean).join(" ");
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const BADGE_LABEL = { GOLD: "Gold", SILVER: "Silver", BRONZE: "Bronze" } as const;

function Bar({ value }: { value: number }) {
  return <i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></i>;
}

export default function Leaderboard({
  students,
  band,
  onBand,
  grade,
  section,
  onGrade,
  onSection,
}: {
  students: LeaderboardStudent[];
  band: Band | "all";
  onBand: (b: Band | "all") => void;
  grade: string;
  section: string;
  onGrade: (g: string) => void;
  onSection: (s: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("rank");
  const [pageState, setPageState] = useState({ key: "", page: 1 });

  const grades = useMemo(() => [...new Set(students.map((s) => s.grade).filter(Boolean))].sort(natural), [students]);
  const sections = useMemo(
    () => [...new Set(students.filter((s) => grade === "all" || s.grade === grade).map((s) => s.section).filter(Boolean))].sort(natural),
    [students, grade],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter(
        (s) =>
          (grade === "all" || s.grade === grade) &&
          (section === "all" || s.section === section) &&
          (band === "all" || studentBand(s) === band) &&
          (!q || s.student_name.toLowerCase().includes(q)),
      )
      .sort((a, b) =>
        sort === "course" ? b.course_assignment_score - a.course_assignment_score
        : sort === "daily" ? b.daily_assignment_score - a.daily_assignment_score
        : sort === "name" ? a.student_name.localeCompare(b.student_name)
        : schoolRank(a) - schoolRank(b),
      );
  }, [students, search, grade, section, band, sort]);

  const filterKey = `${search}|${grade}|${section}|${band}|${sort}`;
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = !!search || grade !== "all" || section !== "all" || band !== "all";
  const clear = () => { setSearch(""); onGrade("all"); onSection("all"); onBand("all"); };

  // Only worth a podium once three students have real scores and nothing is filtered away.
  const top = useMemo(() => [...students].sort((a, b) => schoolRank(a) - schoolRank(b)).slice(0, 3), [students]);
  const podium = !hasFilters && top.length === 3 && top.every((s) => s.overall_score > 0);

  if (students.length === 0) {
    return (
      <section className="sd-panel">
        <div className="sd-empty"><b>No students yet</b><p>Once students join your school and submit work, their ranking shows up here.</p></div>
      </section>
    );
  }

  return (
    <>
      {podium && (
        <ol className="aa-podium" aria-label="Top three students">
          {top.map((s, i) => (
            <li key={s.student_id} data-place={i + 1}>
              <span className="aa-place">{i + 1}</span>
              <span className="sd-avatar" aria-hidden="true">{initialsOf(s.student_name)}</span>
              <b>{s.student_name}</b>
              <small>{classOf(s) || "No class"}</small>
              <span className="aa-podium-score">{pct(s.overall_score)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="aa-bar">
        <input type="search" className="sd-field" placeholder="Search by student name" aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
        {grades.length > 1 && <ChipGroup label="Grade" value={grade} options={[["all", "All grades"] as const, ...grades.map((g) => [g, formatGradeBadge(g)] as const)]} onChange={(g) => { onGrade(g); onSection("all"); }} />}
        {sections.length > 1 && <ChipGroup label="Section" value={section} options={[["all", "All sections"] as const, ...sections.map((s) => [s, formatSectionLabel(s)] as const)]} onChange={onSection} />}
        <select className="sd-field" aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
        </select>
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
      </div>

      {rows.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No students match</b>
            <p>{band !== "all" ? `Nobody is in “${BAND_LABEL[band]}” with these filters.` : "Try a different name, or clear the filters."}</p>
            <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>
          </div>
        </section>
      ) : (
        <section className="sd-panel as-list mc-swap" aria-label="Student ranking">
          <div className="aa-row aa-head">
            <span>Rank</span><span>Student</span><span>Class</span><span>Course</span><span>Daily</span><span>Overall</span><span>Badge</span>
          </div>
          {pageRows.map((s) => {
            const b = studentBand(s);
            const rank = schoolRank(s);
            const ranks = [s.grade_rank != null && `#${s.grade_rank} in grade`, s.section_rank != null && `#${s.section_rank} in section`].filter(Boolean).join(" · ");
            return (
              <article key={s.student_id} className="aa-row aa-item">
                <span className="aa-rank" data-top={rank <= 3 ? rank : undefined} aria-label={`Rank ${rank}`}>{rank}</span>
                <span className="aa-who">
                  <b>{s.student_name}</b>
                  {ranks && <small>{ranks}</small>}
                  <small className="aa-split">Course {s.course_assignment_score ? pct(s.course_assignment_score) : "–"} · Daily {s.daily_assignment_score ? pct(s.daily_assignment_score) : "–"}</small>
                </span>
                <span className="sm-chip" data-class={classOf(s) ? "true" : undefined}>{classOf(s) || "No class"}</span>
                <span className="aa-part" data-empty={!s.course_assignment_score}>{s.course_assignment_score ? pct(s.course_assignment_score) : "–"}</span>
                <span className="aa-part" data-empty={!s.daily_assignment_score}>{s.daily_assignment_score ? pct(s.daily_assignment_score) : "–"}</span>
                <span className="aa-score" data-band={b}>
                  {b === "none" ? <b>No scores yet</b> : <><b>{pct(s.overall_score)}</b><Bar value={s.overall_score} /></>}
                </span>
                <span className="aa-badge-cell">
                  {s.badge !== "NONE" ? <span className="aa-badge" data-badge={s.badge}>{BADGE_LABEL[s.badge]}</span> : <span className="sm-muted">–</span>}
                </span>
              </article>
            );
          })}
          <Pager offset={(page - 1) * PAGE_SIZE} count={pageRows.length} total={rows.length} pageSize={PAGE_SIZE} noun="students" onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(page + 1)} />
        </section>
      )}
    </>
  );
}

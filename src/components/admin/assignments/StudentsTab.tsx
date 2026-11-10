import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Pager, initialsOf } from "../../portal/notifications";
import { formatGradeBadge, formatSectionLabel } from "../../school-admin/student-utils";
import { bandOf, pct, type TopStudent } from "./types";

const PAGE_SIZE = 25;
type Sort = "rank" | "course" | "daily" | "name";
const SORTS: Record<Sort, string> = { rank: "Platform rank", course: "Course score, highest first", daily: "Daily score, highest first", name: "Name, A to Z" };
const BADGE = { GOLD: "Gold", SILVER: "Silver", BRONZE: "Bronze" } as const;
const rankOf = (s: TopStudent) => s.system_rank ?? s.rank;
const classOf = (s: TopStudent) => [formatGradeBadge(s.grade), s.section && formatSectionLabel(s.section).replace(/^section\s*/i, "")].filter(Boolean).join(" ");

/** The best students across every school, ranked together. */
export default function StudentsTab({ students }: { students: TopStudent[] }) {
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [sort, setSort] = useState<Sort>("rank");
  const [pageState, setPageState] = useState({ key: "", page: 1 });

  const schools = useMemo(() => [...new Set(students.map((s) => s.school_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [students]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => (!school || s.school_name === school) && (!q || s.student_name.toLowerCase().includes(q) || s.school_name.toLowerCase().includes(q)))
      .sort((a, b) => (sort === "course" ? b.course_assignment_score - a.course_assignment_score : sort === "daily" ? b.daily_assignment_score - a.daily_assignment_score : sort === "name" ? a.student_name.localeCompare(b.student_name) : rankOf(a) - rankOf(b)));
  }, [students, search, school, sort]);

  const key = `${search}|${school}|${sort}`;
  const page = pageState.key === key ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key, page: p });
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = !!search || !!school;
  const clear = () => { setSearch(""); setSchool(""); };

  const top = useMemo(() => [...students].sort((a, b) => rankOf(a) - rankOf(b)).slice(0, 3), [students]);
  const podium = !filtered && top.length === 3 && top.every((s) => s.overall_score > 0);

  if (students.length === 0) {
    return <section className="sd-panel"><div className="sd-empty"><b>No ranked students yet</b><p>Students appear here once their assignments are graded.</p></div></section>;
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
              <small>{s.school_name || "No school"}{classOf(s) ? `, ${classOf(s)}` : ""}</small>
              <span className="aa-podium-score">{pct(s.overall_score)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="aa-bar">
        <div className="sd-search" style={{ flex: "1 1 14rem", maxWidth: "24rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search by student or school" aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {schools.length > 1 && (
          <select className="sd-field" aria-label="Show one school" value={school} onChange={(e) => setSchool(e.target.value)}>
            <option value="">All schools</option>
            {schools.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <select className="sd-field" aria-label="Sort students" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
        </select>
        {filtered && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
      </div>

      {rows.length === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No students match</b><p>Try a different name, or clear the filters.</p><button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button></div></section>
      ) : (
        <section className="sd-panel as-list mc-swap" aria-label="Student ranking">
          <div className="aa-row aa-head" aria-hidden="true"><span>Rank</span><span>Student</span><span>Class</span><span>Course</span><span>Daily</span><span>Overall</span><span>Badge</span></div>
          {pageRows.map((s) => {
            const rank = rankOf(s);
            const b = bandOf(s.overall_score, s.overall_score > 0 ? 1 : 0);
            return (
              <article key={s.student_id} className="aa-row aa-item">
                <span className="aa-rank" data-top={rank <= 3 ? rank : undefined} aria-label={`Rank ${rank}`}>{rank}</span>
                <span className="aa-who">
                  <b>{s.student_name}</b>
                  <small>{s.school_name || "No school"}</small>
                  <small className="aa-split">Course {s.course_assignment_score ? pct(s.course_assignment_score) : "–"} · Daily {s.daily_assignment_score ? pct(s.daily_assignment_score) : "–"}</small>
                </span>
                <span className="sm-chip" data-class={classOf(s) ? "true" : undefined}>{classOf(s) || "No class"}</span>
                <span className="aa-part" data-empty={!s.course_assignment_score}>{s.course_assignment_score ? pct(s.course_assignment_score) : "–"}</span>
                <span className="aa-part" data-empty={!s.daily_assignment_score}>{s.daily_assignment_score ? pct(s.daily_assignment_score) : "–"}</span>
                <span className="aa-score" data-band={b}>
                  {b === "none" ? <b>No scores yet</b> : <><b>{pct(s.overall_score)}</b><i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, Math.max(0, s.overall_score))}%` }} /></i></>}
                </span>
                <span className="aa-badge-cell">{s.badge && s.badge !== "NONE" ? <span className="aa-badge" data-badge={s.badge}>{BADGE[s.badge]}</span> : <span className="sm-muted">–</span>}</span>
              </article>
            );
          })}
          <Pager offset={(page - 1) * PAGE_SIZE} count={pageRows.length} total={rows.length} pageSize={PAGE_SIZE} noun="students" onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(page + 1)} />
        </section>
      )}
    </>
  );
}

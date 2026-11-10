import { Search } from "lucide-react";
import { Pager } from "../../portal/notifications";
import { BAND_LABEL, pct, plural, schoolBand, type Band, type SchoolRanking } from "./types";

/** One row per school, best average first. Schools that have not handed in any work yet say so instead of showing a rank. */
export default function SchoolsTab({
  rows,
  total,
  band,
  search,
  onSearch,
  onClear,
  page,
  pageSize,
  onPage,
}: {
  rows: SchoolRanking[];
  /** schools before the search and score-range filters */
  total: number;
  band: Band | "all";
  search: string;
  onSearch: (v: string) => void;
  onClear: () => void;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const filtered = band !== "all" || search.trim() !== "";
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      {total > 6 && (
        <div className="aa-bar">
          <div className="sd-search" style={{ flex: "1 1 16rem", maxWidth: "26rem", width: "auto" }}>
            <Search aria-hidden="true" />
            <input type="search" placeholder="Search by school name" aria-label="Search schools" value={search} onChange={(e) => onSearch(e.target.value)} />
          </div>
          {filtered && <button className="sd-btn sd-btn--line" onClick={onClear}>Clear filters</button>}
        </div>
      )}
      {total === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No school scores yet</b><p>Scores show up here once an assignment is published and students hand in work.</p></div></section>
      ) : rows.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No schools match</b>
            <p>{band !== "all" ? `No school is in “${BAND_LABEL[band]}” with these filters.` : "Try a different name."}</p>
            <button className="sd-btn sd-btn--line" onClick={onClear}>Clear filters</button>
          </div>
        </section>
      ) : (
        <section className="sd-panel ap-list mc-swap" aria-label="School ranking">
          <div className="ap-row aa-head" aria-hidden="true"><span>Rank</span><span>School</span><span>Average score</span><span>Handed in</span><span>Retakes</span></div>
          {pageRows.map((s) => {
            const b = schoolBand(s);
            return (
              <article key={s.school_id} className="ap-row aa-item">
                {b === "none" ? <span className="aa-rank" aria-label="Not ranked">–</span> : <span className="aa-rank" data-top={s.rank <= 3 ? s.rank : undefined} aria-label={`Rank ${s.rank}`}>{s.rank}</span>}
                <span className="aa-who">
                  <b>{s.school_name}</b>
                  <small>{plural(s.assignments_created, "assignment")} for its students{s.attempts_count > 0 ? `, ${plural(s.attempts_count, "attempt")}` : ""}</small>
                </span>
                <span className="aa-score" data-band={b}>
                  {b === "none" ? <b>No work handed in yet</b> : <><small className="ap-lbl">Average score</small><b>{pct(s.average_score_percentage)}</b><i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, Math.max(0, s.average_score_percentage))}%` }} /></i></>}
                </span>
                <span className="aa-score" data-band={s.completion_rate > 0 ? "done" : "none"}>
                  <small className="ap-lbl">Handed in</small>
                  <b>{pct(s.completion_rate)}</b>
                  <i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, Math.max(0, s.completion_rate))}%` }} /></i>
                </span>
                <span className="ap-retake" data-empty={s.attempts_count === 0}>{s.attempts_count === 0 ? "–" : pct(s.retake_usage_percentage)}</span>
              </article>
            );
          })}
          <Pager offset={(page - 1) * pageSize} count={pageRows.length} total={rows.length} pageSize={pageSize} noun="schools" onPrev={() => onPage(Math.max(1, page - 1))} onNext={() => onPage(page + 1)} />
        </section>
      )}
    </>
  );
}

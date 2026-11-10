"use client";

import { useEffect, useState } from "react";
import { Clock, Eye, Search, Users } from "lucide-react";
import { Pager, initialsOf } from "../../portal/notifications";
import { formatGradeSection } from "@/hooks/useTeacherData";
import { STATUS_LABEL, longDate, plural, schoolName, statusOf, teacherName, type TeacherReport } from "./types";

const PAGE_SIZE = 20;

export interface Filters { search: string; date: string; school: string; grade: string; teacher: string; hasStatus: boolean }

export default function ReportsList({
  reports,
  loading,
  totalMatching,
  filters,
  onFilter,
  onClear,
  schools,
  grades,
  teachers,
  orphaned,
  cleaningUp,
  onCleanup,
  onReview,
  todayKey,
}: {
  reports: TeacherReport[];
  loading: boolean;
  /** the real count in the database for these filters, which can be more than what is loaded */
  totalMatching: number;
  filters: Filters;
  onFilter: (key: "search" | "date" | "school" | "grade" | "teacher", value: string) => void;
  onClear: () => void;
  schools: { id: string; name?: string | null }[];
  grades: string[];
  teachers: { id: string; full_name?: string | null; email?: string | null }[];
  orphaned: number;
  cleaningUp: boolean;
  onCleanup: () => void;
  onReview: (r: TeacherReport) => void;
  todayKey: string;
}) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const [pageState, setPageState] = useState({ key: "", page: 0 });

  // Send the search to the server a moment after typing stops, not on every key.
  useEffect(() => {
    if (searchInput.trim() === filters.search) return;
    const t = setTimeout(() => onFilter("search", searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput, filters.search, onFilter]);

  const key = [filters.search, filters.date, filters.school, filters.grade, filters.teacher, filters.hasStatus, reports.length].join("|");
  const lastPage = Math.max(0, Math.ceil(reports.length / PAGE_SIZE) - 1);
  const page = Math.min(pageState.key === key ? pageState.page : 0, lastPage);
  const visible = reports.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const hasFilters = !!searchInput || !!filters.date || !!filters.school || !!filters.grade || !!filters.teacher || filters.hasStatus;
  const clear = () => { setSearchInput(""); onClear(); };

  return (
    <>
      <div className="ar-bar">
        <div className="sd-search" style={{ flex: "1 1 15rem", maxWidth: "24rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search reports" aria-label="Search reports" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <select className="sd-field" aria-label="School" value={filters.school} onChange={(e) => onFilter("school", e.target.value)}>
          <option value="">All schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="sd-field" aria-label="Class" value={filters.grade} onChange={(e) => onFilter("grade", e.target.value)}>
          <option value="">All classes</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="sd-field" aria-label="Teacher" value={filters.teacher} onChange={(e) => onFilter("teacher", e.target.value)}>
          <option value="">All teachers</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
        </select>
        <span className="ar-date">
          <input type="date" className="sd-field" aria-label="Date" value={filters.date} onChange={(e) => onFilter("date", e.target.value)} />
          <button type="button" className="sd-btn sd-btn--line" onClick={() => onFilter("date", todayKey)} disabled={filters.date === todayKey}>Today</button>
        </span>
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
      </div>

      {orphaned > 0 && (
        <div className="ar-orphan" role="status">
          <p>{plural(orphaned, "report")} {orphaned === 1 ? "belongs" : "belong"} to a teacher or school that no longer exists.</p>
          <button className="sd-btn sd-btn--line" onClick={onCleanup} disabled={cleaningUp}>{cleaningUp ? "Cleaning up…" : "Remove them"}</button>
        </div>
      )}

      {loading && reports.length === 0 ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : reports.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{hasFilters ? "No reports match" : "No reports yet"}</b>
            <p>{hasFilters ? "Try different filters, or clear them." : "Teachers send a report after each class. They show up here as soon as they do."}</p>
            {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
          </div>
        </section>
      ) : (
        <section className="sd-panel as-list mc-swap" aria-label="Teacher reports">
          {totalMatching > reports.length && (
            <p className="ar-cap">Showing the newest {reports.length} of {totalMatching.toLocaleString("en-IN")} reports. Narrow the filters to see the rest.</p>
          )}
          {visible.map((r) => {
            const st = statusOf(r);
            const cls = formatGradeSection(r.grade, r.section);
            return (
              <article key={r.id} className="ar-row" data-pending={st === "submitted"}>
                <span className="sd-avatar" aria-hidden="true">{initialsOf(teacherName(r))}</span>
                <div className="ar-main">
                  <div className="ar-top">
                    <b>{teacherName(r)}</b>
                    {cls && <span className="sm-chip" data-class="true">{cls}</span>}
                    <span className="ar-st" data-s={st}>{STATUS_LABEL[st]}</span>
                  </div>
                  <p className="ar-topics">{r.topics_taught || "No topics listed"}</p>
                  <p className="ar-meta">
                    <span>{schoolName(r)}</span>
                    <span>{longDate(r.date)}</span>
                    <span><Clock aria-hidden="true" />{r.duration_hours || 0} h</span>
                    <span><Users aria-hidden="true" />{plural(r.student_count || 0, "student")}</span>
                  </p>
                </div>
                <button className={`sd-btn ${st === "submitted" ? "sd-btn--amber" : "sd-btn--line"}`} onClick={() => onReview(r)} aria-label={`Review the report by ${teacherName(r)}`}>
                  <Eye aria-hidden="true" />Review
                </button>
              </article>
            );
          })}
          <Pager offset={page * PAGE_SIZE} count={visible.length} total={reports.length} pageSize={PAGE_SIZE} noun="reports" onPrev={() => setPageState({ key, page: Math.max(0, page - 1) })} onNext={() => setPageState({ key, page: page + 1 })} />
        </section>
      )}
    </>
  );
}

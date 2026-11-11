"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Eye, Search, SquareCheckBig, Users, X } from "lucide-react";
import ConfirmModal from "@/components/portal/ConfirmModal";
import { initialsOf } from "../../portal/notifications";
import { formatGradeSection } from "@/hooks/useTeacherData";
import { STATUS_LABEL, dayKey, longDate, plural, schoolName, shiftDayKey as shiftKey, statusOf, teacherName, type TeacherReport } from "./types";

const DAYS_PER_PAGE = 7;

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
  onBulk,
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
  /** approve or reject many reports at once; resolves true on success */
  onBulk: (ids: string[], status: "approved" | "rejected") => Promise<boolean>;
  todayKey: string;
}) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const [daysShown, setDaysShown] = useState({ key: "", n: DAYS_PER_PAGE });

  // Send the search to the server a moment after typing stops, not on every key.
  useEffect(() => {
    if (searchInput.trim() === filters.search) return;
    const t = setTimeout(() => onFilter("search", searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput, filters.search, onFilter]);

  const key = [filters.search, filters.date, filters.school, filters.grade, filters.teacher, filters.hasStatus, reports.length].join("|");
  const shownDays = daysShown.key === key ? daysShown.n : DAYS_PER_PAGE;

  // Day by day, newest first; inside a day, by teacher then class.
  const days = useMemo(() => {
    const map = new Map<string, TeacherReport[]>();
    for (const r of reports) {
      const k = dayKey(r.date);
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }
    for (const list of map.values()) list.sort((a, b) => teacherName(a).localeCompare(teacherName(b)) || (a.grade || "").localeCompare(b.grade || ""));
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [reports]);
  const visibleDays = days.slice(0, shownDays);
  const dayLabel = (k: string) => (k === todayKey ? "Today" : k === shiftKey(todayKey, -1) ? "Yesterday" : longDate(k));
  const hasFilters = !!searchInput || !!filters.date || !!filters.school || !!filters.grade || !!filters.teacher || filters.hasStatus;
  const clear = () => { setSearchInput(""); onClear(); };

  // Selection spans every loaded report, not just this page. Only pending/reviewed reports can be picked.
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<"approved" | "rejected" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const actionable = reports.filter((r) => { const st = statusOf(r); return st === "submitted" || st === "reviewed"; });
  const actionableIds = new Set(actionable.map((r) => r.id));
  const picked = selected.filter((id) => actionableIds.has(id)); // drop ids that left the list after a filter change
  const allSelected = actionable.length > 0 && picked.length === actionable.length;
  const toggleAll = () => setSelected(allSelected ? [] : actionable.map((r) => r.id));
  const toggleOne = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    const ok = await onBulk(picked, bulk);
    setBulkBusy(false);
    if (ok) { setSelected([]); setBulk(null); }
  };

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
          <button type="button" className="pl-ico" onClick={() => onFilter("date", shiftKey(filters.date || todayKey, -1))} aria-label="Previous day"><ChevronLeft /></button>
          <input type="date" className="sd-field" aria-label="Day" value={filters.date} onChange={(e) => onFilter("date", e.target.value)} />
          <button type="button" className="pl-ico" onClick={() => onFilter("date", shiftKey(filters.date || todayKey, 1))} aria-label="Next day"><ChevronRight /></button>
          {filters.date ? (
            <button type="button" className="sd-btn sd-btn--line" onClick={() => onFilter("date", "")}>All days</button>
          ) : (
            <button type="button" className="sd-btn sd-btn--line" onClick={() => onFilter("date", todayKey)}>Today</button>
          )}
        </span>
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
        {actionable.length > 0 && (
          <button className="sd-btn sd-btn--amber" onClick={toggleAll}>
            <SquareCheckBig aria-hidden="true" />{allSelected ? "Clear selection" : `Select all ${actionable.length} pending`}
          </button>
        )}
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
        <>
          {totalMatching > reports.length && (
            <p className="ar-cap ar-cap--solo">Showing the newest {reports.length} of {totalMatching.toLocaleString("en-IN")} reports. Narrow the filters to see the rest.</p>
          )}
          {visibleDays.map(([day, list]) => {
            const waiting = list.filter((r) => actionableIds.has(r.id));
            const ids = waiting.map((r) => r.id);
            const daySelected = ids.length > 0 && ids.every((id) => picked.includes(id));
            return (
              <section key={day} className="sd-panel as-list mc-swap" aria-label={dayLabel(day)}>
                <p className="as-group">
                  {dayLabel(day)}
                  <span>{plural(list.length, "report")}{waiting.length > 0 ? `, ${waiting.length} awaiting review` : ""}</span>
                  {waiting.length > 0 && (
                    <button type="button" className="ar-dayact" onClick={() => setSelected((prev) => (daySelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]))}>
                      {daySelected ? "Unselect day" : "Select day"}
                    </button>
                  )}
                </p>
                {list.map((r) => {
                  const st = statusOf(r);
                  const cls = formatGradeSection(r.grade, r.section);
                  const canAct = actionableIds.has(r.id);
                  const isSel = canAct && picked.includes(r.id);
                  return (
                    <article key={r.id} className="ar-row" data-pending={st === "submitted"} data-selected={isSel}>
                      {canAct
                        ? <input type="checkbox" className="sm-check" checked={isSel} onChange={() => toggleOne(r.id)} aria-label={`Select the report by ${teacherName(r)}`} />
                        : <span aria-hidden="true" />}
                      <span className="sd-avatar" aria-hidden="true">{initialsOf(teacherName(r))}</span>
                      <div className="ar-main">
                        <div className="ar-top">
                          <b>{teacherName(r)}</b>
                          {cls && <span className="sm-chip" data-class="true">{cls}</span>}
                          {r.subject && <span className="sm-chip" title={r.subject_source === "timetable" ? "Filled in from the timetable" : "Chosen by the teacher"}>{r.subject}</span>}
                          <span className="ar-st" data-s={st}>{STATUS_LABEL[st]}</span>
                        </div>
                        <p className="ar-topics">{r.topics_taught || "No topics listed"}</p>
                        <p className="ar-meta">
                          <span>{schoolName(r)}</span>
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
              </section>
            );
          })}
          {days.length > shownDays && (
            <div className="ar-more">
              <button type="button" className="sd-btn sd-btn--line" onClick={() => setDaysShown({ key, n: shownDays + DAYS_PER_PAGE })}>
                Show earlier days <small>({days.length - shownDays} more)</small>
              </button>
            </div>
          )}
        </>
      )}

      {picked.length > 0 && (
        <div className="rp-bulk" role="region" aria-label="Selected reports">
          <button className="rp-sel" onClick={toggleAll}><b>{picked.length} selected</b></button>
          <button className="sd-btn sd-btn--amber" onClick={() => setBulk("approved")}><Check aria-hidden="true" />Approve</button>
          <button className="sd-btn sd-btn--line" onClick={() => setBulk("rejected")}><X aria-hidden="true" />Reject</button>
          <button className="sd-btn sd-btn--line" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <ConfirmModal
        open={!!bulk}
        onClose={() => setBulk(null)}
        busy={bulkBusy}
        danger={bulk === "rejected"}
        title={`${bulk === "rejected" ? "Reject" : "Approve"} ${plural(picked.length, "report")}?`}
        subtitle={bulk === "rejected" ? "The teachers will see that these were rejected." : "These will be marked as approved."}
        confirmLabel={bulk === "rejected" ? "Reject all" : "Approve all"}
        onConfirm={() => void runBulk()}
      />
    </>
  );
}

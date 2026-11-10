"use client";

import { useMemo, useState } from "react";
import { BookPlus, Eye, Loader2, MoveRight, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import RowMenu from "../../portal/RowMenu";
import { Pager, initialsOf } from "../../portal/notifications";
import { addedOn, bandOf, classLine, placementsOf, plural, searchBlob, type Band, type StudentLike } from "./utils";
import { BAND_LABEL } from "./utils";

const PAGE_SIZE = 25;
const SHOWN = 2;
type Sort = "name" | "newest" | "progress" | "lowest";
const SORTS: [Sort, string][] = [["name", "Name, A to Z"], ["newest", "Newest first"], ["progress", "Most progress"], ["lowest", "Least progress"]];

export default function StudentsTab({
  students,
  loading,
  band,
  onClearBand,
  resetKey,
  enrollingId,
  syncing,
  bulkEnrolling,
  onAdd,
  onSync,
  onView,
  onEdit,
  onEnroll,
  onDelete,
  onBulkMove,
  onBulkEnroll,
  onBulkDelete,
  extraActions,
}: {
  students: StudentLike[];
  loading: boolean;
  band: Band | null;
  onClearBand: () => void;
  /** change this to clear the ticked rows */
  resetKey: number;
  enrollingId: string | null;
  syncing: boolean;
  bulkEnrolling: boolean;
  onAdd: () => void;
  onSync: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onEnroll: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkMove: (ids: string[]) => void;
  onBulkEnroll: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
  extraActions?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) { setSeenKey(resetKey); setPicked(new Set()); }

  const blobs = useMemo(() => new Map(students.map((s) => [s.id, searchBlob(s)])), [students]);
  const schoolOptions = useMemo(() => {
    const by = new Map<string, string>();
    students.forEach((s) => placementsOf(s).forEach((p) => by.set(p.schoolId, p.school)));
    return [...by].sort((a, b) => a[1].localeCompare(b[1]));
  }, [students]);
  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => placementsOf(s).forEach((p) => p.grade && set.add(p.grade)));
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students.filter((s) => {
      if (band && bandOf(s.progress) !== band) return false;
      if (school || grade) {
        const ok = placementsOf(s).some((p) => (!school || p.schoolId === school) && (!grade || p.grade === grade));
        if (!ok) return false;
      }
      return !q || (blobs.get(s.id) ?? "").includes(q);
    });
    return list.sort((a, b) => {
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "progress") return (b.progress ?? 0) - (a.progress ?? 0) || a.full_name.localeCompare(b.full_name);
      if (sort === "lowest") return (a.progress ?? 0) - (b.progress ?? 0) || a.full_name.localeCompare(b.full_name);
      return a.full_name.localeCompare(b.full_name);
    });
  }, [students, search, school, grade, sort, band, blobs]);

  const hasFilters = !!search.trim() || !!school || !!grade || band !== null;
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const visible = filtered.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);
  const allOnPage = visible.length > 0 && visible.every((s) => picked.has(s.id));
  const pickedIds = students.map((s) => s.id).filter((id) => picked.has(id));

  const clear = () => { setSearch(""); setSchool(""); setGrade(""); setPage(0); onClearBand(); };
  const toggleOne = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const togglePage = () => setPicked((prev) => {
    const next = new Set(prev);
    visible.forEach((s) => (allOnPage ? next.delete(s.id) : next.add(s.id)));
    return next;
  });

  if (loading && students.length === 0) {
    return <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>;
  }
  if (students.length === 0) {
    return (
      <section className="sd-panel">
        <div className="sd-empty">
          <b>No students yet</b>
          <p>Add one student here, or import a whole class from a spreadsheet in the Bulk import tab.</p>
          <button className="sd-btn sd-btn--amber" onClick={onAdd}><Plus aria-hidden="true" />Add student</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="ad-bar">
        <div className="sd-search" style={{ flex: "1 1 18rem", maxWidth: "28rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search by name, email, parent, school or class" aria-label="Search students" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        {schoolOptions.length > 1 && (
          <select className="sd-field" aria-label="Show students of one school" value={school} onChange={(e) => { setSchool(e.target.value); setPage(0); }}>
            <option value="">All schools</option>
            {schoolOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        {gradeOptions.length > 0 && (
          <select className="sd-field" aria-label="Show one grade" value={grade} onChange={(e) => { setGrade(e.target.value); setPage(0); }}>
            <option value="">All grades</option>
            {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        <select className="sd-field" aria-label="Sort students" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(0); }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {band && <span className="sm-chip" data-class="true">{BAND_LABEL[band]}</span>}
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
        <span className="ad-bar-end">
          <button className="sd-btn sd-btn--line" onClick={onSync} disabled={syncing} title="Enroll every student in the courses that apply to their class">
            {syncing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Sync enrollments
          </button>
          {extraActions}
        </span>
      </div>

      {filtered.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No students match</b>
            <p>Try a different search, or clear the filters.</p>
            <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>
          </div>
        </section>
      ) : (
        <section className="sd-panel ad-list mc-swap" aria-label="Students">
          <div className="ad-head">
            <input type="checkbox" className="ad-check" aria-label="Select every student on this page" checked={allOnPage} onChange={togglePage} />
            <span />
            <span>Student</span>
            <span>Class</span>
            <span>Progress</span>
            <span>Courses</span>
            <span />
          </div>
          {visible.map((s) => {
            const places = placementsOf(s);
            const p = Math.round(s.progress ?? 0);
            const courses = s.student_courses?.length ?? 0;
            return (
              <div key={s.id} className="ad-row" data-picked={picked.has(s.id)}>
                <input type="checkbox" className="ad-check" aria-label={`Select ${s.full_name}`} checked={picked.has(s.id)} onChange={() => toggleOne(s.id)} />
                <span className="sd-avatar" aria-hidden="true">{initialsOf(s.full_name)}</span>
                <button type="button" className="ad-who" onClick={() => onView(s.id)} aria-label={`Open ${s.full_name}`}>
                  <b>{s.full_name}</b>
                  <small>{s.email}</small>
                  {(s.parent_name || s.parent_phone) && <small>Parent: {[s.parent_name, s.parent_phone].filter(Boolean).join(", ")}</small>}
                </button>
                <span className="ad-class">
                  {places.length === 0 ? <span className="sm-chip" data-warn="true">No school yet</span> : (
                    <>
                      {places.slice(0, SHOWN).map((pl, i) => <span key={`${pl.schoolId}-${i}`} className="ad-place"><b>{pl.school}</b><small>{classLine(pl)}</small></span>)}
                      {places.length > SHOWN && <small>and {plural(places.length - SHOWN, "more school")}</small>}
                    </>
                  )}
                </span>
                <span className="ad-prog" data-b={bandOf(s.progress)}>
                  <b>{p}%</b>
                  <span className="sd-meter" role="img" aria-label={`${p}% through their courses`}><i style={{ "--p": `${Math.max(p, 3)}%` } as React.CSSProperties} /></span>
                </span>
                <span className="ad-courses">
                  {courses > 0 ? <small>{plural(courses, "course")}</small> : <span className="sm-chip" data-on="false">None yet</span>}
                  <small>Added {addedOn(s.created_at)}</small>
                </span>
                <span className="ad-menu">
                  {enrollingId === s.id ? <span className="sd-skel" style={{ width: "1.5rem", height: "1.5rem", borderRadius: "50%" }} /> : (
                    <RowMenu
                      label={`Actions for ${s.full_name}`}
                      items={[
                        { label: "View details", icon: Eye, onClick: () => onView(s.id) },
                        { label: "Edit student", icon: Pencil, onClick: () => onEdit(s.id) },
                        { label: "Enroll in courses", icon: BookPlus, onClick: () => onEnroll(s.id) },
                        { label: "Delete student", icon: Trash2, onClick: () => onDelete(s.id), danger: true, separatorBefore: true },
                      ]}
                    />
                  )}
                </span>
              </div>
            );
          })}
          <Pager offset={at * PAGE_SIZE} count={visible.length} total={filtered.length} pageSize={PAGE_SIZE} noun="students" onPrev={() => setPage(Math.max(0, at - 1))} onNext={() => setPage(at + 1)} />
        </section>
      )}

      {pickedIds.length > 0 && (
        <div className="ad-selbar" role="region" aria-label="Selected students">
          <b>{plural(pickedIds.length, "student")} selected</b>
          <div>
            <button className="sd-btn sd-btn--line" onClick={() => setPicked(new Set())}>Clear</button>
            <button className="sd-btn sd-btn--line" onClick={() => onBulkMove(pickedIds)}><MoveRight aria-hidden="true" />Move to a class</button>
            <button className="sd-btn sd-btn--line" onClick={() => onBulkEnroll(pickedIds)} disabled={bulkEnrolling}>
              {bulkEnrolling ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BookPlus aria-hidden="true" />}Enroll in courses
            </button>
            <button className="sd-btn sd-btn--danger" onClick={() => onBulkDelete(pickedIds)}><Trash2 aria-hidden="true" />Delete</button>
          </div>
        </div>
      )}
    </>
  );
}

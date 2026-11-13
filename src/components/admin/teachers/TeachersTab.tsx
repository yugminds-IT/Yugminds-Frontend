"use client";

import { useMemo, useState } from "react";
import { Copy, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import RowMenu from "../../portal/RowMenu";
import { Pager, initialsOf } from "../../portal/notifications";
import LastSignIn from "../../portal/LastSignIn";
import {
  TODAY_LABEL,
  experienceOf,
  idOf,
  isActive,
  nameOf,
  plural,
  schoolLine,
  schoolsOf,
  searchBlob,
  todayKey,
  type SchoolToday,
  type TeacherLike,
  type TodayKey,
  type TodayStatus,
} from "./utils";

const PAGE_SIZE = 15;
const SHOWN_SCHOOLS = 2;
type Sort = "name" | "newest" | "schools";
const SORTS: [Sort, string][] = [["name", "Name, A to Z"], ["newest", "Newest first"], ["schools", "Most schools"]];
export type StatusFilter = "all" | "active";

export default function TeachersTab({
  teachers,
  today,
  perSchool,
  todayFilter,
  statusFilter,
  onClearFilters,
  resetKey,
  busyId,
  onAdd,
  onView,
  onEdit,
  onCopy,
  onDelete,
  onBulkDelete,
}: {
  teachers: TeacherLike[];
  today: Record<string, TodayStatus>;
  perSchool: Record<string, SchoolToday[]>;
  todayFilter: TodayKey | null;
  statusFilter: StatusFilter;
  onClearFilters: () => void;
  /** change this to clear the ticked rows (after a bulk delete) */
  resetKey: number;
  busyId: string | null;
  onAdd: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) { setSeenKey(resetKey); setPicked(new Set()); }

  const blobs = useMemo(() => new Map(teachers.map((t) => [idOf(t), searchBlob(t)])), [teachers]);
  const schoolOptions = useMemo(() => {
    const by = new Map<string, string>();
    teachers.forEach((t) => schoolsOf(t).forEach((s) => by.set(s.id, s.name)));
    return [...by].sort((a, b) => a[1].localeCompare(b[1]));
  }, [teachers]);

  const todayOf = (t: TeacherLike) => todayKey(today[idOf(t)]?.status);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = teachers.filter((t) => {
      if (statusFilter === "active" && !isActive(t)) return false;
      if (todayFilter && (!isActive(t) || todayKey(today[idOf(t)]?.status) !== todayFilter)) return false;
      if (school && !schoolsOf(t).some((s) => s.id === school)) return false;
      return !q || (blobs.get(idOf(t)) ?? "").includes(q);
    });
    return list.sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt ?? b.created_at ?? 0).getTime() - new Date(a.createdAt ?? a.created_at ?? 0).getTime();
      if (sort === "schools") return schoolsOf(b).length - schoolsOf(a).length || nameOf(a).localeCompare(nameOf(b));
      return nameOf(a).localeCompare(nameOf(b));
    });
  }, [teachers, search, school, sort, statusFilter, todayFilter, today, blobs]);

  const hasFilters = !!search.trim() || !!school || todayFilter !== null || statusFilter !== "all";
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const visible = filtered.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);
  const allOnPage = visible.length > 0 && visible.every((t) => picked.has(idOf(t)));
  const pickedIds = teachers.map(idOf).filter((id) => picked.has(id));

  const clear = () => { setSearch(""); setSchool(""); setPage(0); onClearFilters(); };
  const toggleOne = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const togglePage = () => setPicked((prev) => {
    const next = new Set(prev);
    visible.forEach((t) => (allOnPage ? next.delete(idOf(t)) : next.add(idOf(t))));
    return next;
  });

  if (teachers.length === 0) {
    return (
      <section className="sd-panel">
        <div className="sd-empty">
          <b>No teachers yet</b>
          <p>Add a teacher, then assign them to a school with the grades, sections and subjects they teach.</p>
          <button className="sd-btn sd-btn--amber" onClick={onAdd}><Plus aria-hidden="true" />Add teacher</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="at-bar">
        <div className="sd-search" style={{ flex: "1 1 18rem", maxWidth: "30rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search by name, email, school, subject or qualification" aria-label="Search teachers" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        {schoolOptions.length > 1 && (
          <select className="sd-field" aria-label="Show teachers from one school" value={school} onChange={(e) => { setSchool(e.target.value); setPage(0); }}>
            <option value="">All schools</option>
            {schoolOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <select className="sd-field" aria-label="Sort teachers" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(0); }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {todayFilter && <span className="sm-chip" data-class="true">Today: {TODAY_LABEL[todayFilter]}</span>}
        {statusFilter !== "all" && <span className="sm-chip" data-class="true">Active accounts</span>}
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
      </div>

      {filtered.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No teachers match</b>
            <p>Try a different search, or clear the filters.</p>
            <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>
          </div>
        </section>
      ) : (
        <section className="sd-panel at-list mc-swap" aria-label="Teachers">
          <div className="at-head">
            <input type="checkbox" className="at-check" aria-label="Select every teacher on this page" checked={allOnPage} onChange={togglePage} />
            <span />
            <span>Teacher</span>
            <span>Schools</span>
            <span>Background</span>
            <span>Today</span>
            <span>Last sign-in</span>
            <span />
          </div>
          {visible.map((t) => {
            const id = idOf(t);
            const name = nameOf(t);
            const schools = schoolsOf(t);
            const per = perSchool[id];
            const key = todayOf(t);
            const status = today[id]?.status;
            const exp = experienceOf(t);
            return (
              <div key={id} className="at-row" data-picked={picked.has(id)} data-off={!isActive(t)}>
                <input type="checkbox" className="at-check" aria-label={`Select ${name}`} checked={picked.has(id)} onChange={() => toggleOne(id)} />
                <span className="sd-avatar" aria-hidden="true">{initialsOf(name)}</span>
                <button type="button" className="at-who" onClick={() => onView(id)} aria-label={`Open profile of ${name}`}>
                  <b>{name}</b>
                  <small>{t.email}</small>
                  {t.phone && <small>{t.phone}</small>}
                </button>
                <span className="at-schools">
                  {schools.length === 0 ? (
                    <span className="sm-chip" data-warn="true">No school yet</span>
                  ) : (
                    <>
                      {schools.slice(0, SHOWN_SCHOOLS).map((s) => (
                        <span key={s.id} className="at-school"><b>{s.name}</b><small>{schoolLine(s)}</small>{s.schedule && <small>{s.schedule}</small>}</span>
                      ))}
                      {schools.length > SHOWN_SCHOOLS && <small className="at-more">and {plural(schools.length - SHOWN_SCHOOLS, "more school")}</small>}
                    </>
                  )}
                </span>
                <span className="at-bg">
                  <b>{t.qualification || "No qualification listed"}</b>
                  <small>{[exp, t.specialization].filter(Boolean).join(" · ") || " "}</small>
                </span>
                <span className="at-today">
                  {!isActive(t) ? (
                    <span className="sm-chip" data-on="false">Inactive</span>
                  ) : per && per.length > 1 ? (
                    per.map((s) => (
                      <span key={s.school_id} className="at-per"><small>{s.school_name}{s.slot ? ` · ${s.slot.slot === "MORNING" ? "AM" : "PM"}` : ""}</small><span className="at-chip" data-k={todayKey(s.status)}>{s.status}</span></span>
                    ))
                  ) : (
                    <span className="at-chip" data-k={key} title={status === "Not Marked" || !status ? "No attendance mark yet today" : undefined}>
                      {status === "On Leave" || status === "Leave-Approved" ? `On leave${today[id]?.leaveType ? ` (${today[id].leaveType})` : ""}` : status && status !== "Not Marked" ? status : "Not marked"}
                    </span>
                  )}
                </span>
                <span className="at-seen">
                  <LastSignIn at={t.last_login} />
                </span>
                <span className="at-menu">
                  {busyId === id ? <span className="sd-skel" style={{ width: "1.5rem", height: "1.5rem", borderRadius: "50%" }} /> : (
                    <RowMenu
                      label={`Actions for ${name}`}
                      items={[
                        { label: "View profile", icon: Eye, onClick: () => onView(id) },
                        { label: "Edit teacher", icon: Pencil, onClick: () => onEdit(id) },
                        { label: "Copy school assignment", icon: Copy, onClick: () => onCopy(id) },
                        { label: "Delete teacher", icon: Trash2, onClick: () => onDelete(id), danger: true, separatorBefore: true },
                      ]}
                    />
                  )}
                </span>
              </div>
            );
          })}
          <Pager offset={at * PAGE_SIZE} count={visible.length} total={filtered.length} pageSize={PAGE_SIZE} noun="teachers" onPrev={() => setPage(Math.max(0, at - 1))} onNext={() => setPage(at + 1)} />
        </section>
      )}

      {pickedIds.length > 0 && (
        <div className="at-selbar" role="region" aria-label="Selected teachers">
          <b>{plural(pickedIds.length, "teacher")} selected</b>
          <div>
            <button className="sd-btn sd-btn--line" onClick={() => setPicked(new Set())}>Clear</button>
            <button className="sd-btn sd-btn--danger" onClick={() => onBulkDelete(pickedIds)}><Trash2 aria-hidden="true" />Delete</button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import NextImage from "next/image";
import { BookOpen, Copy, Eye, History, LayoutGrid, LayoutList, Loader2, Pause, Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import RowMenu from "../../portal/RowMenu";
import { Pager } from "../../portal/notifications";
import {
  STAGE_LABEL,
  chaptersOf,
  classesOf,
  day,
  plural,
  schoolsOf,
  searchBlob,
  stageOf,
  titleOf,
  type CourseLike,
  type Stage,
} from "./utils";

const PAGE_SIZE = 12;
const SHOWN_CLASSES = 4;
type Sort = "newest" | "name" | "chapters" | "updated";
const SORTS: [Sort, string][] = [["updated", "Recently changed"], ["newest", "Newest first"], ["name", "Name, A to Z"], ["chapters", "Most chapters"]];

function Counts({ c }: { c: CourseLike }) {
  return (
    <span className="co-counts">
      <b>{plural(chaptersOf(c), "chapter")}</b>
      <small>{plural(c.total_videos || 0, "video")}, {plural(c.total_materials || 0, "file")}, {plural(c.total_assignments || 0, "assignment")}</small>
    </span>
  );
}

function Targets({ c }: { c: CourseLike }) {
  const schools = schoolsOf(c);
  const classes = classesOf(c);
  const live = c.status === "Published";
  if (schools.length === 0) return <span className="co-targets"><span className="sm-chip" data-on="false">Not shared with a school</span></span>;
  return (
    <span className="co-targets" data-live={live} title={live ? undefined : "Saved targeting. Students see it once the course is published."}>
      <b>{schools.join(", ")}</b>
      <span className="co-classes">
        {classes.slice(0, SHOWN_CLASSES).map((g) => <span key={g} className="sm-chip">{g}</span>)}
        {classes.length > SHOWN_CLASSES && <small>+{classes.length - SHOWN_CLASSES} more</small>}
      </span>
      {!live && <small>Not visible to students yet</small>}
    </span>
  );
}

function Thumb({ c, big = false }: { c: CourseLike; big?: boolean }) {
  return (
    <span className={big ? "co-thumb co-thumb--big" : "co-thumb"} aria-hidden="true">
      {c.thumbnail_url ? <NextImage src={c.thumbnail_url} alt="" fill sizes={big ? "(min-width: 1100px) 22rem, 90vw" : "4rem"} className="object-cover" /> : <BookOpen />}
    </span>
  );
}

export default function CoursesTab({
  courses,
  loading,
  stage,
  onClearStage,
  selected,
  onSelectedChange,
  cloningId,
  onCreate,
  onView,
  onEdit,
  onPublish,
  onHistory,
  onClone,
  onDelete,
  onBulkPublish,
  onBulkDelete,
}: {
  courses: CourseLike[];
  loading: boolean;
  stage: Stage | null;
  onClearStage: () => void;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  cloningId: string | null;
  onCreate: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onPublish: (id: string) => void;
  onHistory: (id: string) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkPublish: (publish: boolean) => void;
  onBulkDelete: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(0);

  const blobs = useMemo(() => new Map(courses.map((c) => [c.id, searchBlob(c)])), [courses]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = courses.filter((c) => (!stage || stageOf(c) === stage) && (!q || (blobs.get(c.id) ?? "").includes(q)));
    return list.sort((a, b) => {
      if (sort === "name") return titleOf(a).localeCompare(titleOf(b));
      if (sort === "chapters") return chaptersOf(b) - chaptersOf(a) || titleOf(a).localeCompare(titleOf(b));
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [courses, search, stage, sort, blobs]);

  const hasFilters = !!search.trim() || stage !== null;
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const visible = filtered.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);
  const allPicked = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const pickedCount = courses.filter((c) => selected.has(c.id)).length;

  const clear = () => { setSearch(""); setPage(0); onClearStage(); };
  const toggle = (id: string) => { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); onSelectedChange(next); };
  const toggleAll = () => onSelectedChange(allPicked ? new Set() : new Set(filtered.map((c) => c.id)));

  if (loading && courses.length === 0) {
    return <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>;
  }
  if (courses.length === 0) {
    return (
      <section className="sd-panel">
        <div className="sd-empty">
          <b>No courses yet</b>
          <p>Create a course with its chapters, videos, files and assignments. Then publish it to the schools and classes that should see it.</p>
          <button className="sd-btn sd-btn--amber" onClick={onCreate}><Plus aria-hidden="true" />Create course</button>
        </div>
      </section>
    );
  }

  const menu = (c: CourseLike) => [
    { label: "View details", icon: Eye, onClick: () => onView(c.id) },
    { label: "Edit course", icon: Pencil, onClick: () => onEdit(c.id) },
    { label: c.status === "Published" ? "Manage publishing" : "Publish to schools", icon: c.status === "Published" ? Pause : Play, onClick: () => onPublish(c.id) },
    { label: "Version history", icon: History, onClick: () => onHistory(c.id) },
    { label: "Clone course", icon: Copy, onClick: () => onClone(c.id) },
    { label: "Move to Trash", icon: Trash2, onClick: () => onDelete(c.id), danger: true, separatorBefore: true },
  ];
  const publishBtn = (c: CourseLike) => (
    <button type="button" className={`sd-btn ${c.status === "Published" ? "sd-btn--line" : "sd-btn--amber"} co-pub`} onClick={() => onPublish(c.id)}>
      {c.status === "Published" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      {c.status === "Published" ? "Manage" : "Publish"}
    </button>
  );
  const menuOrBusy = (c: CourseLike) =>
    cloningId === c.id ? <Loader2 className="animate-spin" aria-label="Cloning" /> : <RowMenu label={`Actions for ${titleOf(c)}`} items={menu(c)} />;

  return (
    <>
      <div className="co-bar">
        <div className="sd-search" style={{ flex: "1 1 18rem", maxWidth: "28rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search by course, school, grade or section" aria-label="Search courses" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <select className="sd-field" aria-label="Sort courses" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(0); }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {stage && <span className="sm-chip" data-class="true">{STAGE_LABEL[stage]}</span>}
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
        <span className="co-views" role="group" aria-label="Layout">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="List"><LayoutList /></button>
          <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} aria-label="Grid"><LayoutGrid /></button>
        </span>
      </div>

      {filtered.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No courses match</b>
            <p>Try a different search, or clear the filters.</p>
            <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>
          </div>
        </section>
      ) : view === "list" ? (
        <section className="sd-panel co-list mc-swap" aria-label="Courses">
          <div className="co-head">
            <input type="checkbox" className="co-check" aria-label={`Select all ${filtered.length} courses`} checked={allPicked} onChange={toggleAll} />
            <span />
            <span>Course</span>
            <span>Shared with</span>
            <span>Content</span>
            <span>Status</span>
            <span />
          </div>
          {visible.map((c) => (
            <div key={c.id} className="co-row" data-picked={selected.has(c.id)}>
              <input type="checkbox" className="co-check" aria-label={`Select ${titleOf(c)}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <Thumb c={c} />
              <button type="button" className="co-name" onClick={() => onView(c.id)} aria-label={`Open ${titleOf(c)}`}>
                <b>{titleOf(c)}</b>
                <small>{c.description?.trim() || "No description yet"}</small>
              </button>
              <Targets c={c} />
              <Counts c={c} />
              <span className="co-stage">
                <span className="co-chip" data-s={stageOf(c)}>{STAGE_LABEL[stageOf(c)]}</span>
                {publishBtn(c)}
              </span>
              <span className="co-menu">{menuOrBusy(c)}</span>
            </div>
          ))}
          <Pager offset={at * PAGE_SIZE} count={visible.length} total={filtered.length} pageSize={PAGE_SIZE} noun="courses" onPrev={() => setPage(Math.max(0, at - 1))} onNext={() => setPage(at + 1)} />
        </section>
      ) : (
        <>
          <div className="co-grid mc-swap" role="list" aria-label="Courses">
            {visible.map((c) => (
              <article key={c.id} role="listitem" className="co-card" data-picked={selected.has(c.id)}>
                <div className="co-card-top">
                  <Thumb c={c} big />
                  <input type="checkbox" className="co-check co-card-check" aria-label={`Select ${titleOf(c)}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="co-chip co-card-chip" data-s={stageOf(c)}>{STAGE_LABEL[stageOf(c)]}</span>
                </div>
                <div className="co-card-body">
                  <button type="button" className="co-name" onClick={() => onView(c.id)} aria-label={`Open ${titleOf(c)}`}>
                    <b>{titleOf(c)}</b>
                    <small>{c.description?.trim() || "No description yet"}</small>
                  </button>
                  <Targets c={c} />
                  <Counts c={c} />
                  <div className="co-card-foot">
                    <small>Changed {day(c.updated_at)}</small>
                    <span>{publishBtn(c)}{menuOrBusy(c)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pager offset={at * PAGE_SIZE} count={visible.length} total={filtered.length} pageSize={PAGE_SIZE} noun="courses" onPrev={() => setPage(Math.max(0, at - 1))} onNext={() => setPage(at + 1)} />
        </>
      )}

      {pickedCount > 0 && (
        <div className="co-selbar" role="region" aria-label="Selected courses">
          <b>{plural(pickedCount, "course")} selected</b>
          <div>
            <button className="sd-btn sd-btn--line" onClick={() => onSelectedChange(new Set())}>Clear</button>
            <button className="sd-btn sd-btn--line" onClick={() => onBulkPublish(false)}><Pause aria-hidden="true" />Unpublish</button>
            <button className="sd-btn sd-btn--amber" onClick={() => onBulkPublish(true)}><Play aria-hidden="true" />Publish</button>
            <button className="sd-btn sd-btn--danger" onClick={onBulkDelete}><Trash2 aria-hidden="true" />Move to Trash</button>
          </div>
        </div>
      )}
    </>
  );
}

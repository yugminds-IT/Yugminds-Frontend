"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Pencil, Plus, RefreshCw, Sun, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { toast } from "@/components/ui/toast";
import { requestClose, useDirtySnapshot } from "@/hooks/useUnsavedCloseGuard";
import ConfirmModal from "@/components/portal/ConfirmModal";
import TypeRun from "@/components/admin/calendar/TypeRun";
import { EntryFormModal, MarkTodayModal, type EntryForm } from "@/components/admin/calendar/EntryModals";
import {
  KIND_LABEL,
  TYPE_LABEL,
  buildMonth,
  eventKey,
  groupEntries,
  longDate,
  monthTitle,
  plural,
  rangeLabel,
  todayIst,
  type CalendarEntry,
  type EntryType,
} from "@/components/admin/calendar/utils";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/teacher/calendar/calendar.css"; // cd- grid and chips
import "@/components/admin/calendar/calendar.css";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY_FORM: EntryForm = {
  scope: "school",
  school_id: "",
  date: todayIst(),
  end_date: "",
  name: "",
  type: "Holiday",
  description: "",
};

export default function AdminCalendarPage() {
  const { schools: rawSchools } = useAdminSchools();
  const schools = useMemo(() => (rawSchools ?? []).map((s) => ({ id: s.id, name: s.name })), [rawSchools]);

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewSchoolId, setViewSchoolId] = useState<string>("all");
  // "YYYY-MM": drives both the grid and the list so they always show the same month.
  const [viewMonthStr, setViewMonthStr] = useState<string>(() => todayIst().slice(0, 7));
  const [viewTab, setViewTab] = useState<"calendar" | "list">("calendar");
  const [typeFilter, setTypeFilter] = useState<EntryType | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const viewYear = parseInt(viewMonthStr.slice(0, 4), 10);
  const viewMonthNum = parseInt(viewMonthStr.slice(5, 7), 10);

  // Per school, the exact dates in the viewed month that somebody teaches there, resolved day by day on the
  // server, so a mid-month working-days change shows up on the day it took effect.
  const [activeDatesBySchool, setActiveDatesBySchool] = useState<Record<string, string[]>>({});
  // "not confirmed yet or the lookup failed" is not the same as "this school has no working days".
  const [activeDatesReady, setActiveDatesReady] = useState(false);
  const [activeWeekdaysError, setActiveWeekdaysError] = useState(false);
  useEffect(() => {
    setActiveDatesReady(false);
    adminApi.calendar
      .activeDates({ year: String(viewYear), month: String(viewMonthNum).padStart(2, "0") })
      .then(({ data }) => {
        setActiveDatesBySchool((data as Record<string, string[]>) ?? {});
        setActiveDatesReady(true);
      })
      .catch(() => setActiveWeekdaysError(true));
  }, [viewYear, viewMonthNum]);
  const isSchoolActiveOnDate = useCallback(
    (schoolId: string, dateStr: string) => {
      if (!activeDatesReady) return true; // do not restrict anything until the data is confirmed
      const dates = activeDatesBySchool[schoolId];
      if (!dates) return false; // no working-days history: nobody works there until a teacher is assigned
      return dates.includes(dateStr);
    },
    [activeDatesBySchool, activeDatesReady],
  );

  // "Mark today" is always about literal today, whichever month is on screen, so it has its own lookup.
  const [todayActiveDatesBySchool, setTodayActiveDatesBySchool] = useState<Record<string, string[]> | null>(null);
  const isSchoolActiveToday = useCallback(
    (schoolId: string) => {
      if (!todayActiveDatesBySchool) return true;
      const dates = todayActiveDatesBySchool[schoolId];
      if (!dates) return false;
      return dates.includes(todayIst());
    },
    [todayActiveDatesBySchool],
  );

  const goToMonth = (delta: number) => {
    const d = new Date(Date.UTC(viewYear, viewMonthNum - 1 + delta, 1));
    setViewMonthStr(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    setSelected(null);
  };
  const goToToday = () => { setViewMonthStr(todayIst().slice(0, 7)); setSelected(todayIst()); };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const calendarFormDirty = useDirtySnapshot(isFormOpen, form);
  const requestCloseCalendarForm = () => { void requestClose(calendarFormDirty, () => setIsFormOpen(false)); };

  const [isMarkTodayOpen, setIsMarkTodayOpen] = useState(false);
  const [markTodayScope, setMarkTodayScope] = useState<"school" | "all">("all");
  const [markTodaySchoolId, setMarkTodaySchoolId] = useState("");
  const [markTodayReason, setMarkTodayReason] = useState("");
  const [markTodayNotes, setMarkTodayNotes] = useState("");
  const [markingToday, setMarkingToday] = useState(false);
  const [markTodayError, setMarkTodayError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ kind: "single" | "batch"; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await adminApi.calendar.list({
        school_id: viewSchoolId !== "all" ? viewSchoolId : undefined,
        year: String(viewYear),
        month: String(viewMonthNum).padStart(2, "0"),
      });
      setEntries(((data as { calendar?: CalendarEntry[] })?.calendar ?? []) as CalendarEntry[]);
    } catch {
      setError("The calendar did not load. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [viewSchoolId, viewYear, viewMonthNum]);

  useEffect(() => { load(); }, [load]);

  const openCreateForm = (opts?: { date?: string }) => {
    setEditingId(null);
    // Default scope and school to what is being viewed, so adding from a day does not mean picking again.
    const prefillScope: "school" | "all" = viewSchoolId === "all" ? "all" : "school";
    const prefillSchoolId = viewSchoolId !== "all" ? viewSchoolId : (schools[0]?.id ?? "");
    setForm({ ...EMPTY_FORM, scope: prefillScope, school_id: prefillSchoolId, date: opts?.date ?? EMPTY_FORM.date });
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (entry: CalendarEntry) => {
    setEditingId(entry.id);
    setForm({
      scope: "school",
      school_id: entry.school_id,
      date: entry.date,
      end_date: entry.end_date ?? "",
      name: entry.name,
      type: entry.type,
      description: entry.description ?? "",
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const patchForm = (patch: Partial<EntryForm>) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      // A school picked for the old date may have nobody working the new one, so clear it.
      if (patch.date && !editingId && next.school_id && !isSchoolActiveOnDate(next.school_id, patch.date)) next.school_id = "";
      return next;
    });

  const submitForm = async () => {
    setFormError(null);
    if (!form.name.trim()) { setFormError("Add a reason, for example Diwali or Republic Day."); return; }
    if (form.scope === "school" && !form.school_id) { setFormError("Choose a school, or switch to All schools."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.calendar.update(editingId, {
          date: form.date,
          end_date: form.end_date || null,
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim() || null,
        });
        toast.success("Entry saved.");
      } else {
        const { data } = await adminApi.calendar.create({
          ...(form.scope === "all" ? { apply_to_all_schools: true } : { school_id: form.school_id }),
          date: form.date,
          end_date: form.end_date || undefined,
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim() || undefined,
        });
        if (form.scope === "all") {
          const applied = (data as { schools_count?: number })?.schools_count ?? 0;
          const total = schools.length;
          if (applied < total) toast.info(`Applied to ${applied} of ${total} schools. The rest have nobody scheduled that day.`);
          else toast.success("Entry added to every school.");
        } else toast.success("Entry added.");
      }
      setIsFormOpen(false);
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg || "Could not save this entry. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const openMarkToday = () => {
    setMarkTodayScope("all");
    setMarkTodaySchoolId("");
    setMarkTodayError(null);
    setIsMarkTodayOpen(true);
    const todayStr = todayIst();
    adminApi.calendar
      .activeDates({ year: todayStr.slice(0, 4), month: todayStr.slice(5, 7) })
      .then(({ data }) => setTodayActiveDatesBySchool((data as Record<string, string[]>) ?? {}))
      .catch(() => setTodayActiveDatesBySchool(null));
  };

  const submitMarkToday = async () => {
    setMarkTodayError(null);
    if (!markTodayReason.trim()) { setMarkTodayError("Add a reason. It shows on attendance reports."); return; }
    if (markTodayScope === "school" && !markTodaySchoolId) { setMarkTodayError("Choose a school, or switch to All schools."); return; }
    setMarkingToday(true);
    try {
      const { data } = await adminApi.calendar.markToday({
        ...(markTodayScope === "all" ? { apply_to_all_schools: true } : { school_id: markTodaySchoolId }),
        name: markTodayReason.trim(),
        description: markTodayNotes.trim() || undefined,
      });
      if (markTodayScope === "all") {
        const applied = (data as { schools_count?: number })?.schools_count ?? 0;
        const total = schools.length;
        if (applied < total) toast.info(`Applied to ${applied} of ${total} schools. The rest have nobody scheduled today.`);
      }
      toast.success("Today is now a holiday.");
      setIsMarkTodayOpen(false);
      setMarkTodayReason("");
      setMarkTodayNotes("");
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMarkTodayError(msg || "Could not mark today as a holiday. Try again.");
    } finally {
      setMarkingToday(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "batch") await adminApi.calendar.deleteBatch(deleteTarget.id);
      else await adminApi.calendar.delete(deleteTarget.id);
      toast.success(`${deleteTarget.label} was deleted.`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Could not delete it. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleGroup = (batchId: string) =>
    setExpandedGroups((prev) => { const next = new Set(prev); if (next.has(batchId)) next.delete(batchId); else next.add(batchId); return next; });

  /* ───────── derived ───────── */
  const schoolName = viewSchoolId === "all" ? "All schools" : schools.find((s) => s.id === viewSchoolId)?.name ?? "";
  const specific = viewSchoolId !== "all";
  const counts: Record<EntryType, number> = { Holiday: 0, Break: 0, HalfDay: 0, CompensatoryWork: 0 };
  const seen = new Set<string>();
  entries.forEach((e) => { const k = eventKey(e); if (!seen.has(k)) { seen.add(k); counts[e.type] += 1; } });
  const visibleEntries = typeFilter ? entries.filter((e) => e.type === typeFilter) : entries;
  const rows = groupEntries(visibleEntries);
  const month = useMemo(
    () => buildMonth(viewYear, viewMonthNum, entries, (date) => specific && activeDatesReady && !isSchoolActiveOnDate(viewSchoolId, date)),
    [viewYear, viewMonthNum, entries, specific, activeDatesReady, isSchoolActiveOnDate, viewSchoolId],
  );
  const daysClosed = month.cells.filter((c) => c.kind === "closed").length;
  const today = todayIst();
  const isCurrentMonth = viewMonthStr === today.slice(0, 7);
  const todayCell = isCurrentMonth ? month.cells.find((c) => c.date === today) : undefined;
  const pickedCell = selected ? month.cells.find((c) => c.date === selected) : undefined;
  const pickedGroups = pickedCell ? groupEntries(pickedCell.entries) : [];

  let status: React.ReactNode;
  if (loading && entries.length === 0) status = "Loading the calendar…";
  else if (error) status = "The calendar did not load. Try again.";
  else if (todayCell?.kind === "closed") status = <><strong>Today is a holiday</strong> {specific ? "at this school" : "at some schools"}. {todayCell.entries[0]?.name}.</>;
  else if (entries.length === 0) status = <>Nothing is declared for <strong>{monthTitle(viewYear, viewMonthNum)}</strong>. Sundays are the weekly off.</>;
  else status = <><strong>{plural(daysClosed, "day")} closed</strong> in {monthTitle(viewYear, viewMonthNum)}, with {plural(Object.values(counts).reduce((a, b) => a + b, 0), "entry", "entries")} in all.</>;

  const entryRow = (e: CalendarEntry, withSchool: boolean) => (
    <div key={e.id} className="ac-ev">
      <span className="ac-ev-main"><b>{e.name}</b><small>{[rangeLabel(e), withSchool ? e.school_name : null, e.description].filter(Boolean).join(" · ")}</small></span>
      <span className="cd-chip" data-t={e.type}>{TYPE_LABEL[e.type]}</span>
      <span className="ac-ev-acts">
        <button type="button" className="pl-ico" aria-label={`Edit ${e.name}`} onClick={() => openEditForm(e)}><Pencil /></button>
        <button type="button" className="pl-ico" aria-label={`Delete ${e.name}`} onClick={() => setDeleteTarget({ kind: "single", id: e.id, label: e.name })}><Trash2 /></button>
      </span>
    </div>
  );

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ac-title">
        <div className="sd-hero-copy">
          <h1 id="ac-title" className="mc-hero-title">School calendar</h1>
          <p className="sd-where">Holidays, breaks and make-up days</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={openMarkToday}><Sun aria-hidden="true" />Mark today as a holiday</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => openCreateForm({ date: selected ?? undefined })}><Plus aria-hidden="true" />Add entry</button>
          </div>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void load()} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        <TypeRun counts={counts} selected={typeFilter} onSelect={setTypeFilter} caption={`In ${monthTitle(viewYear, viewMonthNum)}`} />
      </section>

      <div className="ac-bar">
        <select className="sd-field" aria-label="School" value={viewSchoolId} onChange={(e) => { setViewSchoolId(e.target.value); setSelected(null); }}>
          <option value="all">All schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="ac-nav">
          <button type="button" className="pl-ico" onClick={() => goToMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
          <b aria-live="polite">{monthTitle(viewYear, viewMonthNum)}</b>
          <button type="button" className="pl-ico" onClick={() => goToMonth(1)} aria-label="Next month"><ChevronRight /></button>
          {!isCurrentMonth && <button type="button" className="sd-btn sd-btn--line" style={{ minHeight: "2.25rem" }} onClick={goToToday}>Today</button>}
        </div>
        <span className="ac-views" role="group" aria-label="Layout">
          <button type="button" aria-pressed={viewTab === "calendar"} onClick={() => setViewTab("calendar")}><LayoutGrid aria-hidden="true" />Calendar</button>
          <button type="button" aria-pressed={viewTab === "list"} onClick={() => setViewTab("list")}><List aria-hidden="true" />List</button>
        </span>
      </div>

      {error && <div className="ac-note" role="alert">{error} <button className="sm-reset" style={{ color: "inherit" }} onClick={() => void load()}>Try again</button></div>}
      {activeWeekdaysError && (
        <div className="ac-note" data-tone="warn" role="status">Could not confirm which days each school is staffed, so the grid is not greying out days with nobody scheduled. Refresh the page to try again.</div>
      )}

      {viewTab === "calendar" ? (
        <section className="sd-panel mc-swap" aria-labelledby="ac-grid-h">
          <div className="cd-head">
            <div><h2 id="ac-grid-h">{schoolName}</h2><p>Pick a day to see what is on it. Sundays are the weekly off and need no entry.</p></div>
          </div>
          {loading && entries.length === 0 ? (
            <div className="sd-skel" style={{ height: "24rem" }} />
          ) : (
            <>
              <div className="cd-dow" aria-hidden="true">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
              <ol className="cd-grid">
                {Array.from({ length: month.lead }, (_, i) => <li key={`b${i}`} aria-hidden="true" />)}
                {month.cells.map((c) => {
                  const first = c.entries[0];
                  const dim = typeFilter !== null && !c.entries.some((e) => e.type === typeFilter);
                  return (
                    <li key={c.date}>
                      <button
                        type="button"
                        className="cd-day"
                        data-k={c.kind}
                        data-today={c.date === today}
                        data-dim={dim}
                        aria-pressed={c.date === selected}
                        aria-label={`${longDate(c.date)}: ${KIND_LABEL[c.kind]}${c.entries.length ? `, ${c.entries.map((e) => e.name).join(", ")}` : ""}`}
                        onClick={() => setSelected(c.date === selected ? null : c.date)}
                      >
                        <b>{c.day}</b>
                        {c.entries.length > 0 && <small>{first.name}{c.entries.length > 1 ? ` +${c.entries.length - 1}` : ""}</small>}
                        <span className="cd-marks" aria-hidden="true">
                          {c.entries.slice(0, 3).map((e) => <i key={e.id} data-t={e.type} />)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="cd-key">
                <span><i data-k="work" />Teaching day</span>
                <span><i data-k="closed" />Holiday or break</span>
                <span><i data-k="half" />Half day</span>
                <span><i data-k="comp" />Make-up day</span>
                <span><i data-k="off" />Weekly off</span>
                {specific && <span><i data-k="unassigned" />Nobody scheduled</span>}
              </p>
            </>
          )}

          {pickedCell && (
            <div className="cd-detail" aria-live="polite">
              <div className="cd-detail-head">
                <h3>{longDate(pickedCell.date)}</h3>
                <span className="cd-chip" data-k={pickedCell.kind}>{KIND_LABEL[pickedCell.kind]}</span>
              </div>
              {pickedGroups.length === 0 ? (
                <p className="cd-fine">{pickedCell.kind === "off" ? "Sunday is the weekly off. Add a make-up day to teach on it." : pickedCell.kind === "unassigned" ? "Nobody is scheduled at this school on this day." : "Nothing special on the calendar."}</p>
              ) : (
                <div>
                  {pickedGroups.map((g) =>
                    g.kind === "single" ? entryRow(g.entry, !specific) : (
                      <div key={g.batchId} className="ac-ev">
                        <span className="ac-ev-main"><b>{g.entries[0].name}</b><small>{[rangeLabel(g.entries[0]), `Applied to ${plural(g.entries.length, "school")}`, g.entries[0].description].filter(Boolean).join(" · ")}</small></span>
                        <span className="cd-chip" data-t={g.entries[0].type}>{TYPE_LABEL[g.entries[0].type]}</span>
                        <span className="ac-ev-acts">
                          <button type="button" className="pl-ico" aria-label={`Delete ${g.entries[0].name} from every school`} onClick={() => setDeleteTarget({ kind: "batch", id: g.batchId, label: `${g.entries[0].name} (all schools)` })}><Trash2 /></button>
                        </span>
                      </div>
                    ),
                  )}
                </div>
              )}
              <div className="ac-detail-acts">
                <button className="sd-btn sd-btn--amber" onClick={() => openCreateForm({ date: pickedCell.date })} disabled={pickedCell.kind === "unassigned"}><Plus aria-hidden="true" />Add an entry for this day</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="sd-panel ac-list mc-swap" aria-label={`Calendar entries, ${monthTitle(viewYear, viewMonthNum)}`}>
          {loading && entries.length === 0 ? (
            <div style={{ padding: "1.25rem" }}><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : rows.length === 0 ? (
            <div className="sd-empty" style={{ padding: "1.5rem 1.25rem" }}>
              <b>{typeFilter ? `No ${TYPE_LABEL[typeFilter].toLowerCase()}s in ${monthTitle(viewYear, viewMonthNum)}` : `Nothing declared for ${monthTitle(viewYear, viewMonthNum)}`}</b>
              <p>{typeFilter ? "Pick another kind, or show every kind." : "Holidays, breaks, half days and make-up days you add show up here."}</p>
              <button className="sd-btn sd-btn--amber" onClick={() => openCreateForm()}><Plus aria-hidden="true" />Add entry</button>
            </div>
          ) : (
            rows.map((row) => {
              if (row.kind === "single") {
                const e = row.entry;
                return (
                  <div key={e.id} className="ac-row">
                    <span className="ac-date">{rangeLabel(e)}</span>
                    <span className="ac-main"><b>{e.name}</b><small>{[specific ? null : e.school_name, e.description].filter(Boolean).join(" · ")}</small></span>
                    <span className="cd-chip" data-t={e.type}>{TYPE_LABEL[e.type]}</span>
                    <span className="ac-ev-acts">
                      <button type="button" className="pl-ico" aria-label={`Edit ${e.name}`} onClick={() => openEditForm(e)}><Pencil /></button>
                      <button type="button" className="pl-ico" aria-label={`Delete ${e.name}`} onClick={() => setDeleteTarget({ kind: "single", id: e.id, label: e.name })}><Trash2 /></button>
                    </span>
                  </div>
                );
              }
              const first = row.entries[0];
              const open = expandedGroups.has(row.batchId);
              return (
                <div key={row.batchId}>
                  <div className="ac-row" data-batch="true">
                    <span className="ac-date">{rangeLabel(first)}</span>
                    <button type="button" className="ac-main" aria-expanded={open} onClick={() => toggleGroup(row.batchId)}>
                      <b>{first.name}</b>
                      <small>{[`Applied to ${plural(row.entries.length, "school")}. ${open ? "Hide them" : "Show them"}`, first.description].filter(Boolean).join(" · ")}</small>
                    </button>
                    <span className="cd-chip" data-t={first.type}>{TYPE_LABEL[first.type]}</span>
                    <span className="ac-ev-acts">
                      <button type="button" className="pl-ico" aria-label={`Delete ${first.name} from every school`} onClick={() => setDeleteTarget({ kind: "batch", id: row.batchId, label: `${first.name} (all schools)` })}><Trash2 /></button>
                    </span>
                  </div>
                  {open && row.entries.slice().sort((a, b) => a.school_name.localeCompare(b.school_name)).map((e) => (
                    <div key={e.id} className="ac-sub">
                      <span>{e.school_name}</span>
                      <button type="button" className="pl-ico" aria-label={`Delete ${e.name} at ${e.school_name}`} onClick={() => setDeleteTarget({ kind: "single", id: e.id, label: `${e.name}, ${e.school_name}` })}><Trash2 /></button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </section>
      )}

      <EntryFormModal
        open={isFormOpen}
        editing={!!editingId}
        form={form}
        onChange={patchForm}
        schools={schools}
        schoolsOnDate={schools.filter((s) => isSchoolActiveOnDate(s.id, form.date))}
        error={formError}
        busy={saving}
        onSubmit={() => void submitForm()}
        onClose={requestCloseCalendarForm}
      />

      <MarkTodayModal
        open={isMarkTodayOpen}
        scope={markTodayScope}
        onScope={setMarkTodayScope}
        schoolId={markTodaySchoolId}
        onSchool={setMarkTodaySchoolId}
        reason={markTodayReason}
        onReason={setMarkTodayReason}
        notes={markTodayNotes}
        onNotes={setMarkTodayNotes}
        schools={schools.filter((s) => isSchoolActiveToday(s.id))}
        error={markTodayError}
        busy={markingToday}
        onSubmit={() => void submitMarkToday()}
        onClose={() => setIsMarkTodayOpen(false)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this calendar entry?"
        subtitle={deleteTarget?.label}
        confirmLabel="Delete entry"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      >
        <p>{deleteTarget?.kind === "batch" ? "It is removed from every school it was applied to." : "This cannot be undone."} Attendance for those days is worked out again.</p>
      </ConfirmModal>
    </div>
  );
}

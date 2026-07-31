"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { WEEKDAY_LABELS } from "@/lib/weekday-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  Plus,
  Zap,
  Sun,
  Coffee,
  AlertCircle,
  Trash2,
  Pencil,
  Loader2,
  School,
  Globe,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  List,
  LayoutGrid,
} from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { toast } from "@/components/ui/toast";

interface CalendarEntry {
  id: string;
  school_id: string;
  school_name: string;
  date: string;
  end_date: string | null;
  name: string;
  type: "Holiday" | "Break" | "HalfDay" | "CompensatoryWork";
  academic_year: string;
  description: string | null;
  batch_id: string | null;
  created_at: string;
}

const TYPE_CFG: Record<
  CalendarEntry["type"],
  { label: string; icon: React.ReactNode; cls: string }
> = {
  Holiday: { label: "Holiday", icon: <Sun className="h-3.5 w-3.5" />, cls: "bg-red-100 text-red-800 border-red-200" },
  Break: { label: "Break", icon: <Coffee className="h-3.5 w-3.5" />, cls: "bg-orange-100 text-orange-800 border-orange-200" },
  HalfDay: { label: "Half Day", icon: <AlertCircle className="h-3.5 w-3.5" />, cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  CompensatoryWork: { label: "Compensatory Work", icon: <Zap className="h-3.5 w-3.5" />, cls: "bg-blue-100 text-blue-800 border-blue-200" },
};

function formatDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function todayIstStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** True if `dateStr` falls within [entry.date, entry.end_date ?? entry.date]. */
function entryCoversDate(entry: CalendarEntry, dateStr: string): boolean {
  const end = entry.end_date ?? entry.date;
  return entry.date <= dateStr && dateStr <= end;
}

interface DayCell {
  dateStr: string;
  day: number;
  isSunday: boolean;
  entries: CalendarEntry[];
}

/** Standard Sun-start month grid: leading/trailing nulls pad partial weeks. */
function buildMonthGrid(year: number, month: number, entries: CalendarEntry[]): (DayCell | null)[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = firstOfMonth.getUTCDay(); // 0=Sun

  const cells: (DayCell | null)[] = Array.from({ length: startWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    cells.push({
      dateStr,
      day,
      isSunday: dow === 0,
      entries: entries.filter((e) => entryCoversDate(e, dateStr)),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type FormState = {
  scope: "school" | "all";
  school_id: string;
  date: string;
  end_date: string;
  name: string;
  type: CalendarEntry["type"];
  description: string;
};

const EMPTY_FORM: FormState = {
  scope: "school",
  school_id: "",
  date: todayIstStr(),
  end_date: "",
  name: "",
  type: "Holiday",
  description: "",
};

export default function AdminCalendarPage() {
  const { schools: rawSchools } = useAdminSchools();
  const schools = useMemo(
    () => (rawSchools ?? []).map((s) => ({ id: s.id, name: s.name })),
    [rawSchools],
  );

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per school, which weekdays (0=Sun..6=Sat) at least one teacher actually
  // works there — a school absent from this map has no teachers assigned
  // yet, so it has no working days at all until one is assigned.
  const [viewSchoolId, setViewSchoolId] = useState<string>("all");
  // "YYYY-MM" — drives both the calendar grid and the list view so they
  // always show the same month; prev/next arrows walk this forward/back.
  const [viewMonthStr, setViewMonthStr] = useState<string>(() => todayIstStr().slice(0, 7));
  const [viewTab, setViewTab] = useState<"calendar" | "list">("calendar");
  const viewYear = parseInt(viewMonthStr.slice(0, 4), 10);
  const viewMonthNum = parseInt(viewMonthStr.slice(5, 7), 10);

  // Per school, the exact dates in the *viewed* month that are an active
  // working day for at least one teacher — resolved day-by-day server-side
  // (see AdminCalendarService.getActiveDatesBySchoolForMonth), so a
  // mid-month working-days change shows up precisely on the day it actually
  // took effect instead of one flat weekday pattern approximating the whole
  // month.
  const [activeDatesBySchool, setActiveDatesBySchool] = useState<Record<string, string[]>>({});
  // Distinguishes "haven't confirmed yet / lookup failed" from "confirmed
  // this school has zero working days" — without this, a failed or slow
  // fetch would look identical to "nobody is scheduled anywhere," greying
  // out the whole calendar even though the data is fine.
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
      // Don't restrict anything until we've actually confirmed the data —
      // otherwise a not-yet-loaded or failed lookup falsely shows every
      // school as having nobody scheduled.
      if (!activeDatesReady) return true;
      const dates = activeDatesBySchool[schoolId];
      // No working-days history at all for this school → no working days
      // until a teacher is assigned there (not "every day is fine").
      if (!dates) return false;
      return dates.includes(dateStr);
    },
    [activeDatesBySchool, activeDatesReady],
  );

  // Separate from activeDatesBySchool (which tracks whichever month is
  // being *viewed*) — "Mark Today" is always about literal today regardless
  // of which month the admin has navigated to, so it needs its own fetch
  // for today's own month rather than reusing a map that might be resolved
  // for a different month.
  const [todayActiveDatesBySchool, setTodayActiveDatesBySchool] = useState<Record<string, string[]> | null>(null);
  const isSchoolActiveToday = useCallback(
    (schoolId: string) => {
      if (!todayActiveDatesBySchool) return true;
      const dates = todayActiveDatesBySchool[schoolId];
      if (!dates) return false;
      return dates.includes(todayIstStr());
    },
    [todayActiveDatesBySchool],
  );

  const goToMonth = (delta: number) => {
    const d = new Date(Date.UTC(viewYear, viewMonthNum - 1 + delta, 1));
    setViewMonthStr(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const goToToday = () => setViewMonthStr(todayIstStr().slice(0, 7));

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      setError("Failed to load the calendar.");
    } finally {
      setLoading(false);
    }
  }, [viewSchoolId, viewYear, viewMonthNum]);

  useEffect(() => {
    load();
  }, [load]);

  // Group entries applied to every school (same batch_id) into one row.
  const groupedEntries = useMemo(() => {
    const byBatch = new Map<string, CalendarEntry[]>();
    const standalone: CalendarEntry[] = [];
    for (const e of entries) {
      if (e.batch_id) {
        if (!byBatch.has(e.batch_id)) byBatch.set(e.batch_id, []);
        byBatch.get(e.batch_id)!.push(e);
      } else {
        standalone.push(e);
      }
    }
    type Row =
      | { kind: "single"; entry: CalendarEntry; sortDate: string }
      | { kind: "batch"; batchId: string; entries: CalendarEntry[]; sortDate: string };
    const rows: Row[] = [
      ...standalone.map((entry): Row => ({ kind: "single", entry, sortDate: entry.date })),
      ...Array.from(byBatch.entries()).map(([batchId, list]): Row => ({
        kind: "batch",
        batchId,
        entries: list,
        sortDate: list[0].date,
      })),
    ];
    return rows.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  }, [entries]);

  const openCreateForm = (opts?: { date?: string }) => {
    setEditingId(null);
    // Default scope/school to whatever's currently being viewed — clicking a
    // day while looking at one school shouldn't require re-selecting it.
    const prefillScope: "school" | "all" = viewSchoolId === "all" ? "all" : "school";
    const prefillSchoolId = viewSchoolId !== "all" ? viewSchoolId : (schools[0]?.id ?? "");
    setForm({
      ...EMPTY_FORM,
      scope: prefillScope,
      school_id: prefillSchoolId,
      date: opts?.date ?? EMPTY_FORM.date,
    });
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

  const submitForm = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("A reason is required (e.g. \"Diwali\", \"Republic Day\").");
      return;
    }
    if (form.scope === "school" && !form.school_id) {
      setFormError("Choose a school, or switch to \"All schools\".");
      return;
    }
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
      } else {
        const { data } = await adminApi.calendar.create({
          ...(form.scope === "all"
            ? { apply_to_all_schools: true }
            : { school_id: form.school_id }),
          date: form.date,
          end_date: form.end_date || undefined,
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim() || undefined,
        });
        if (form.scope === "all") {
          const applied = (data as { schools_count?: number })?.schools_count ?? 0;
          const total = schools.length;
          if (applied < total) {
            toast.info(`Applied to ${applied} of ${total} schools — the rest have no one scheduled that day.`);
          }
        }
      }
      setIsFormOpen(false);
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg || "Failed to save this entry.");
    } finally {
      setSaving(false);
    }
  };

  const submitMarkToday = async () => {
    setMarkTodayError(null);
    if (!markTodayReason.trim()) {
      setMarkTodayError("A reason is required — this shows up on attendance reports.");
      return;
    }
    if (markTodayScope === "school" && !markTodaySchoolId) {
      setMarkTodayError("Choose a school, or switch to \"All schools\".");
      return;
    }
    setMarkingToday(true);
    try {
      const { data } = await adminApi.calendar.markToday({
        ...(markTodayScope === "all"
          ? { apply_to_all_schools: true }
          : { school_id: markTodaySchoolId }),
        name: markTodayReason.trim(),
        description: markTodayNotes.trim() || undefined,
      });
      if (markTodayScope === "all") {
        const applied = (data as { schools_count?: number })?.schools_count ?? 0;
        const total = schools.length;
        if (applied < total) {
          toast.info(`Applied to ${applied} of ${total} schools — the rest have no one scheduled today.`);
        }
      }
      setIsMarkTodayOpen(false);
      setMarkTodayReason("");
      setMarkTodayNotes("");
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMarkTodayError(msg || "Failed to mark today as a holiday.");
    } finally {
      setMarkingToday(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "batch") {
        await adminApi.calendar.deleteBatch(deleteTarget.id);
      } else {
        await adminApi.calendar.delete(deleteTarget.id);
      }
      setDeleteTarget(null);
      await load();
    } catch {
      setError("Failed to delete. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleGroup = (batchId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-blue-600" />
            School Calendar
          </h1>
          <p className="text-gray-600 mt-2">
            Holidays, breaks, half-days, and compensatory work days. Declaring a day
            here immediately corrects attendance for it — no separate step needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-red-400 text-red-700 hover:bg-red-50"
            onClick={() => {
              setMarkTodayScope("all");
              setMarkTodaySchoolId("");
              setMarkTodayError(null);
              setIsMarkTodayOpen(true);
              // Always fetched fresh for literal today, independent of
              // whichever month is currently being browsed in the grid.
              const todayStr = todayIstStr();
              adminApi.calendar
                .activeDates({ year: todayStr.slice(0, 4), month: todayStr.slice(5, 7) })
                .then(({ data }) => setTodayActiveDatesBySchool((data as Record<string, string[]>) ?? {}))
                .catch(() => setTodayActiveDatesBySchool(null));
            }}
          >
            <Sun className="h-4 w-4 mr-2" />
            Mark Today as Holiday
          </Button>
          <Button onClick={() => openCreateForm()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-500 whitespace-nowrap">School</Label>
                <Select value={viewSchoolId} onValueChange={setViewSchoolId}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All schools</SelectItem>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => goToMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="w-40 text-center font-medium text-gray-900">
                  {MONTH_NAMES[viewMonthNum - 1]} {viewYear}
                </div>
                <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => goToMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {viewMonthStr !== todayIstStr().slice(0, 7) && (
                  <Button variant="ghost" size="sm" className="h-9 text-xs text-gray-500" onClick={goToToday}>
                    Today
                  </Button>
                )}
              </div>
            </div>
            <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as "calendar" | "list")}>
              <TabsList>
                <TabsTrigger value="calendar" className="gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" /> Calendar
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5">
                  <List className="h-3.5 w-3.5" /> List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {activeWeekdaysError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Couldn&apos;t confirm which days schools are actually staffed — the grid below isn&apos;t restricting by
          working days right now. Refresh the page to try again.
        </div>
      )}

      {/* Calendar grid view */}
      {viewTab === "calendar" && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {viewSchoolId === "all" ? "All Schools" : schools.find((s) => s.id === viewSchoolId)?.name ?? ""}
            </CardTitle>
            <CardDescription>
              Click any day to add an entry for it. Sundays are always the weekly off —
              they don&apos;t need to be marked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                  {WEEKDAY_LABELS.map((w) => (
                    <div key={w} className="text-center text-xs font-semibold text-gray-400 uppercase py-1">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {buildMonthGrid(viewYear, viewMonthNum, entries).map((cell, idx) => {
                    if (!cell) return <div key={`blank-${idx}`} />;
                    const compEntry = cell.entries.find((e) => e.type === "CompensatoryWork");
                    const offEntry = cell.entries.find((e) => e.type === "Holiday" || e.type === "Break");
                    const halfDayEntry = cell.entries.find((e) => e.type === "HalfDay");
                    // Sunday is off by default, unless a CompensatoryWork entry
                    // explicitly turns it into a working day.
                    const isOff = (cell.isSunday && !compEntry) || !!offEntry;
                    // Only meaningful when viewing one specific school: a
                    // plain weekday nobody's assigned to work there — no
                    // point letting an entry be created for it (the
                    // attendance math already excludes it with zero
                    // admin action needed).
                    const isNotScheduled =
                      viewSchoolId !== "all" &&
                      !isOff &&
                      !halfDayEntry &&
                      !compEntry &&
                      !isSchoolActiveOnDate(viewSchoolId, cell.dateStr);
                    const cellCls = isOff
                      ? "bg-red-50 border-red-200"
                      : halfDayEntry
                        ? "bg-yellow-50 border-yellow-200"
                        : compEntry
                          ? "bg-blue-50 border-blue-200"
                          : isNotScheduled
                            ? "bg-gray-100 border-gray-200"
                            : "bg-green-50/60 border-green-100";
                    const uniqueSchools = new Set(cell.entries.map((e) => e.school_id)).size;
                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        disabled={isNotScheduled}
                        onClick={() => openCreateForm({ date: cell.dateStr })}
                        className={`relative flex flex-col items-start rounded-lg border p-2 min-h-[5.5rem] text-left transition-colors ${isNotScheduled ? "cursor-default" : "hover:ring-2 hover:ring-blue-300"} ${cellCls}`}
                      >
                        <span className={`text-sm font-semibold ${cell.isSunday ? "text-red-600" : isNotScheduled ? "text-gray-400" : "text-gray-700"}`}>
                          {cell.day}
                        </span>
                        <div className="mt-1 flex flex-col gap-0.5 w-full">
                          {cell.isSunday && !compEntry && (
                            <span className="text-[10px] font-medium text-red-600">Weekly Off</span>
                          )}
                          {isNotScheduled && (
                            <span className="text-[10px] font-medium text-gray-400">No one scheduled</span>
                          )}
                          {cell.entries.slice(0, 2).map((e) => (
                            <span
                              key={e.id}
                              className={`truncate text-[10px] font-medium px-1 py-0.5 rounded ${TYPE_CFG[e.type].cls}`}
                              title={`${e.name}${viewSchoolId === "all" ? ` — ${e.school_name}` : ""}`}
                            >
                              {e.name}
                            </span>
                          ))}
                          {cell.entries.length > 2 && (
                            <span className="text-[10px] text-gray-400">+{cell.entries.length - 2} more</span>
                          )}
                          {viewSchoolId === "all" && uniqueSchools > 1 && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Globe className="h-2.5 w-2.5" /> {uniqueSchools} schools
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-50 border border-green-200" /> Working day</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-50 border border-red-200" /> Holiday / Sunday</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-yellow-50 border border-yellow-200" /> Half day</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-50 border border-blue-200" /> Compensatory work</span>
                  {viewSchoolId !== "all" && (
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-gray-100 border border-gray-200" /> Not scheduled (no teacher assigned that day)</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* List view */}
      {viewTab === "list" && (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {viewSchoolId === "all" ? "All Schools" : schools.find((s) => s.id === viewSchoolId)?.name ?? ""}
            {" · "}{MONTH_NAMES[viewMonthNum - 1]} {viewYear}
          </CardTitle>
          <CardDescription>
            {viewSchoolId === "all"
              ? "Entries applied to every school at once are grouped into a single row."
              : "Holidays, breaks, half-days, and compensatory work days declared for this school."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : groupedEntries.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              No calendar entries for {MONTH_NAMES[viewMonthNum - 1]} {viewYear}.
            </div>
          ) : (
            <div className="divide-y">
              {groupedEntries.map((row) => {
                if (row.kind === "single") {
                  const e = row.entry;
                  const cfg = TYPE_CFG[e.type];
                  return (
                    <div key={e.id} className="flex items-start justify-between gap-4 px-6 py-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <Badge variant="outline" className={`${cfg.cls} flex items-center gap-1 mt-0.5 shrink-0`}>
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{e.name}</div>
                          <div className="text-sm text-gray-500">
                            {formatDate(e.date)}
                            {e.end_date && e.end_date !== e.date ? ` – ${formatDate(e.end_date)}` : ""}
                            {viewSchoolId === "all" && (
                              <>
                                {" · "}
                                <span className="inline-flex items-center gap-1"><School className="h-3 w-3" />{e.school_name}</span>
                              </>
                            )}
                          </div>
                          {e.description && (
                            <p className="text-sm text-gray-500 mt-1">{e.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEditForm(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => setDeleteTarget({ kind: "single", id: e.id, label: e.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                const first = row.entries[0];
                const cfg = TYPE_CFG[first.type];
                const expanded = expandedGroups.has(row.batchId);
                return (
                  <div key={row.batchId}>
                    <div className="flex items-start justify-between gap-4 px-6 py-4 bg-blue-50/40">
                      <button
                        className="flex items-start gap-3 min-w-0 text-left flex-1"
                        onClick={() => toggleGroup(row.batchId)}
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                        )}
                        <Badge variant="outline" className={`${cfg.cls} flex items-center gap-1 mt-0.5 shrink-0`}>
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{first.name}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            {formatDate(first.date)}
                            {first.end_date && first.end_date !== first.date ? ` – ${formatDate(first.end_date)}` : ""}
                            {" · "}
                            <Globe className="h-3 w-3" /> Applied to {row.entries.length} schools
                          </div>
                          {first.description && (
                            <p className="text-sm text-gray-500 mt-1">{first.description}</p>
                          )}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 shrink-0"
                        onClick={() => setDeleteTarget({ kind: "batch", id: row.batchId, label: `${first.name} (all schools)` })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {expanded && (
                      <div className="divide-y bg-gray-50/50">
                        {row.entries
                          .slice()
                          .sort((a, b) => a.school_name.localeCompare(b.school_name))
                          .map((e) => (
                            <div key={e.id} className="flex items-center justify-between px-6 py-2 pl-14">
                              <span className="text-sm text-gray-700 flex items-center gap-1.5">
                                <School className="h-3.5 w-3.5 text-gray-400" />
                                {e.school_name}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-600"
                                onClick={() => setDeleteTarget({ kind: "single", id: e.id, label: `${e.name} — ${e.school_name}` })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Add / Edit entry dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit calendar entry" : "Add calendar entry"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this entry."
                : "Declare a holiday, break, half-day, or compensatory working day."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingId && (
              <div className="space-y-2">
                <Label>Apply to</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={form.scope === "school" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setForm((f) => ({ ...f, scope: "school" }))}
                  >
                    <School className="h-4 w-4 mr-1.5" /> One school
                  </Button>
                  <Button
                    type="button"
                    variant={form.scope === "all" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setForm((f) => ({ ...f, scope: "all" }))}
                  >
                    <Globe className="h-4 w-4 mr-1.5" /> All schools
                  </Button>
                </div>
              </div>
            )}
            {(editingId || form.scope === "school") && (
              <div className="space-y-2">
                <Label>School</Label>
                <Select
                  value={form.school_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, school_id: v }))}
                  disabled={!!editingId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {(editingId ? schools : schools.filter((s) => isSchoolActiveOnDate(s.id, form.date))).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!editingId && schools.filter((s) => isSchoolActiveOnDate(s.id, form.date)).length === 0 && (
                  <p className="text-xs text-amber-600">
                    No school has anyone working on this day — pick a different date, or use &quot;All schools&quot;.
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setForm((f) => ({
                      ...f,
                      date: newDate,
                      // A school picked for the old date may no longer have
                      // anyone working the new date's weekday — clear it
                      // rather than silently keep an invalid selection.
                      school_id:
                        !editingId && f.school_id && !isSchoolActiveOnDate(f.school_id, newDate)
                          ? ""
                          : f.school_id,
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>End date (optional)</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as CalendarEntry["type"] }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {(Object.keys(TYPE_CFG) as CalendarEntry["type"][]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_CFG[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.type === "HalfDay" && (
                <p className="text-xs text-gray-500">Half days still count as a working day for attendance.</p>
              )}
              {form.type === "CompensatoryWork" && (
                <p className="text-xs text-gray-500">Marks an off-day (e.g. Saturday) as an actual working day.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Diwali, Republic Day, Local bandh"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Any extra context for staff"
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? "Save changes" : "Add entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark today as holiday — quick action for sudden closures */}
      <Dialog open={isMarkTodayOpen} onOpenChange={setIsMarkTodayOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-red-500" />
              Mark today as a holiday
            </DialogTitle>
            <DialogDescription>
              For a sudden closure — a bandh, weather, an emergency. Today&apos;s date
              is filled in automatically; this immediately excludes today from
              working-day totals and stops it from counting as an absence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Apply to</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={markTodayScope === "school" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setMarkTodayScope("school")}
                >
                  <School className="h-4 w-4 mr-1.5" /> One school
                </Button>
                <Button
                  type="button"
                  variant={markTodayScope === "all" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setMarkTodayScope("all")}
                >
                  <Globe className="h-4 w-4 mr-1.5" /> All schools
                </Button>
              </div>
            </div>
            {markTodayScope === "school" && (
              <div className="space-y-2">
                <Label>School</Label>
                <Select value={markTodaySchoolId} onValueChange={setMarkTodaySchoolId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {schools.filter((s) => isSchoolActiveToday(s.id)).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {schools.filter((s) => isSchoolActiveToday(s.id)).length === 0 && (
                  <p className="text-xs text-amber-600">
                    No school has anyone working today — try &quot;All schools&quot; or the full Add Entry form.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Input
                value={markTodayReason}
                onChange={(e) => setMarkTodayReason(e.target.value)}
                placeholder="e.g. City-wide bandh, heavy flooding"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={markTodayNotes}
                onChange={(e) => setMarkTodayNotes(e.target.value)}
                placeholder="Any extra context for staff"
              />
            </div>
            {markTodayError && <p className="text-sm text-red-600">{markTodayError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMarkTodayOpen(false)} disabled={markingToday}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={submitMarkToday}
              disabled={markingToday}
            >
              {markingToday ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sun className="h-4 w-4 mr-2" />}
              Mark as holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Delete calendar entry</DialogTitle>
            <DialogDescription>
              {deleteTarget?.kind === "batch"
                ? "This removes it from every school it was applied to."
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm text-gray-700 py-2">
              Delete <span className="font-semibold">{deleteTarget.label}</span>?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

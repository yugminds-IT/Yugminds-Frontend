"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { teacherApi, setAuthToken } from "@/lib/api";
import { WEEKDAY_LABELS } from "@/lib/weekday-utils";
import { getSession } from "@/lib/session-utils";
import { useTeacherSchool } from "../context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface CalendarEntry {
  id: string;
  school_id: string;
  school_name: string;
  date: string;
  end_date: string | null;
  name: string;
  type: "Holiday" | "Break" | "HalfDay" | "CompensatoryWork";
  description: string | null;
}

interface ScheduleDay {
  date: string;
  school_id: string;
  school_name: string;
}

const SCHOOL_TAG_COLORS = [
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-sky-50 text-sky-700 border-sky-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-pink-50 text-pink-700 border-pink-200",
];

const TYPE_STYLES: Record<CalendarEntry["type"], string> = {
  Holiday: "bg-red-100 text-red-700 border-red-200",
  Break: "bg-orange-100 text-orange-700 border-orange-200",
  HalfDay: "bg-amber-100 text-amber-700 border-amber-200",
  CompensatoryWork: "bg-blue-100 text-blue-700 border-blue-200",
};

const TYPE_LABELS: Record<CalendarEntry["type"], string> = {
  Holiday: "Holiday",
  Break: "Break",
  HalfDay: "Half Day",
  CompensatoryWork: "Compensatory Work",
};

/**
 * Read-only view of the teacher's own assigned schools' holiday/break
 * calendars — previously there was no teacher-facing way to see this at
 * all, so a teacher working at School A (open today) and School B (holiday
 * today) had no way to tell why "today" behaved differently between them.
 */
export default function TeacherCalendarPage() {
  const { schools } = useTeacherSchool();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "calendar", year, month],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error("Not authenticated");
      setAuthToken(session.access_token || null);
      const { data } = await teacherApi.calendar.list({
        year: String(year),
        month: String(month).padStart(2, "0"),
      });
      const body = data as {
        calendar?: CalendarEntry[];
        schedule?: ScheduleDay[];
        unassigned_dates?: string[];
      };
      return {
        calendar: body?.calendar ?? [],
        schedule: body?.schedule ?? [],
        unassignedDates: body?.unassigned_dates ?? [],
      };
    },
  });

  const unassignedDateSet = useMemo(
    () => new Set(data?.unassignedDates ?? []),
    [data],
  );

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, ScheduleDay[]>();
    for (const s of data?.schedule ?? []) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return map;
  }, [data]);

  const schoolColorById = useMemo(() => {
    const map = new Map<string, string>();
    schools.forEach((s, i) => {
      if (s.id) map.set(s.id, SCHOOL_TAG_COLORS[i % SCHOOL_TAG_COLORS.length]);
    });
    return map;
  }, [schools]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of data?.calendar ?? []) {
      const start = new Date(e.date + "T00:00:00.000Z");
      const end = e.end_date ? new Date(e.end_date + "T00:00:00.000Z") : start;
      for (
        const d = new Date(start);
        d <= end;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const key = d.toISOString().split("T")[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
    }
    return map;
  }, [data]);

  const goToMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  };

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: Array<{ day: number; dateStr: string } | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      dateStr: `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6" />
          School Calendar
        </h1>
        <p className="text-muted-foreground text-sm">
          Holidays, breaks and compensatory working days across all of your assigned schools.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{monthLabel}</CardTitle>
              <CardDescription>
                {schools.length > 1
                  ? `Showing all ${schools.length} of your assigned schools`
                  : schools[0]?.name ?? "Your school"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => goToMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => goToMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading calendar…</div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1">
                {WEEKDAY_LABELS.map((d) => (
                  <div key={d} className="text-center py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, i) => {
                  if (!cell) return <div key={`empty-${i}`} className="min-h-[76px]" />;
                  const entries = entriesByDate.get(cell.dateStr) ?? [];
                  const scheduledSchools = scheduleByDate.get(cell.dateStr) ?? [];
                  // Two distinct reasons a day can show no scheduled school:
                  // genuinely off under your CURRENT pattern (e.g. Sunday) vs.
                  // you had no assignment at ANY school yet on that date
                  // (true for every weekday before your first-ever
                  // assignment, not just the structurally-off ones) —
                  // conflating them as one "Weekly off" label was misleading
                  // for anyone looking at dates before they joined.
                  const isUnassigned = unassignedDateSet.has(cell.dateStr);
                  const isOff = !isUnassigned && scheduledSchools.length === 0;
                  return (
                    <div
                      key={cell.dateStr}
                      className={`min-h-[76px] rounded border p-1 text-xs ${
                        isOff
                          ? "bg-red-50 border-red-100"
                          : isUnassigned
                            ? "bg-gray-50 border-gray-100"
                            : "border-gray-100"
                      }`}
                    >
                      <div className="font-medium text-gray-700">{cell.day}</div>
                      {isUnassigned ? (
                        <div
                          className="text-[10px] text-gray-400 mt-0.5"
                          title="You weren't assigned to any school yet on this date"
                        >
                          Not yet assigned
                        </div>
                      ) : isOff ? (
                        <div className="text-[10px] text-red-500 mt-0.5">Weekly off</div>
                      ) : (
                        <div className="space-y-0.5 mt-0.5">
                          {scheduledSchools.map((s) => (
                            <div
                              key={s.school_id}
                              title={s.school_name}
                              className={`truncate rounded px-1 py-0.5 border text-[10px] ${
                                schoolColorById.get(s.school_id) ?? SCHOOL_TAG_COLORS[0]
                              }`}
                            >
                              {s.school_name}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-0.5 mt-0.5">
                        {entries.slice(0, 3).map((e) => (
                          <div
                            key={e.id + e.school_id}
                            title={`${e.school_name}: ${e.name}${e.description ? " — " + e.description : ""}`}
                            className={`truncate rounded px-1 py-0.5 border text-[10px] ${TYPE_STYLES[e.type]}`}
                          >
                            {schools.length > 1 ? `${e.school_name}: ` : ""}
                            {e.name}
                          </div>
                        ))}
                        {entries.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">+{entries.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t text-xs">
                {(Object.keys(TYPE_LABELS) as CalendarEntry["type"][]).map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <span className={`inline-block w-3 h-3 rounded border ${TYPE_STYLES[t]}`} />
                    {TYPE_LABELS[t]}
                  </div>
                ))}
                {unassignedDateSet.size > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded border bg-gray-50 border-gray-200" />
                    Not yet assigned
                  </div>
                )}
                {schools.length > 1 && (
                  <>
                    <span className="text-muted-foreground/40">|</span>
                    {schools.map((s) => (
                      <div key={s.id} className="flex items-center gap-1.5">
                        <span
                          className={`inline-block w-3 h-3 rounded border ${
                            (s.id && schoolColorById.get(s.id)) ?? SCHOOL_TAG_COLORS[0]
                          }`}
                        />
                        {s.name}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {schools.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Schools</CardTitle>
            <CardDescription>
              Each day above shows which school(s) you&apos;re scheduled at — a mid-week or mid-month
              schedule change (e.g. swapping which days you go to which school) is reflected
              automatically from the date it takes effect.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {schools.map((s) => (
              <Badge
                key={s.id}
                variant="outline"
                className={(s.id && schoolColorById.get(s.id)) ?? SCHOOL_TAG_COLORS[0]}
              >
                {s.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

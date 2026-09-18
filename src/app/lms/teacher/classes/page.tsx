"use client";

import { useTeacherSchool } from "../context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useTeacherClasses,
  useTeacherSchedules,
  formatGradeSection,
  type TeacherClassRow,
  type TeacherScheduleRow,
} from "@/hooks/useTeacherData";
import { BookOpen, FileText, AlertCircle, Filter, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { frontendLogger } from "@/lib/frontend-logger";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { WEEKDAY_NAMES_MON_FIRST } from "@/lib/weekday-utils";

/**
 * My Classes Page
 *
 * Displays all classes assigned to the teacher
 */
const DAYS_OF_WEEK = WEEKDAY_NAMES_MON_FIRST;
/** Timetable columns: Mon–Sat (Sunday usually closed). */
const GRID_DAYS = WEEKDAY_NAMES_MON_FIRST.slice(0, 6);

type ScheduleRow = TeacherScheduleRow;
type ClassRow = TeacherClassRow;

function formatTime(time?: string | null) {
  if (!time) return '';
  const [hours, minutes] = String(time).split(':');
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return String(time);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${(minutes || '00').slice(0, 2)} ${ampm}`;
}

function scheduleStartTime(s: ScheduleRow): string {
  const periodObj =
    typeof s.period === 'object' && s.period !== null ? s.period : null;
  return periodObj?.start_time || s.start_time || '';
}

function scheduleEndTime(s: ScheduleRow): string {
  const periodObj =
    typeof s.period === 'object' && s.period !== null ? s.period : null;
  return periodObj?.end_time || s.end_time || '';
}

function schedulePeriodNumber(s: ScheduleRow): number {
  const periodObj =
    typeof s.period === 'object' && s.period !== null ? s.period : null;
  const n = periodObj && 'period_number' in periodObj
    ? Number((periodObj as { period_number?: number }).period_number)
    : NaN;
  return Number.isFinite(n) ? n : 0;
}

function schedulePeriodKey(s: ScheduleRow, mergeAcrossSchools = false): string {
  // Combined "All Schools" view: align rows by clock time so the same slot
  // from different schools shares one timetable row (period UUIDs differ per school).
  if (mergeAcrossSchools) {
    const start = scheduleStartTime(s);
    const end = scheduleEndTime(s);
    if (start || end) return `${start}|${end}`;
    const num = schedulePeriodNumber(s);
    if (num) return `p${num}`;
  }
  const periodObj =
    typeof s.period === 'object' && s.period !== null ? s.period : null;
  const id =
    (periodObj && 'id' in periodObj
      ? String((periodObj as { id?: string }).id || '')
      : '') ||
    String((s as { period_id?: string }).period_id || '');
  if (id) return id;
  return `${scheduleStartTime(s)}|${scheduleEndTime(s)}`;
}

function subjectAccent(subject?: string | null): { border: string; bg: string; text: string } {
  const colors = [
    { border: 'border-l-blue-500', bg: 'bg-blue-50', text: 'text-blue-800' },
    { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-800' },
    { border: 'border-l-amber-500', bg: 'bg-amber-50', text: 'text-amber-900' },
    { border: 'border-l-violet-500', bg: 'bg-violet-50', text: 'text-violet-800' },
    { border: 'border-l-rose-500', bg: 'bg-rose-50', text: 'text-rose-800' },
    { border: 'border-l-cyan-500', bg: 'bg-cyan-50', text: 'text-cyan-800' },
  ];
  const s = (subject || '').trim();
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function ClassesPage() {
  const { selectedSchool, schools } = useTeacherSchool();
  const queryClient = useQueryClient();
  // Always fetched across every assigned school (not just the top-bar
  // selected one) — the in-page "School" filter below narrows the view
  // client-side. Previously this fetched only selectedSchool.id, so picking
  // a different school in the in-page filter silently returned nothing
  // (the data for that school was never fetched).
  const { data: classes, isLoading: classesLoading, error: classesError, refetch: refetchClasses } = useTeacherClasses();
  const { data: schedules, isLoading: schedulesLoading, error: schedulesError, refetch: refetchSchedules } = useTeacherSchedules();

  // In-page school filter — follows Active School when the top bar changes.
  // Independent picks (including "All Schools") are kept until Active School changes.
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const schoolFilterTouchedRef = useRef(false);
  const prevActiveSchoolIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const nextId = selectedSchool?.id ?? null;
    const prevId = prevActiveSchoolIdRef.current;
    prevActiveSchoolIdRef.current = nextId;
    // Initial hydrate or Active School changed → mirror into the page filter.
    if (prevId === undefined || prevId !== nextId) {
      schoolFilterTouchedRef.current = false;
      setSelectedSchoolFilter(nextId ?? 'all');
    }
  }, [selectedSchool?.id]);

  // Refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate and refetch both queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher', 'schedules', undefined] }),
        queryClient.invalidateQueries({ queryKey: ['teacher', 'classes', undefined] }),
        refetchSchedules(),
        refetchClasses()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Use smart refresh hook instead of manual event listeners
  useSmartRefresh({
    queryKeys: [
      ['teacher', 'schedules', undefined],
      ['teacher', 'classes', undefined]
    ],
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });

  // Debug logging
  useEffect(() => {
    frontendLogger.debug('Classes Page Debug', {
      component: 'ClassesPage',
      selectedSchool: selectedSchool?.id,
      classesCount: classes?.length || 0,
      schedulesCount: schedules?.length || 0,
      classesLoading,
      schedulesLoading,
      hasClassesError: !!classesError,
      hasSchedulesError: !!schedulesError,
    });
    if (classes && classes.length > 0) {
      frontendLogger.debug('Classes data loaded', {
        component: 'ClassesPage',
        count: classes.length,
      });
    }
    if (schedules && schedules.length > 0) {
      const schedulesByDay = {
         
        Sunday: schedules.filter((s: ScheduleRow) => s.day_of_week === 'Sunday').length,
        Monday: schedules.filter((s: ScheduleRow) => s.day_of_week === 'Monday').length,
        Tuesday: schedules.filter((s: ScheduleRow) => s.day_of_week === 'Tuesday').length,
        Wednesday: schedules.filter((s: ScheduleRow) => s.day_of_week === 'Wednesday').length,
        Thursday: schedules.filter((s: ScheduleRow) => s.day_of_week === 'Thursday').length,
        Friday: schedules.filter((s: ScheduleRow) => s.day_of_week === 'Friday').length,
        Saturday: schedules.filter((s: ScheduleRow) => s.day_of_week === 'Saturday').length,
      };
      frontendLogger.debug('Schedules data loaded', {
        component: 'ClassesPage',
        totalSchedules: schedules.length,
        schedulesByDay,
      });
    }
  }, [selectedSchool, classes, schedules, classesLoading, schedulesLoading, classesError, schedulesError]);

  // Extract unique grades from schedules and classes
  const availableGrades = useMemo(() => {
    const gradeSet = new Set<string>();
    if (schedules) {
       
      schedules.forEach((s: ScheduleRow) => {
        if (s.grade) gradeSet.add(s.grade);
      });
    }
    if (classes) {
      classes.forEach((c: ClassRow) => {
        if (c.grade) gradeSet.add(c.grade);
      });
    }
    return Array.from(gradeSet).sort();
  }, [schedules, classes]);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    const matchGrade = (g?: string) => selectedGrade === 'all' || g === selectedGrade;
    schedules?.forEach((s: ScheduleRow) => {
      if (matchGrade(s.grade) && s.section) set.add(s.section);
    });
    classes?.forEach((c: ClassRow) => {
      if (matchGrade(c.grade) && c.section) set.add(c.section);
    });
    return [...set].sort();
  }, [schedules, classes, selectedGrade]);

  // Filter schedules based on selected filters
  const filteredSchedules = useMemo(() => {
    if (!schedules) return [];

    let filtered = [...schedules];

    if (selectedDay !== 'all') {
      filtered = filtered.filter((s: ScheduleRow) => s.day_of_week === selectedDay);
    }

    if (selectedGrade !== 'all') {
      filtered = filtered.filter((s: ScheduleRow) => s.grade === selectedGrade);
    }

    if (selectedSection !== 'all') {
      filtered = filtered.filter((s: ScheduleRow) => (s.section ?? '') === selectedSection);
    }

    if (selectedSchoolFilter !== 'all') {
      filtered = filtered.filter(
        (s: ScheduleRow) => String(s.school_id ?? '') === String(selectedSchoolFilter),
      );
    }

    return filtered.sort((a, b) => {
      const dayA = DAYS_OF_WEEK.indexOf(a.day_of_week ?? '');
      const dayB = DAYS_OF_WEEK.indexOf(b.day_of_week ?? '');
      const dayDiff = (dayA < 0 ? 99 : dayA) - (dayB < 0 ? 99 : dayB);
      if (dayDiff !== 0) return dayDiff;
      return String(scheduleStartTime(a)).localeCompare(String(scheduleStartTime(b)));
    });
  }, [schedules, selectedDay, selectedGrade, selectedSection, selectedSchoolFilter]);

  const mergePeriodsAcrossSchools = selectedSchoolFilter === 'all' && schools.length > 1;

  /** Periods for the timetable axis — from grade/section/school filters, all days. */
  const timetablePeriods = useMemo(() => {
    if (!schedules?.length) return [] as Array<{
      key: string;
      period_number: number;
      start_time: string;
      end_time: string;
    }>;

    let base = [...schedules];
    if (selectedGrade !== 'all') {
      base = base.filter((s) => s.grade === selectedGrade);
    }
    if (selectedSection !== 'all') {
      base = base.filter((s) => (s.section ?? '') === selectedSection);
    }
    if (selectedSchoolFilter !== 'all') {
      base = base.filter(
        (s) => String(s.school_id ?? '') === String(selectedSchoolFilter),
      );
    }

    const byKey = new Map<string, {
      key: string;
      period_number: number;
      start_time: string;
      end_time: string;
    }>();
    for (const s of base) {
      const key = schedulePeriodKey(s, mergePeriodsAcrossSchools);
      if (!key || key === '|') continue;
      const existing = byKey.get(key);
      if (existing) {
        // Prefer a concrete period_number when merging across schools
        if (!existing.period_number && schedulePeriodNumber(s)) {
          existing.period_number = schedulePeriodNumber(s);
        }
        continue;
      }
      byKey.set(key, {
        key,
        period_number: schedulePeriodNumber(s),
        start_time: scheduleStartTime(s),
        end_time: scheduleEndTime(s),
      });
    }
    return [...byKey.values()].sort((a, b) => {
      const t = String(a.start_time).localeCompare(String(b.start_time));
      if (t !== 0) return t;
      return a.period_number - b.period_number;
    });
  }, [schedules, selectedGrade, selectedSection, selectedSchoolFilter, mergePeriodsAcrossSchools]);

  const timetableDays = useMemo(() => {
    if (selectedDay !== 'all') return [selectedDay];
    return GRID_DAYS;
  }, [selectedDay]);

  const showSchoolOnCards = useMemo(() => {
    if (selectedSchoolFilter !== 'all') return false;
    const ids = new Set(
      filteredSchedules.map((s) => String(s.school_id ?? '')).filter(Boolean),
    );
    return ids.size > 1 || schools.length > 1;
  }, [filteredSchedules, selectedSchoolFilter, schools.length]);

  const schedulesForCell = (day: string, periodKey: string) =>
    filteredSchedules.filter(
      (s) =>
        s.day_of_week === day &&
        schedulePeriodKey(s, mergePeriodsAcrossSchools) === periodKey,
    );

  // Filter classes based on selected filters
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    let filtered = [...classes];

    if (selectedGrade !== 'all') {
      filtered = filtered.filter((c: ClassRow) => c.grade === selectedGrade);
    }

    if (selectedSection !== 'all') {
      filtered = filtered.filter((c: ClassRow) => (c.section ?? '') === selectedSection);
    }

    if (selectedSchoolFilter !== 'all') {
      filtered = filtered.filter(
        (c: ClassRow) => String(c.school_id ?? '') === String(selectedSchoolFilter),
      );
    }

    return filtered;
  }, [classes, selectedGrade, selectedSection, selectedSchoolFilter]);

  // Check if any filters are active
  const hasActiveFilters = selectedDay !== 'all' || selectedGrade !== 'all' || selectedSection !== 'all' || selectedSchoolFilter !== 'all';

  // Clear all filters
  const clearFilters = () => {
    setSelectedDay('all');
    setSelectedGrade('all');
    setSelectedSection('all');
    schoolFilterTouchedRef.current = true;
    setSelectedSchoolFilter('all');
  };

  if (schools.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center py-8">
              <p className="text-lg font-medium">No school assigned</p>
              <p className="text-sm text-gray-600 mt-2">
                You aren&apos;t assigned to any school yet. Please contact your admin.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filterSchoolName =
    selectedSchoolFilter === 'all'
      ? 'all your schools'
      : schools.find((s) => s.id === selectedSchoolFilter)?.name ?? 'your school';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
          <p className="text-gray-600 mt-2">
            All classes assigned to you at {filterSchoolName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Link href="/lms/teacher/reports">
            <Button className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Submit Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {(classesError || schedulesError) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-8">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
              <p className="text-lg font-medium text-red-600">Error loading classes</p>
              <p className="text-sm text-gray-600 mt-2">
                {classesError && (classesError instanceof Error ? classesError.message : 'Failed to load classes.')}
                {schedulesError && (schedulesError instanceof Error ? schedulesError.message : 'Failed to load schedules.')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <CardTitle className="text-lg">Filters</CardTitle>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* School Filter */}
            <div className="space-y-2">
              <Label htmlFor="school-filter">School</Label>
              <Select
                value={selectedSchoolFilter}
                onValueChange={(value) => {
                  schoolFilterTouchedRef.current = true;
                  setSelectedSchoolFilter(value);
                }}
              >
                <SelectTrigger id="school-filter">
                  <SelectValue placeholder="All Schools" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id ?? ''}>
                      {school.name} {school.school_code ? `(${school.school_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day Filter */}
            <div className="space-y-2">
              <Label htmlFor="day-filter">Day</Label>
              <Select
                value={selectedDay}
                onValueChange={setSelectedDay}
              >
                <SelectTrigger id="day-filter">
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grade Filter */}
            <div className="space-y-2">
              <Label htmlFor="grade-filter">Grade</Label>
              <Select
                value={selectedGrade}
                onValueChange={(value) => {
                  setSelectedGrade(value);
                  setSelectedSection('all');
                }}
              >
                <SelectTrigger id="grade-filter">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {availableGrades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Filter */}
            <div className="space-y-2">
              <Label htmlFor="section-filter">Section</Label>
              <Select
                value={selectedSection}
                onValueChange={setSelectedSection}
                disabled={availableSections.length === 0}
              >
                <SelectTrigger id="section-filter">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {availableSections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Schedule — weekly timetable grid */}
      {schedulesLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Class Schedule</CardTitle>
            <CardDescription>Your weekly class schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading schedule...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredSchedules && filteredSchedules.length > 0 && timetablePeriods.length > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Class Schedule</CardTitle>
                <CardDescription>
                  {hasActiveFilters
                    ? `Timetable · ${filteredSchedules.length} of ${schedules?.length || 0} classes`
                    : `Weekly timetable at ${filterSchoolName}`}
                </CardDescription>
              </div>
              <p className="text-xs text-gray-400 tabular-nums">
                {timetablePeriods.length} period{timetablePeriods.length === 1 ? '' : 's'}
                {' · '}
                {timetableDays.length === 1 ? timetableDays[0] : 'Mon–Sat'}
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50/90">
                    <th className="sticky left-0 z-20 bg-gray-50/90 border-b border-r border-gray-100 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-28 min-w-[7rem]">
                      Period
                    </th>
                    {timetableDays.map((day) => (
                      <th
                        key={day}
                        className="border-b border-r border-gray-100 last:border-r-0 px-2 py-3 text-center min-w-[140px]"
                      >
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-600">
                          {day.slice(0, 3)}
                        </div>
                        <div className="text-[10px] font-medium text-gray-400 mt-0.5">{day}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timetablePeriods.map((period, pIdx) => (
                    <tr key={period.key} className="group">
                      <td
                        className={`sticky left-0 z-10 border-r border-gray-100 bg-white px-3 py-2 align-top shadow-[1px_0_0_0_#f3f4f6] ${
                          pIdx < timetablePeriods.length - 1 ? 'border-b border-gray-50' : ''
                        }`}
                      >
                        <div className="text-xs font-bold text-gray-700 tabular-nums">
                          {period.period_number
                            ? `P${period.period_number}`
                            : 'Period'}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                          {formatTime(period.start_time)}
                          {period.end_time ? ` – ${formatTime(period.end_time)}` : ''}
                        </div>
                      </td>
                      {timetableDays.map((day) => {
                        const cellItems = schedulesForCell(day, period.key);
                        return (
                          <td
                            key={`${day}-${period.key}`}
                            className={`border-r border-gray-50 last:border-r-0 px-1.5 py-1.5 align-top min-h-[4.5rem] ${
                              pIdx < timetablePeriods.length - 1 ? 'border-b border-gray-50' : ''
                            } ${cellItems.length === 0 ? 'bg-gray-50/40' : 'bg-white'}`}
                          >
                            {cellItems.length === 0 ? (
                              <div className="min-h-[3.25rem] rounded-md border border-dashed border-gray-100" />
                            ) : (
                              <div className="flex flex-col gap-1">
                                {cellItems.map((s) => {
                                  const accent = subjectAccent(s.subject);
                                  const roomObj =
                                    typeof s.room === 'object' && s.room !== null
                                      ? s.room
                                      : null;
                                  const roomLabel = roomObj
                                    ? roomObj.room_number || roomObj.room_name
                                    : typeof s.room === 'string'
                                      ? s.room
                                      : null;
                                  const schoolName = s.school?.name;
                                  return (
                                    <div
                                      key={s.id}
                                      className={`rounded-md border border-gray-100 border-l-[3px] px-2 py-1.5 shadow-sm ${accent.border} ${accent.bg}`}
                                    >
                                      <p className={`text-xs font-bold truncate leading-tight ${accent.text}`}>
                                        {s.subject || 'Class'}
                                      </p>
                                      <p className="text-[10px] text-gray-600 font-medium truncate mt-0.5">
                                        {formatGradeSection(s.grade, s.section) || '—'}
                                      </p>
                                      {(roomLabel || (showSchoolOnCards && schoolName)) && (
                                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                          {[roomLabel, showSchoolOnCards ? schoolName : null]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : schedules && schedules.length > 0 && filteredSchedules.length === 0 && hasActiveFilters ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center py-6">
              <Filter className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-900">No schedules match the selected filters</p>
              <p className="text-xs text-gray-600 mt-1">
                Try adjusting your filters or{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto text-blue-600 text-xs"
                  onClick={clearFilters}
                >
                  clear all filters
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Classes Grid */}
      {classesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredClasses && filteredClasses.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Classes</CardTitle>
                <CardDescription>
                  {hasActiveFilters 
                    ? `Showing ${filteredClasses.length} of ${classes?.length || 0} classes`
                    : `All classes assigned to you`
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredClasses.map((classItem: ClassRow) => (
                <Link
                  key={classItem.id}
                  href={`/lms/teacher/reports${classItem.grade ? `?grade=${encodeURIComponent(classItem.grade)}${classItem.section ? `&section=${encodeURIComponent(classItem.section)}` : ''}` : ''}`}
                  title="Submit a report for this class"
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:shadow-sm hover:border-blue-300 transition-shadow"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {formatGradeSection(classItem.grade, classItem.section) || classItem.class_name || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {classItem.school_name || 'Unknown school'}
                    </p>
                  </div>
                  <Badge
                    variant={classItem.is_active ? 'default' : 'secondary'}
                    className="shrink-0"
                  >
                    {classItem.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (!schedules || schedules.length === 0) && (!classes || classes.length === 0) ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center py-8">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-900">No classes assigned</p>
              <p className="text-sm text-gray-600 mt-2">
                You don&apos;t have any classes assigned yet. Please contact your School Admin.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : hasActiveFilters && filteredSchedules.length === 0 && filteredClasses.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center py-8">
              <Filter className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-900">No results found</p>
              <p className="text-sm text-gray-600 mt-2">
                No classes or schedules match the selected filters. Try adjusting your filters or{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto text-blue-600"
                  onClick={clearFilters}
                >
                  clear all filters
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

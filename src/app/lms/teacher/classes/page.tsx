"use client";

import { useTeacherSchool } from "../context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useTeacherClasses,
  useTeacherSchedules,
  type TeacherClassRow,
  type TeacherScheduleRow,
} from "@/hooks/useTeacherData";
import { BookOpen, FileText, AlertCircle, Filter, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type ScheduleRow = TeacherScheduleRow;
type ClassRow = TeacherClassRow;

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

  // Filter state — defaults to whichever school is active in the top bar,
  // but can be changed independently since all schools' data is loaded.
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>(selectedSchool?.id ?? 'all');
  const [isRefreshing, setIsRefreshing] = useState(false);

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

    if (selectedSchoolFilter !== 'all') {
      filtered = filtered.filter((s: ScheduleRow) => s.school_id === selectedSchoolFilter);
    }

    return filtered;
  }, [schedules, selectedDay, selectedGrade, selectedSchoolFilter]);

  // Filter classes based on selected filters
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    let filtered = [...classes];

    if (selectedGrade !== 'all') {
      filtered = filtered.filter((c: ClassRow) => c.grade === selectedGrade);
    }

    if (selectedSchoolFilter !== 'all') {
      filtered = filtered.filter((c: ClassRow) => c.school_id === selectedSchoolFilter);
    }

    return filtered;
  }, [classes, selectedGrade, selectedSchoolFilter]);

  // Check if any filters are active
  const hasActiveFilters = selectedDay !== 'all' || selectedGrade !== 'all' || selectedSchoolFilter !== 'all';

  // Clear all filters
  const clearFilters = () => {
    setSelectedDay('all');
    setSelectedGrade('all');
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* School Filter */}
            <div className="space-y-2">
              <Label htmlFor="school-filter">School</Label>
              <Select
                value={selectedSchoolFilter}
                onValueChange={setSelectedSchoolFilter}
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
                onValueChange={setSelectedGrade}
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
          </div>
        </CardContent>
      </Card>

      {/* Class Schedule Table */}
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
      ) : filteredSchedules && filteredSchedules.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Class Schedule</CardTitle>
                <CardDescription>
                  {hasActiveFilters 
                    ? `Showing ${filteredSchedules.length} of ${schedules?.length || 0} schedules`
                    : `Your weekly class schedule at ${filterSchoolName}`
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Room</TableHead>
                    {schools.length > 1 && <TableHead>School</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.map((schedule: ScheduleRow) => {
                    const formatTime = (time?: string) => {
                      if (!time) return '';
                      const [hours, minutes] = time.split(':');
                      const hour = parseInt(hours);
                      const ampm = hour >= 12 ? 'PM' : 'AM';
                      const displayHour = hour % 12 || 12;
                      return `${displayHour}:${minutes} ${ampm}`;
                    };
                    const periodObj =
                      typeof schedule.period === 'object' && schedule.period !== null
                        ? schedule.period
                        : null;
                    const roomObj =
                      typeof schedule.room === 'object' && schedule.room !== null
                        ? schedule.room
                        : null;

                    return (
                      <TableRow key={schedule.id}>
                        <TableCell>
                          <Badge variant="outline">{schedule.day_of_week}</Badge>
                        </TableCell>
                        <TableCell>
                          {periodObj ? (
                            <span className="text-sm">
                              {formatTime(periodObj.start_time)} - {formatTime(periodObj.end_time)}
                            </span>
                          ) : schedule.start_time && schedule.end_time ? (
                            <span className="text-sm">
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{schedule.subject}</TableCell>
                        <TableCell>{schedule.grade}</TableCell>
                        <TableCell>
                          {roomObj ? (
                            <span>{roomObj.room_number} {roomObj.room_name && `- ${roomObj.room_name}`}</span>
                          ) : typeof schedule.room === 'string' ? (
                            <span>{schedule.room}</span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        {schools.length > 1 && (
                          <TableCell>
                            {schedule.school ? (
                              <span className="text-sm">{schedule.school.name}</span>
                            ) : (
                              <span className="text-sm text-gray-400">N/A</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
                  href={`/lms/teacher/reports${classItem.grade ? `?grade=${encodeURIComponent(classItem.grade)}` : ''}`}
                  title="Submit a report for this class"
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:shadow-sm hover:border-blue-300 transition-shadow"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {classItem.grade || classItem.class_name || 'N/A'}
                      {classItem.section ? ` - ${classItem.section}` : ''}
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

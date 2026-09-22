"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  BookOpen,
  Users,
  CheckSquare,
  Square,
  BarChart2,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatGradeSection } from "@/hooks/useTeacherData";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";

interface TeacherReport {
  id: string;
  teacher_id: string;
  school_id: string;
  date: string;
  grade: string;
  section?: string | null;
  topics_taught: string;
  activities?: string;
  student_count: number;
  duration_hours: number;
  notes: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  teacher: {
    full_name: string;
    email: string;
  };
  // 'Reviewed' is set by a platform admin (via /admin/teacher-reports) as an
  // in-between "looked at, not yet decided" state — still actionable here,
  // same as 'Pending'.
  status: "Pending" | "Reviewed" | "Approved" | "Rejected";
  class_name?: string;
}

type ReviewView = "inbox" | "history" | "all";

function isActionable(status: TeacherReport["status"]) {
  return status === "Pending" || status === "Reviewed";
}

function dateKey(iso: string): string {
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === yesterday.getTime()) return "Yesterday";
  return target.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shiftDateKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function ReportsManagement() {
  const [reports, setReports] = useState<TeacherReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewView, setReviewView] = useState<ReviewView>("inbox");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isBulkApproveOpen, setIsBulkApproveOpen] = useState(false);
  const [isBulkRejectOpen, setIsBulkRejectOpen] = useState(false);
  const [_schoolId, setSchoolId] = useState<string>("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [reportStats, setReportStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);

      try {
        const schoolRes = await schoolAdminApi.school.get();
        const schoolData = schoolRes.data ?? {};
        const school = (schoolData as { school?: { id?: string } }).school;
        if (school?.id) setSchoolId(school.id);
      } catch (err) {
        console.warn("Could not fetch school info:", err);
      }

      const [reportsRes, schedulesRes, periodsRes, teachersRes] = await Promise.all([
        schoolAdminApi.reports.list({ limit: 500 }),
        schoolAdminApi.schedules.list(),
        schoolAdminApi.periods.list(),
        schoolAdminApi.teachers.list({ limit: 500 }),
      ]);

      const reportsData = reportsRes.data ?? {};
      const reportsArray =
        (reportsData as { reports?: unknown[] }).reports ??
        (Array.isArray(reportsData) ? reportsData : []);
      setReports(reportsArray as TeacherReport[]);
      const stats = (
        reportsData as {
          stats?: { total: number; pending: number; approved: number; rejected: number };
        }
      ).stats;
      setReportStats(stats ?? { total: 0, pending: 0, approved: 0, rejected: 0 });

      const schedulesData = schedulesRes.data ?? {};
      setSchedules(
        (schedulesData as { schedules?: any[] }).schedules ??
          (Array.isArray(schedulesData) ? schedulesData : []),
      );

      const periodsData = periodsRes.data ?? {};
      setPeriods(
        (periodsData as { periods?: any[] }).periods ??
          (Array.isArray(periodsData) ? periodsData : []),
      );

      const teachersData = teachersRes.data ?? {};
      const rawTeachers =
        (teachersData as { teachers?: any[] }).teachers ??
        (Array.isArray(teachersData) ? teachersData : []);

      const transformedTeachers = rawTeachers
        .map((t: any) => {
          const profile = t.profile || {};
          const teacher = t.teacher || {};
          return {
            id: profile.id || t.teacher_id || (teacher as any).profile_id || t.id,
            full_name:
              t.full_name ||
              profile.full_name ||
              profile.fullName ||
              teacher.full_name ||
              "Unknown",
            email: t.email || profile.email || teacher.email || "",
          };
        })
        .filter((t: any) => t.id);

      setTeachers(transformedTeachers);
    } catch (error) {
      console.error("Error loading analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleApproveReport = async (reportId: string) => {
    try {
      setActionBusyId(reportId);
      await schoolAdminApi.reports.update(reportId, { action: "approve" });
      setSelectedReports((prev) => prev.filter((id) => id !== reportId));
      await loadReports();
      toast.success("Report approved");
    } catch (error) {
      console.error("Error approving report:", error);
      toast.error(
        `Failed to approve report: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRejectReport = async (reportId: string) => {
    try {
      setActionBusyId(reportId);
      await schoolAdminApi.reports.update(reportId, { action: "reject" });
      setSelectedReports((prev) => prev.filter((id) => id !== reportId));
      await loadReports();
      toast.success("Report rejected");
    } catch (error) {
      console.error("Error rejecting report:", error);
      toast.error(
        `Failed to reject report: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setActionBusyId(null);
    }
  };

  const handleBulkApprove = async () => {
    try {
      const response = await schoolAdminApi.reports.bulk({
        report_ids: selectedReports,
        action: "approve",
      });
      const data = (response.data ?? {}) as { approved?: number };
      toast.success(
        `Successfully approved ${data.approved ?? selectedReports.length} report(s)`,
      );
      setSelectedReports([]);
      setIsBulkApproveOpen(false);
      await loadReports();
    } catch (error) {
      console.error("Error bulk approving reports:", error);
      toast.error(
        `Failed to approve reports: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    }
  };

  const handleBulkReject = async () => {
    try {
      const response = await schoolAdminApi.reports.bulk({
        report_ids: selectedReports,
        action: "reject",
      });
      const data = (response.data ?? {}) as { approved?: number };
      toast.success(
        `Successfully rejected ${data.approved ?? selectedReports.length} report(s)`,
      );
      setSelectedReports([]);
      setIsBulkRejectOpen(false);
      await loadReports();
    } catch (error) {
      console.error("Error bulk rejecting reports:", error);
      toast.error(
        `Failed to reject reports: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((report: TeacherReport) => {
      const matchesSearch =
        report.teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.topics_taught.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.grade || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.section || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesView =
        reviewView === "all"
          ? true
          : reviewView === "inbox"
            ? isActionable(report.status)
            : report.status === "Approved" || report.status === "Rejected";

      const matchesTeacher = teacherFilter === "all" || report.teacher_id === teacherFilter;
      const classLabel = formatGradeSection(report.grade, report.section);
      const matchesGrade =
        gradeFilter === "all" || classLabel === gradeFilter || report.grade === gradeFilter;
      const matchesFocus = !focusDate || dateKey(report.date) === focusDate;

      return matchesSearch && matchesView && matchesTeacher && matchesGrade && matchesFocus;
    });
  }, [reports, searchTerm, reviewView, teacherFilter, gradeFilter, focusDate]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, TeacherReport[]>();
    for (const report of filteredReports) {
      const key = dateKey(report.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(report);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const name = a.teacher.full_name.localeCompare(b.teacher.full_name);
        if (name !== 0) return name;
        return (a.grade || "").localeCompare(b.grade || "");
      });
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filteredReports]);

  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      toast.warning("No reports to export");
      return;
    }
    const headers = [
      "Teacher Name",
      "Teacher Email",
      "Date",
      "Class",
      "Topics Taught",
      "Activities",
      "Students",
      "Duration (Hours)",
      "Status",
      "Notes",
    ];
    const rows = filteredReports.map((report: TeacherReport) => [
      report.teacher.full_name || "Unknown",
      report.teacher.email || "",
      dateKey(report.date),
      formatGradeSection(report.grade, report.section) || "N/A",
      report.topics_taught || "",
      report.activities || "",
      report.student_count || 0,
      report.duration_hours || 0,
      report.status,
      report.notes || "",
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    let filename = "teacher_reports";
    if (focusDate) filename += `_${focusDate}`;
    if (gradeFilter !== "all") filename += `_${gradeFilter}`;
    filename += ".csv";
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const actionableInView = filteredReports.filter((r) => isActionable(r.status));

  const handleSelectReport = (reportId: string) => {
    setSelectedReports((prev) =>
      prev.includes(reportId) ? prev.filter((id: string) => id !== reportId) : [...prev, reportId],
    );
  };

  const handleSelectAllVisible = () => {
    if (
      selectedReports.length === actionableInView.length &&
      actionableInView.every((r) => selectedReports.includes(r.id))
    ) {
      setSelectedReports([]);
    } else {
      setSelectedReports(actionableInView.map((r) => r.id));
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getTeachers = () => {
    const ids = [...new Set(reports.map((r: TeacherReport) => r.teacher_id))];
    return ids.map((teacherId: string) => {
      const report = reports.find((r: TeacherReport) => r.teacher_id === teacherId);
      return {
        id: teacherId,
        name: report?.teacher.full_name || "Unknown",
      };
    });
  };

  const getGrades = () => {
    return [
      ...new Set(
        reports.map((r: TeacherReport) => formatGradeSection(r.grade, r.section)).filter(Boolean),
      ),
    ].sort();
  };

  const calculateDuration = (p: any) => {
    if (!p) return 0;
    const s = new Date(`2000-01-01T${p.start_time}`);
    const e = new Date(`2000-01-01T${p.end_time}`);
    return (e.getTime() - s.getTime()) / (1000 * 60 * 60);
  };

  const getTeacherWorkload = (teacherId: string) => {
    const teacherSchedules = schedules.filter((s) => s.teacher_id === teacherId && s.is_active);
    const totalHours = teacherSchedules.reduce((acc, s) => {
      const p = periods.find((per) => per.id === s.period_id);
      return acc + calculateDuration(p);
    }, 0);

    return {
      hours: totalHours,
      periods: teacherSchedules.length,
      status: totalHours > 30 ? "Overloaded" : totalHours > 24 ? "High" : "Normal",
      statusColor:
        totalHours > 30
          ? "bg-red-100 text-red-700"
          : totalHours > 24
            ? "bg-orange-100 text-orange-700"
            : "bg-green-100 text-green-700",
    };
  };

  const stats = reportStats;
  const inboxCount = reports.filter((r) => isActionable(r.status)).length;

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 pb-28">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Teacher Reports</h1>
        <p className="mt-1 text-gray-600">
          Review daily teaching reports and approve what looks right
        </p>
      </div>

      <Tabs defaultValue="reports" className="space-y-6">
        <TabsList>
          <TabsTrigger value="reports">
            <FileText className="mr-2 h-4 w-4" />
            Daily Reports
            {inboxCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {inboxCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart2 className="mr-2 h-4 w-4" />
            Workload Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              {(
                [
                  { id: "inbox" as const, label: "Needs review", count: inboxCount },
                  {
                    id: "history" as const,
                    label: "History",
                    count: stats.approved + stats.rejected,
                  },
                  { id: "all" as const, label: "All", count: stats.total },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setReviewView(tab.id);
                    setSelectedReports([]);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    reviewView === tab.id
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 tabular-nums ${
                      reviewView === tab.id ? "text-gray-300" : "text-gray-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setFocusDate((prev) => shiftDateKey(prev || todayKey(), -1))}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={focusDate || ""}
                onChange={(e) => setFocusDate(e.target.value || null)}
                className="h-9 w-[160px]"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setFocusDate((prev) => shiftDateKey(prev || todayKey(), 1))}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {focusDate ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-gray-600"
                  onClick={() => setFocusDate(null)}
                >
                  Clear day
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-gray-600"
                  onClick={() => setFocusDate(todayKey())}
                >
                  Today
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search teacher, topic, or class…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teachers</SelectItem>
                  {getTeachers().map((teacher: { id: string; name: string }) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {getGrades().map((grade: string) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9" onClick={handleExportCSV}>
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {groupedByDate.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center text-gray-500">
              {reviewView === "inbox" ? (
                <>
                  <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-500" />
                  <p className="text-lg font-medium text-gray-800">All caught up</p>
                  <p className="mt-1 text-sm">
                    {focusDate
                      ? `No reports need review for ${formatDayLabel(focusDate)}.`
                      : "No pending teaching reports right now."}
                  </p>
                  {(stats.approved > 0 || stats.rejected > 0) && (
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setReviewView("history")}
                    >
                      View history
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-lg font-medium text-gray-800">No reports found</p>
                  <p className="mt-1 text-sm">Try another day or clear filters</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedByDate.map(([day, dayReports]) => {
                const pendingInDay = dayReports.filter((r) => isActionable(r.status)).length;
                return (
                  <section key={day} className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-2">
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">
                          {formatDayLabel(day)}
                        </h2>
                        <p className="text-xs text-gray-500">
                          {dayReports.length} report{dayReports.length === 1 ? "" : "s"}
                          {pendingInDay > 0 ? ` · ${pendingInDay} awaiting approval` : ""}
                        </p>
                      </div>
                      {pendingInDay > 0 && reviewView !== "history" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-gray-600"
                          onClick={() => {
                            const ids = dayReports
                              .filter((r) => isActionable(r.status))
                              .map((r) => r.id);
                            const allSelected = ids.every((id) => selectedReports.includes(id));
                            setSelectedReports((prev) =>
                              allSelected
                                ? prev.filter((id) => !ids.includes(id))
                                : [...new Set([...prev, ...ids])],
                            );
                          }}
                        >
                          Select day
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {dayReports.map((report) => {
                        const expanded = expandedIds.has(report.id);
                        const actionable = isActionable(report.status);
                        const selected = selectedReports.includes(report.id);
                        const busy = actionBusyId === report.id;
                        const classLabel =
                          formatGradeSection(report.grade, report.section) || "N/A";

                        return (
                          <div
                            key={report.id}
                            className={`rounded-lg border bg-white transition-colors ${
                              selected
                                ? "border-blue-300 bg-blue-50/40"
                                : actionable
                                  ? "border-amber-200/80"
                                  : "border-gray-200"
                            }`}
                          >
                            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 flex-1 gap-3">
                                {actionable ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectReport(report.id)}
                                    className="mt-0.5 shrink-0 text-gray-500 hover:text-gray-800"
                                    aria-label={selected ? "Deselect report" : "Select report"}
                                  >
                                    {selected ? (
                                      <CheckSquare className="h-5 w-5 text-blue-600" />
                                    ) : (
                                      <Square className="h-5 w-5" />
                                    )}
                                  </button>
                                ) : (
                                  <div className="mt-0.5 w-5 shrink-0" />
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-medium text-gray-900">
                                      {report.teacher.full_name}
                                    </span>
                                    <span className="text-gray-300">·</span>
                                    <span className="text-sm text-gray-600">{classLabel}</span>
                                    {!actionable && (
                                      <Badge
                                        variant={
                                          report.status === "Rejected" ? "destructive" : "secondary"
                                        }
                                        className={
                                          report.status === "Approved"
                                            ? "bg-green-50 text-green-800 hover:bg-green-50"
                                            : undefined
                                        }
                                      >
                                        {report.status}
                                      </Badge>
                                    )}
                                    {report.status === "Reviewed" && (
                                      <Badge variant="outline" className="text-amber-700">
                                        Reviewed
                                      </Badge>
                                    )}
                                  </div>

                                  <p
                                    className={`mt-1 text-sm text-gray-800 ${
                                      expanded ? "" : "line-clamp-2"
                                    }`}
                                  >
                                    {report.topics_taught || "No topics listed"}
                                  </p>

                                  {(report.activities || report.notes) && expanded && (
                                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                                      {report.activities && (
                                        <p>
                                          <span className="font-medium text-gray-700">
                                            Activities:{" "}
                                          </span>
                                          {report.activities}
                                        </p>
                                      )}
                                      {report.notes && (
                                        <p>
                                          <span className="font-medium text-gray-700">Notes: </span>
                                          {report.notes}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                    <span className="inline-flex items-center gap-1">
                                      <Users className="h-3.5 w-3.5" />
                                      {report.student_count} students
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5" />
                                      {Number(report.duration_hours || 0).toFixed(2)}h
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleExpanded(report.id)}
                                      className="inline-flex items-center gap-0.5 text-gray-600 hover:text-gray-900"
                                    >
                                      {expanded ? (
                                        <>
                                          Less <ChevronUp className="h-3.5 w-3.5" />
                                        </>
                                      ) : (
                                        <>
                                          Details <ChevronDown className="h-3.5 w-3.5" />
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {actionable && (
                                <div className="flex shrink-0 items-center gap-2 sm:pl-2">
                                  <Button
                                    size="sm"
                                    disabled={busy}
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleApproveReport(report.id)}
                                  >
                                    <CheckCircle className="mr-1.5 h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    className="border-red-200 text-red-700 hover:bg-red-50"
                                    onClick={() => handleRejectReport(report.id)}
                                  >
                                    <XCircle className="mr-1.5 h-4 w-4" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {selectedReports.length > 0 && (
            <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {selectedReports.length} selected
              </button>
              <div className="h-4 w-px bg-gray-200" />
              <Dialog open={isBulkApproveOpen} onOpenChange={setIsBulkApproveOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <CheckSquare className="mr-1.5 h-4 w-4" />
                    Approve
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve selected reports</DialogTitle>
                    <DialogDescription>
                      Approve {selectedReports.length} teaching report
                      {selectedReports.length === 1 ? "" : "s"}?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBulkApproveOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleBulkApprove}>Approve all</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isBulkRejectOpen} onOpenChange={setIsBulkRejectOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Reject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject selected reports</DialogTitle>
                    <DialogDescription>
                      Reject {selectedReports.length} teaching report
                      {selectedReports.length === 1 ? "" : "s"}?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBulkRejectOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleBulkReject}>
                      Reject all
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="ghost" onClick={() => setSelectedReports([])}>
                Clear
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {schedules
                    .filter((s) => s.is_active)
                    .reduce((acc, s) => {
                      const p = periods.find((per) => per.id === s.period_id);
                      return acc + calculateDuration(p);
                    }, 0)
                    .toFixed(1)}
                  h
                </div>
                <p className="text-xs text-muted-foreground">Total weekly capacity</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Teachers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teachers.length}</div>
                <p className="text-xs text-muted-foreground">Currently assigned</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Load</CardTitle>
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(
                    schedules
                      .filter((s) => s.is_active)
                      .reduce((acc, s) => {
                        const p = periods.find((per) => per.id === s.period_id);
                        return acc + calculateDuration(p);
                      }, 0) / (teachers.length || 1)
                  ).toFixed(1)}
                  h
                </div>
                <p className="text-xs text-muted-foreground">Per teacher per week</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Teacher Workload & Capacity</CardTitle>
              <CardDescription>
                Live analytics pulled from the weekly class schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Total Periods</TableHead>
                    <TableHead>Weekly Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Schedule Coverage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => {
                    const workload = getTeacherWorkload(teacher.id);
                    const coverage = Math.min(
                      100,
                      Math.round(
                        (reports.filter(
                          (r) => r.teacher_id === teacher.id && r.status === "Approved",
                        ).length /
                          Math.max(1, workload.periods)) *
                          100,
                      ),
                    );

                    return (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium">{teacher.full_name}</TableCell>
                        <TableCell>{workload.periods} Periods</TableCell>
                        <TableCell className="font-mono">{workload.hours.toFixed(1)}h</TableCell>
                        <TableCell>
                          <Badge className={workload.statusColor}>{workload.status}</Badge>
                        </TableCell>
                        <TableCell className="w-[200px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span>Report Compliance</span>
                              <span>{coverage}%</span>
                            </div>
                            <Progress value={coverage} className="h-1.5" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {teachers.length === 0 && (
            <div className="rounded-lg border-2 border-dashed py-12 text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">
                No teacher workload data available. Ensure schedules are created.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

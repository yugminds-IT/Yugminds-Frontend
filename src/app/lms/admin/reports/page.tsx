"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { formatGradeSection } from "@/hooks/useTeacherData";
import { adminApi } from '@/lib/api/admin.api';
import { toast } from '@/components/ui/toast';
import StatusRun from "@/components/admin/reports/StatusRun";
import ReportsList, { type Filters } from "@/components/admin/reports/ReportsList";
import PerformanceTab from "@/components/admin/reports/PerformanceTab";
import TrendsTab from "@/components/admin/reports/TrendsTab";
import ReviewModal from "@/components/admin/reports/ReviewModal";
import {
  dayKey,
  plural,
  shiftDayKey,
  statusOf,
  type ReportStatus,
  type ReportTrend,
  type SubjectDistribution,
  type TeacherPerformance,
  type TeacherReport,
} from "@/components/admin/reports/types";
import "@/components/school-admin/overview.css"; // hero meta, so- grid
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/reports/reports.css";
import "@/components/school-admin/reports/reports.css"; // rp-bulk floating bar

const SUBJECT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA'];

export default function TeacherReports() {
  const [reports, setReports] = useState<TeacherReport[]>([]);
  const [performance, setPerformance] = useState<TeacherPerformance[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  { }
  { }
  { }
  const [schoolFilter, setSchoolFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [reportsFailed, setReportsFailed] = useState(false);
  // Real DB-count totals scoped to the current structural filters
  // (school/teacher/grade/date) — independent of the 500-row list cap, so
  // "Total Reports" stays accurate instead of measuring only what's loaded.
  const [reportStats, setReportStats] = useState({ total: 0, submitted: 0, reviewed: 0, approved: 0, rejected: 0 });
  { }
   
  type School = {
    id: string;
    name?: string | null;
    school_code?: string | null;
  };
  
  type Teacher = {
    id: string;
    full_name?: string | null;
    email?: string | null;
  };
  
  const { schools } = useAdminSchools();
  { }
  { }
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  { }
  const [grades, setGrades] = useState<string[]>([]);
  { }
  const [loading, setLoading] = useState(false);
  const [reviewingReport, setReviewingReport] = useState<TeacherReport | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [avgAttendanceRate, setAvgAttendanceRate] = useState<number | null>(null);

  const saveReview = async (status: ReportStatus, notes: string) => {
    if (!reviewingReport) return false;
    try {
      await adminApi.teacherReports.update({
        id: reviewingReport.id,
        status,
        admin_notes: notes || undefined,
      });
      setReports((prev) =>
        prev.map((r) => (r.id === reviewingReport.id ? { ...r, status, admin_notes: notes || r.admin_notes } : r)),
      );
      toast.success("Review saved.");
      void loadData(); // the track's counts come from the server
      return true;
    } catch (err) {
      console.error('Failed to update report status', err);
      toast.error('Could not save the review. Try again.');
      return false;
    }
  };
  const bulkReview = async (ids: string[], status: "approved" | "rejected") => {
    try {
      await adminApi.teacherReports.bulkUpdate({ ids, status });
      const set = new Set(ids);
      setReports((prev) => prev.map((r) => (set.has(r.id) ? { ...r, status } : r)));
      toast.success(`${status === "approved" ? "Approved" : "Rejected"} ${plural(ids.length, "report")}.`);
      void loadData();
      return true;
    } catch (err) {
      toast.error(`Could not update the reports: ${err instanceof Error ? err.message : "Try again."}`);
      return false;
    }
  };
  { }
  const [reportTrendsData, setReportTrendsData] = useState<ReportTrend[]>([]);
  { }
  const [subjectDistributionData, setSubjectDistributionData] = useState<SubjectDistribution[]>([]);

  // Move helper calculations above loadData to avoid temporal dead zone issues


  const calculatePerformanceMetrics = useCallback((reports: TeacherReport[]) => {
    const teacherMap = new Map();
    // The last 20 weekdays (Monday to Friday) up to today: the window the reporting rate is measured over.
    const now = new Date();
    let cursor = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const window20 = new Set<string>();
    while (window20.size < 20) {
      const [y, m, d] = cursor.split('-').map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      if (dow !== 0 && dow !== 6) window20.add(cursor);
      cursor = shiftDayKey(cursor, -1);
    }

    reports.forEach(report => {
      const teacherId = report.teacher_id;
      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          teacher_id: teacherId,
          teacher_name: report.profiles?.full_name || report.teacher_name || 'Unknown',
          school_name: report.schools?.name || report.school_name || 'Unknown',
          total_reports: 0,
          total_hours: 0,
          total_students: 0,
          report_days: new Set<string>(),
          last_report_date: report.date
        });
      }

      const teacher = teacherMap.get(teacherId);
      teacher.total_reports += 1;
      teacher.total_hours += report.duration_hours || 0;
      teacher.total_students += report.student_count || 0;
      const day = dayKey(report.date);
      if (window20.has(day)) teacher.report_days.add(day);
      if (new Date(report.date) > new Date(teacher.last_report_date)) {
        teacher.last_report_date = report.date;
      }
    });

  type TeacherPerformanceData = {
    teacher_id: string;
    teacher_name: string;
    school_name: string;
    total_reports: number;
    total_hours: number;
    total_students: number;
    report_days: Set<string>;
    last_report_date: string;
  };
  return Array.from(teacherMap.values() as unknown as TeacherPerformanceData[]).map((teacher) => ({
    ...teacher,
    // days with a report out of the last 20 weekdays
    attendance_rate: Math.round((teacher.report_days.size / 20) * 100),
    // summing decimals leaves float noise (48.36999999999998); show one decimal
    total_hours: Math.round(teacher.total_hours * 10) / 10,
    avg_students: Math.round(teacher.total_students / teacher.total_reports) || 0
  }));
  }, []);

  const calculateWeeklyTrends = useCallback((reports: TeacherReport[]) => {
    // Calendar weeks (Monday to Sunday), compared by day, so a report on a Monday is never left out.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const monday = shiftDayKey(today, 1 - (now.getDay() || 7));
    const weeks: ReportTrend[] = [];
    for (let i = 3; i >= 0; i--) {
      const start = shiftDayKey(monday, -7 * i);
      const end = shiftDayKey(start, 6);
      const weekReports = reports.filter((report) => {
        const k = dayKey(report.date);
        return k >= start && k <= end;
      });
      const totalHours = weekReports.reduce((sum: number, r) => sum + (r.duration_hours || 0), 0);
      weeks.push({
        name: `Week ${4 - i}`,
        reports: weekReports.length,
        hours: Math.round(totalHours * 10) / 10
      });
    }
    return weeks;
  }, []);

  const calculateSubjectDistribution = useCallback((reports: TeacherReport[]) => {
    // The subject comes from the class timetable (set by the server). It is never guessed from the topic text.
    const subjectMap = new Map<string, number>();
    reports.forEach(report => {
      const subject = report.subject?.trim() || 'Not recorded';
      subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
    });
    const total = reports.length || 1;
    const distribution: SubjectDistribution[] = Array.from(subjectMap.entries())
      .map(([name, count], index) => ({
        name,
        value: Math.round((count / total) * 100),
        count,
        color: SUBJECT_COLORS[index % SUBJECT_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return distribution;
  }, []);


  const calculateAnalyticsData = useCallback((reports: TeacherReport[]) => {
    // Calculate weekly report trends (last 4 weeks)
    const weeklyTrends = calculateWeeklyTrends(reports);
    setReportTrendsData(weeklyTrends);

    // Calculate subject/grade distribution
    const subjectDistribution = calculateSubjectDistribution(reports);
    setSubjectDistributionData(subjectDistribution);
  }, [calculateSubjectDistribution, calculateWeeklyTrends]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setReportsFailed(false);
    try {
      // Loaded in full (up to the backend's cap) rather than the default
      // 100 — this page already aggregates stats/performance/analytics and
      // drives CSV export from this same list, so under-fetching silently
      // truncated all of those, not just the visible table.
      const params: Record<string, string> = { limit: '500' };
      if (dateFilter) params.date = dateFilter;
      if (schoolFilter) params.school_id = schoolFilter;
      if (teacherFilter) params.teacher_id = teacherFilter;
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;

      const { data: result } = await adminApi.teacherReports.list(params);
      const rawReports = result?.reports ?? result;
      const allReports = (Array.isArray(rawReports) ? rawReports : []) as TeacherReport[];
      let reportsData = allReports;
      if (gradeFilter) {
        reportsData = reportsData.filter(
          (r) =>
            formatGradeSection(r.grade, r.section) === gradeFilter ||
            r.grade === gradeFilter,
        );
      }
      setReports(reportsData);
      // Fill in any count the server leaves out, so a partial answer cannot crash the page.
      const stats = (result as { stats?: Partial<Record<"total" | "submitted" | "reviewed" | "approved" | "rejected", number>> })?.stats;
      setReportStats({ total: Number(stats?.total ?? 0), submitted: Number(stats?.submitted ?? 0), reviewed: Number(stats?.reviewed ?? 0), approved: Number(stats?.approved ?? 0), rejected: Number(stats?.rejected ?? 0) });

      // Extract unique class labels (grade-section) for filter dropdown
      const uniqueGrades = [...new Set(
        allReports
          .map((r) => formatGradeSection(r.grade, r.section))
          .filter(Boolean),
      )].sort() as string[];
      if (uniqueGrades.length > 0) {
        setGrades(uniqueGrades);
      }
      
      // Calculate performance metrics
      const performanceData = calculatePerformanceMetrics(reportsData);
      setPerformance(performanceData);
      
      // Calculate analytics data
      calculateAnalyticsData(reportsData);
    } catch (error) {
      console.error('Error loading reports:', error);
      // Keep what is on screen from an earlier load; the page says "did not load" only when there is nothing to show.
      setReportsFailed(true);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, [calculateAnalyticsData, calculatePerformanceMetrics, dateFilter, gradeFilter, schoolFilter, searchTerm, statusFilter, teacherFilter]);

  const loadTeachers = useCallback(async () => {
    try {
      console.log('🔍 Loading teachers for reports page...');
      const { data: result } = await adminApi.teachers.list();
      console.log('✅ Teachers API response:', result?.teachers?.length || 0, 'teachers');

      type ApiTeacher = {
        id: string;
        profile_id?: string | null;
        full_name?: string | null;
        /** the teachers endpoint sends the name as `name` */
        name?: string | null;
        email?: string | null;
      };
      const rawTeachers = result?.teachers ?? result;
      const teachersData: Teacher[] = ((Array.isArray(rawTeachers) ? rawTeachers : []) as ApiTeacher[]).map((teacher) => ({
        id: teacher.profile_id || teacher.id,
        full_name: teacher.full_name || teacher.name || teacher.email || 'Unknown',
        email: teacher.email || ''
      }));

      console.log('📋 Transformed teachers from API:', teachersData.length);
      setTeachers(teachersData);
    } catch (error) {
      console.error('❌ Error loading teachers:', error);
      setTeachers([]);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    try {
      const { data } = await adminApi.teacherAttendance.list({ school_id: schoolFilter || undefined });
      const summary = (data as { summary?: { attendanceRate?: number } })?.summary;
      setAvgAttendanceRate(typeof summary?.attendanceRate === 'number' ? summary.attendanceRate : null);
    } catch (error) {
      console.error('Error loading attendance summary:', error);
      setAvgAttendanceRate(null);
    }
  }, [schoolFilter]);

  const handleCleanupOrphaned = async () => {
    setCleaningUp(true);
    try {
      const { data } = await adminApi.teacherReports.cleanupOrphaned();
      const deleted = (data as { deleted?: number })?.deleted ?? 0;
      if (deleted > 0) {
        toast.success(`Removed ${deleted} orphaned report${deleted !== 1 ? 's' : ''} (deleted teacher/school)`);
        loadData();
      } else {
        toast.success('No orphaned reports found');
      }
    } catch (error) {
      console.error('Error cleaning up orphaned reports:', error);
      toast.error('Failed to clean up orphaned reports');
    } finally {
      setCleaningUp(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: loadData,
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });



  // Reports are already filtered by API, no need to filter again
  const filteredReports = reports;

  const orphanedCount = reports.filter((r) => r.teacher_deleted || r.school_deleted).length;

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  };

  const exportToCSV = () => {
    if (filteredReports.length === 0) {
      toast.warning('No reports to export');
      return;
    }

    // CSV headers
    const headers = ['Teacher Name', 'Teacher Email', 'School', 'Date', 'Class', 'Topics Taught', 'Students', 'Duration (Hours)', 'Notes'];
    
    // CSV rows
    const rows = filteredReports.map((report: TeacherReport) => [
      report.profiles?.full_name || report.teacher_name || 'Unknown',
      report.profiles?.email || report.teacher_email || '',
      report.schools?.name || report.school_name || 'Unknown',
      new Date(report.date).toLocaleDateString(),
      formatGradeSection(report.grade, report.section) || 'N/A',
      report.topics_taught || '',
      report.student_count || 0,
      report.duration_hours || 0,
      report.notes || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row: (string | number)[]) => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename with filters
    let filename = 'teacher_reports';
    if (dateFilter) filename += `_${dateFilter}`;
    if (schoolFilter) {
      const schoolName = schools.find((s: School) => s.id === schoolFilter)?.name || 'school';
      filename += `_${schoolName.replace(/\s+/g, '_')}`;
    }
    if (gradeFilter) filename += `_${gradeFilter}`;
    filename += '.csv';
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [tab, setTab] = useState<"reports" | "teachers" | "trends">("reports");
  const counts: Record<ReportStatus, number> = {
    submitted: reportStats.submitted,
    reviewed: reportStats.reviewed,
    approved: reportStats.approved,
    rejected: reportStats.rejected,
  };
  const unresolved = reportStats.submitted + reportStats.reviewed;
  const totalHours = Math.round(reports.reduce((t, r) => t + (r.duration_hours || 0), 0) * 10) / 10;
  const activeStatus: ReportStatus | null = statusFilter ? statusOf({ status: statusFilter }) : null;
  const filters: Filters = { search: searchTerm, date: dateFilter, school: schoolFilter, grade: gradeFilter, teacher: teacherFilter, hasStatus: !!statusFilter };
  const setFilter = useCallback((key: "search" | "date" | "school" | "grade" | "teacher", value: string) => {
    ({ search: setSearchTerm, date: setDateFilter, school: setSchoolFilter, grade: setGradeFilter, teacher: setTeacherFilter })[key](value);
  }, []);
  const clearFilters = () => { setSearchTerm(""); setDateFilter(""); setSchoolFilter(""); setGradeFilter(""); setTeacherFilter(""); setStatusFilter(""); };
  const tabs = [
    { id: "reports" as const, label: "Reports", n: reportStats.total },
    { id: "teachers" as const, label: "Teachers", n: performance.length },
    { id: "trends" as const, label: "Trends" },
  ];

  let statusLine: React.ReactNode;
  if (loading && !loadedOnce) statusLine = "Loading reports…";
  else if (reportsFailed && reports.length === 0) statusLine = "The reports did not load. Try again.";
  else if (reportStats.total === 0 && reports.length === 0) statusLine = (searchTerm || dateFilter || schoolFilter || gradeFilter || teacherFilter || statusFilter) ? "No reports match these filters." : "No reports yet. Teachers send one after each class.";
  else if (unresolved > 0) statusLine = <><strong>{plural(unresolved, "report")}</strong> {unresolved === 1 ? "is" : "are"} waiting for a decision.</>;
  else statusLine = <><strong>Every report has been decided.</strong> {plural(reportStats.total, "report")} in this view.</>;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ar-title">
        <div className="sd-hero-copy">
          <h1 id="ar-title" className="mc-hero-title">Teacher reports</h1>
          <p className="sd-where">What teachers taught, school by school</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            {unresolved > 0 && activeStatus !== "submitted" ? (
              <button className="sd-btn sd-btn--amber" onClick={() => { setStatusFilter("submitted"); setTab("reports"); }}>Show pending reports</button>
            ) : null}
            <button className="sd-btn sd-btn--ghost-dark" onClick={exportToCSV} disabled={loading || filteredReports.length === 0}>
              <Download aria-hidden="true" />Export {filteredReports.length > 0 ? `(${filteredReports.length})` : ""}
            </button>
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => { void loadData(); void loadAttendance(); }} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {!loadedOnce ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <StatusRun
            counts={counts}
            selected={activeStatus}
            onSelect={(st) => { setStatusFilter(st ?? ""); setTab("reports"); }}
            caption={schoolFilter || teacherFilter || dateFilter ? "For the filters you picked" : "Across every school"}
          />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Report numbers">
        <div><span className="sd-l">Reports</span><b className="sd-n">{reportStats.total.toLocaleString("en-IN")}</b><small>{reportStats.total > reports.length ? `${reports.length} loaded here` : "Matching your filters"}</small></div>
        <div><span className="sd-l">Teachers</span><b className="sd-n">{teachers.length}</b><small>{performance.length} sent a report in this view</small></div>
        <div><span className="sd-l">Teaching hours</span><b className="sd-n">{totalHours}</b><small>In the reports loaded</small></div>
        <div><span className="sd-l">Attendance today</span><b className="sd-n">{avgAttendanceRate != null ? `${avgAttendanceRate}%` : "–"}</b><small>Teachers marked present</small></div>
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Reports, teachers and trends" style={{ justifySelf: "start" }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" className="mc-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}{t.n != null && <b>{t.n}</b>}
          </button>
        ))}
      </div>

      {reportsFailed && reports.length === 0 && !loading && (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the reports</b>
            <p>Check your connection, then try again. Nothing was changed.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void loadData()}>Try again</button>
          </div>
        </section>
      )}
      {tab === "reports" && !(reportsFailed && reports.length === 0 && !loading) && (
        <ReportsList
          reports={filteredReports}
          loading={loading || !loadedOnce}
          totalMatching={reportStats.total}
          filters={filters}
          onFilter={setFilter}
          onClear={clearFilters}
          schools={schools}
          grades={grades}
          teachers={teachers}
          orphaned={orphanedCount}
          cleaningUp={cleaningUp}
          onCleanup={handleCleanupOrphaned}
          onReview={setReviewingReport}
          onBulk={bulkReview}
          todayKey={getTodayDate()}
        />
      )}
      {tab === "teachers" && <PerformanceTab rows={performance} loading={loading && !loadedOnce} />}
      {tab === "trends" && <TrendsTab trends={reportTrendsData} subjects={subjectDistributionData} performance={performance} />}

      {reviewingReport && (
        <ReviewModal key={reviewingReport.id} report={reviewingReport} onClose={() => setReviewingReport(null)} onSave={saveReview} />
      )}
    </div>
  );
}

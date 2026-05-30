"use client";

import { useState, useEffect, useCallback } from "react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAdminSchools } from "@/hooks/useAdminSchools";

const SUBJECT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA'];
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select as UISelect, SelectContent as UISelectContent, SelectItem as UISelectItem, SelectTrigger as UISelectTrigger, SelectValue as UISelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Search,
  Download,
  Eye,
  Users,
  TrendingUp,
  BarChart3,
  FileText,
  Clock
} from "lucide-react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { adminApi } from '@/lib/api/admin.api';

interface TeacherReport {
  id: string;
  teacher_id: string;
  school_id: string;
  date: string;
  grade: string;
  topics_taught: string;
  student_count: number;
  duration_hours: number;
  notes: string;
  status?: string;
  created_at: string;

  profiles?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;

  schools?: {
    id: string;
    name?: string | null;
    school_code?: string | null;
  } | null;
  teacher_name?: string;
  teacher_email?: string;
  school_name?: string;
  class_name?: string;
}

interface TeacherPerformance {
  teacher_id: string;
  teacher_name: string;
  school_name: string;
  total_reports: number;
  total_hours: number;
  avg_students: number;
  attendance_rate: number;
  last_report_date: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type reserved for future use
interface School {
  id: string;
  name: string;
}

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
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isReviewSaving, setIsReviewSaving] = useState(false);

  const handleUpdateReportStatus = async () => {
    if (!reviewingReport || !reviewStatus) return;
    setIsReviewSaving(true);
    try {
      await adminApi.teacherReports.update({
        id: reviewingReport.id,
        status: reviewStatus,
        admin_notes: reviewNotes.trim() || undefined,
      });
      setReports((prev) =>
        prev.map((r) => r.id === reviewingReport.id ? { ...r, status: reviewStatus, notes: reviewNotes.trim() || r.notes } : r)
      );
      setReviewingReport(null);
    } catch (err) {
      console.error('Failed to update report status', err);
      alert('Failed to update report status. Please try again.');
    } finally {
      setIsReviewSaving(false);
    }
  };
  { }
  type ReportTrend = {
    name: string;
    reports: number;
    hours: number;
  };
  const [reportTrendsData, setReportTrendsData] = useState<ReportTrend[]>([]);
  { }
  type SubjectDistribution = {
    name: string;
    value: number;
    count: number;
    color: string;
  };
  const [subjectDistributionData, setSubjectDistributionData] = useState<SubjectDistribution[]>([]);

  // Move helper calculations above loadData to avoid temporal dead zone issues


  const calculatePerformanceMetrics = useCallback((reports: TeacherReport[]) => {
    const teacherMap = new Map();

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
          attendance_rate: 0,
          last_report_date: report.date
        });
      }

      const teacher = teacherMap.get(teacherId);
      teacher.total_reports += 1;
      teacher.total_hours += report.duration_hours || 0;
      teacher.total_students += report.student_count || 0;
      teacher.attendance_rate = Math.min(100, (teacher.total_reports / 20) * 100); // Assuming 20 working days
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
    attendance_rate: number;
    last_report_date: string;
  };
  return Array.from(teacherMap.values() as unknown as TeacherPerformanceData[]).map((teacher) => ({
    ...teacher,
    avg_students: Math.round(teacher.total_students / teacher.total_reports) || 0
  }));
  }, []);

  const calculateWeeklyTrends = useCallback((reports: TeacherReport[]) => {
    const now = new Date();
    const weeks: ReportTrend[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7) - (now.getDay() || 7) + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekReports = reports.filter((report) => {
        const reportDate = new Date(report.date);
        return reportDate >= weekStart && reportDate <= weekEnd;
      });
      const totalReports = weekReports.length;
      const totalHours = weekReports.reduce((sum: number, r) => sum + (r.duration_hours || 0), 0);
      weeks.push({
        name: `Week ${4 - i}`,
        reports: totalReports,
        hours: Math.round(totalHours * 10) / 10
      });
    }
    return weeks;
  }, []);

  const calculateSubjectDistribution = useCallback((reports: TeacherReport[]) => {
    const subjectMap = new Map<string, number>();
    reports.forEach(report => {
      const topics = report.topics_taught?.toLowerCase() || '';
      let subject = 'Other';
      if (topics.includes('math') || topics.includes('algebra') || topics.includes('geometry') || topics.includes('calculus') || topics.includes('arithmetic')) {
        subject = 'Mathematics';
      } else if (topics.includes('science') || topics.includes('physics') || topics.includes('chemistry') || topics.includes('biology')) {
        subject = 'Science';
      } else if (topics.includes('english') || topics.includes('literature') || topics.includes('grammar') || topics.includes('writing') || topics.includes('reading')) {
        subject = 'English';
      } else if (topics.includes('history') || topics.includes('social') || topics.includes('geography')) {
        subject = 'History';
      } else if (topics.includes('coding') || topics.includes('programming') || topics.includes('computer') || topics.includes('ai') || topics.includes('python') || topics.includes('java')) {
        subject = 'Coding/Computer Science';
      } else if (topics.includes('art') || topics.includes('drawing') || topics.includes('painting')) {
        subject = 'Arts';
      } else if (topics.includes('music')) {
        subject = 'Music';
      } else if (topics.includes('physical') || topics.includes('pe') || topics.includes('sport')) {
        subject = 'Physical Education';
      } else if (report.grade) {
        subject = report.grade;
      }
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
    try {
      const params: Record<string, string> = {};
      if (dateFilter) params.date = dateFilter;
      if (schoolFilter) params.school_id = schoolFilter;
      if (gradeFilter) params.grade = gradeFilter;
      if (teacherFilter) params.teacher_id = teacherFilter;
      if (searchTerm) params.search = searchTerm;

      const { data: result } = await adminApi.teacherReports.list(params as { school_id?: string; from?: string; to?: string });
      const reportsData = result?.reports || result || [];
      setReports(reportsData);
      
      // Extract unique grades from reports for filter dropdown
      const uniqueGrades = [...new Set(reportsData.map((r: TeacherReport) => r.grade).filter(Boolean) as string[])].sort() as string[];
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
      setReports([]);
      setPerformance([]);
      setReportTrendsData([]);
      setSubjectDistributionData([]);
    } finally {
      setLoading(false);
    }
  }, [calculateAnalyticsData, calculatePerformanceMetrics, dateFilter, gradeFilter, schoolFilter, searchTerm, teacherFilter]);

  const loadTeachers = useCallback(async () => {
    try {
      console.log('🔍 Loading teachers for reports page...');
      const { data: result } = await adminApi.teachers.list();
      console.log('✅ Teachers API response:', result?.teachers?.length || 0, 'teachers');

      type ApiTeacher = {
        id: string;
        profile_id?: string | null;
        full_name?: string | null;
        email?: string | null;
      };
      const teachersData: Teacher[] = ((result?.teachers || result || []) as ApiTeacher[]).map((teacher) => ({
        id: teacher.profile_id || teacher.id,
        full_name: teacher.full_name || 'Unknown',
        email: teacher.email || ''
      }));

      console.log('📋 Transformed teachers from API:', teachersData.length);
      setTeachers(teachersData);
    } catch (error) {
      console.error('❌ Error loading teachers:', error);
      setTeachers([]);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: loadData,
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });



  // Reports are already filtered by API, no need to filter again
  const filteredReports = reports;

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const exportToCSV = () => {
    if (filteredReports.length === 0) {
      alert('No reports to export');
      return;
    }

    // CSV headers
    const headers = ['Teacher Name', 'Teacher Email', 'School', 'Date', 'Grade', 'Topics Taught', 'Students', 'Duration (Hours)', 'Notes'];
    
    // CSV rows
    const rows = filteredReports.map((report: TeacherReport) => [
      report.profiles?.full_name || report.teacher_name || 'Unknown',
      report.profiles?.email || report.teacher_email || '',
      report.schools?.name || report.school_name || 'Unknown',
      new Date(report.date).toLocaleDateString(),
      report.grade || 'N/A',
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

  return (
    <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Teacher Reports</h1>
            <p className="text-gray-600 mt-2">Monitor teacher performance and daily reports</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reports.length}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Teachers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teachers.length}</div>
                <p className="text-xs text-muted-foreground">Total teachers ({performance.length} with reports)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performance.length > 0 ? 
                    Math.round(performance.reduce((sum: number, p: TeacherPerformance) => sum + p.attendance_rate, 0) / performance.length) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Teacher attendance</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reports.reduce((total: number, report: TeacherReport) => total + (report.duration_hours || 0), 0)}
                </div>
                <p className="text-xs text-muted-foreground">Teaching hours</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="reports" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="reports">Daily Reports</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Daily Reports Tab */}
            <TabsContent value="reports" className="space-y-6">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Filter Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="search">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="search"
                          placeholder="Search reports..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <div className="flex gap-2">
                        <Input
                          id="date"
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDateFilter(getTodayDate())}
                          title="Today"
                        >
                          Today
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="school">School</Label>
                      <select
                        id="school"
                        value={schoolFilter}
                        onChange={(e) => setSchoolFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="">All Schools</option>
                        {schools.map((school) => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grade">Grade</Label>
                      <select
                        id="grade"
                        value={gradeFilter}
                        onChange={(e) => setGradeFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="">All Grades</option>
                        {grades.length > 0 ? (
                          grades.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                            </option>
                          ))
                        ) : (
                          // Fallback to common grades if no reports exist yet
                          ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'].map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                          </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teacher">Teacher</Label>
                      <select
                        id="teacher"
                        value={teacherFilter}
                        onChange={(e) => setTeacherFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="">All Teachers</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.full_name || teacher.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Actions</Label>
                      <Button 
                        variant="outline" 
                        onClick={exportToCSV}
                        className="w-full"
                        disabled={loading || filteredReports.length === 0}
                      >
                        {loading ? (
                          <>
                            <Clock className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Export ({filteredReports.length})
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reports Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Reports ({filteredReports.length})</CardTitle>
                  <CardDescription>View all teacher daily reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Topics</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Students</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <div className="flex items-center justify-center gap-2">
                              <Clock className="h-4 w-4 animate-spin" />
                              Loading reports...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredReports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            No reports found. {reports.length === 0 ? 'No reports available.' : 'Try adjusting your filters.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">
                              {report.profiles?.full_name || report.teacher_name || 'Unknown'}
                            </TableCell>
                            <TableCell>{report.schools?.name || report.school_name || 'Unknown'}</TableCell>
                            <TableCell>
                              {new Date(report.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div>
                                <Badge variant="outline" className="text-sm font-medium">
                                  {report.grade || 'N/A'}
                                  </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="truncate" title={report.topics_taught}>
                                {report.topics_taught || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1 text-blue-600" />
                                {report.duration_hours || 0}h
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Users className="h-4 w-4 mr-1 text-green-600" />
                                {report.student_count || 0}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const s = report.status || 'submitted';
                                const cfg: Record<string, { label: string; cls: string }> = {
                                  submitted: { label: 'Submitted', cls: 'bg-yellow-100 text-yellow-700' },
                                  reviewed:  { label: 'Reviewed',  cls: 'bg-blue-100 text-blue-700' },
                                  approved:  { label: 'Approved',  cls: 'bg-green-100 text-green-700' },
                                  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700' },
                                };
                                const { label, cls } = cfg[s] ?? cfg.submitted;
                                return <Badge className={cls}>{label}</Badge>;
                              })()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReviewingReport(report);
                                  setReviewStatus(report.status || 'submitted');
                                  setReviewNotes(report.notes || '');
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Teacher Performance</CardTitle>
                  <CardDescription>Track individual teacher performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Reports</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Avg Students</TableHead>
                        <TableHead>Attendance</TableHead>
                        <TableHead>Last Report</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.map((teacher) => (
                        <TableRow key={teacher.teacher_id}>
                          <TableCell className="font-medium">
                            {teacher.teacher_name}
                          </TableCell>
                          <TableCell>{teacher.school_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 mr-1" />
                              {teacher.total_reports}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {teacher.total_hours}h
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {teacher.avg_students}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{ width: `${teacher.attendance_rate}%` }}
                                ></div>
                              </div>
                              <span className="text-sm">{Math.round(teacher.attendance_rate)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(teacher.last_report_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                teacher.attendance_rate >= 90 ? 'default' :
                                teacher.attendance_rate >= 70 ? 'secondary' : 'destructive'
                              }
                            >
                              {teacher.attendance_rate >= 90 ? 'Excellent' :
                               teacher.attendance_rate >= 70 ? 'Good' : 'Needs Attention'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Report Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle>Report Trends</CardTitle>
                    <CardDescription>Weekly report submission trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reportTrendsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reportTrendsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                          <Tooltip
                            formatter={(value: unknown, name: string): [React.ReactNode, string] => {
                              if (name === 'reports') return [`${value} reports`, 'Reports'];
                              if (name === 'hours') return [`${value} hours`, 'Teaching Hours'];
                              return [String(value), name];
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="reports" 
                            stroke="#8884d8" 
                            strokeWidth={2}
                            name="Reports"
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="hours" 
                            stroke="#82ca9d" 
                            strokeWidth={2}
                            name="Teaching Hours"
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                      </LineChart>
                    </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No data available for the selected period</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Subject Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Subject Distribution</CardTitle>
                    <CardDescription>Teaching topics distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {subjectDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={subjectDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                            label={(props: { name?: string; value?: number; count?: number }) => {
                              const name = props.name || '';
                              const value = props.value || 0;
                              const count = props.count || 0;
                              return `${name}: ${value}% (${count})`;
                            }}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {subjectDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                          <Tooltip 
                             
                            formatter={(value: unknown, name: string, props: { payload?: { count?: number; name?: string } }) => {
                              return [`${value}% (${props.payload?.count ?? 0} reports)`, props.payload?.name ?? ''];
                            }}
                          />
                          <Legend 
                            formatter={(value: string, entry: unknown) => {
                              const e = entry as { payload?: { count?: number } };
                              return `${value} (${e?.payload?.count ?? 0})`;
                            }}
                          />
                      </PieChart>
                    </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No subject data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Performance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                  <CardDescription>Overall system performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {performance.filter((p: TeacherPerformance) => p.attendance_rate >= 90).length}
                      </div>
                      <div className="text-sm text-gray-600">Excellent Teachers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600">
                        {performance.filter((p: TeacherPerformance) => p.attendance_rate >= 70 && p.attendance_rate < 90).length}
                      </div>
                      <div className="text-sm text-gray-600">Good Teachers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">
                        {performance.filter((p: TeacherPerformance) => p.attendance_rate < 70).length}
                      </div>
                      <div className="text-sm text-gray-600">Need Attention</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

      {/* Report Review Dialog */}
      <Dialog open={!!reviewingReport} onOpenChange={(o) => { if (!o) setReviewingReport(null); }}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>
          {reviewingReport && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Teacher:</span> {reviewingReport.profiles?.full_name || reviewingReport.teacher_name}</p>
                <p><span className="font-medium">Date:</span> {new Date(reviewingReport.date).toLocaleDateString()}</p>
                <p><span className="font-medium">Topics:</span> {reviewingReport.topics_taught}</p>
                {reviewingReport.notes && <p><span className="font-medium">Teacher Notes:</span> {reviewingReport.notes}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Update Status</Label>
                <UISelect value={reviewStatus} onValueChange={setReviewStatus}>
                  <UISelectTrigger className="w-full">
                    <UISelectValue placeholder="Select status" />
                  </UISelectTrigger>
                  <UISelectContent className="bg-white">
                    <UISelectItem value="submitted">Submitted</UISelectItem>
                    <UISelectItem value="reviewed">Reviewed</UISelectItem>
                    <UISelectItem value="approved">Approved</UISelectItem>
                    <UISelectItem value="rejected">Rejected</UISelectItem>
                  </UISelectContent>
                </UISelect>
              </div>
              <div className="space-y-1.5">
                <Label>Admin Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Textarea
                  placeholder="Add notes for this report…"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingReport(null)} disabled={isReviewSaving}>Cancel</Button>
            <Button onClick={handleUpdateReportStatus} disabled={isReviewSaving || !reviewStatus} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isReviewSaving ? 'Saving…' : 'Save Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

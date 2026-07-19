"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Calendar,
  User,
  BookOpen,
  Users,
  CheckSquare,
  Square,
  BarChart2,
  FileText,
  AlertTriangle
} from "lucide-react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";

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
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  teacher: {
    full_name: string;
    email: string;
  };
  status: 'Pending' | 'Approved' | 'Rejected';
  // Deprecated: class_name is kept for backward compatibility but grade should be used
  class_name?: string;
}

export default function ReportsManagement() {
  const [reports, setReports] = useState<TeacherReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [dateRange, setDateRange] = useState({
    start: "",
    end: ""
  });
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [isBulkApproveOpen, setIsBulkApproveOpen] = useState(false);
  const [_schoolId, setSchoolId] = useState<string>("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get school_id from school API (uses school_admins table)
      try {
        const schoolRes = await schoolAdminApi.school.get();
        const schoolData = schoolRes.data ?? {};
        const school = (schoolData as { school?: { id?: string } }).school;
        if (school?.id) setSchoolId(school.id);
      } catch (err) {
        console.warn('Could not fetch school info:', err);
        // Continue anyway - API routes will handle school_id
      }

      // Load teacher reports via centralized schoolAdminApi (bypasses RLS)
      // Explicit limits — the backend defaults to 50, and this page computes its
      // own status counts, filters, and per-teacher coverage from these lists.
      const [reportsRes, schedulesRes, periodsRes, teachersRes] = await Promise.all([
        schoolAdminApi.reports.list({ limit: 500 }),
        schoolAdminApi.schedules.list(),
        schoolAdminApi.periods.list(),
        schoolAdminApi.teachers.list({ limit: 500 })
      ]);

      // Reports
      const reportsData = reportsRes.data ?? {};
      const reportsArray = (reportsData as { reports?: unknown[] }).reports ?? (Array.isArray(reportsData) ? reportsData : []);
      setReports(reportsArray as TeacherReport[]);

      // Schedules
      const schedulesData = schedulesRes.data ?? {};
      setSchedules((schedulesData as { schedules?: any[] }).schedules ?? (Array.isArray(schedulesData) ? schedulesData : []));

      // Periods
      const periodsData = periodsRes.data ?? {};
      setPeriods((periodsData as { periods?: any[] }).periods ?? (Array.isArray(periodsData) ? periodsData : []));

      // Teachers
      const teachersData = teachersRes.data ?? {};
      const rawTeachers = (teachersData as { teachers?: any[] }).teachers ?? (Array.isArray(teachersData) ? teachersData : []);
      
      // Basic transformation for analytics
      const transformedTeachers = rawTeachers.map((t: any) => {
        const profile = t.profile || {};
        const teacher = t.teacher || {};
        return {
          id: profile.id || t.teacher_id || (teacher as any).profile_id || t.id,
          full_name: t.full_name || profile.full_name || profile.fullName || teacher.full_name || 'Unknown',
          email: t.email || profile.email || teacher.email || ''
        };
      }).filter((t: any) => t.id);
      
      setTeachers(transformedTeachers);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleApproveReport = async (reportId: string) => {
    try {
      await schoolAdminApi.reports.update(reportId, { action: 'approve' });
      await loadReports();
    } catch (error) {
      console.error('Error approving report:', error);
      toast.error(`Failed to approve report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRejectReport = async (reportId: string) => {
    try {
      await schoolAdminApi.reports.update(reportId, { action: 'reject' });
      await loadReports();
    } catch (error) {
      console.error('Error rejecting report:', error);
      toast.error(`Failed to reject report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBulkApprove = async () => {
    try {
      const response = await schoolAdminApi.reports.bulk({ report_ids: selectedReports });
      const data = (response.data ?? {}) as { approved?: number };
      toast.success(`Successfully approved ${data.approved ?? selectedReports.length} report(s)`);
      setSelectedReports([]);
      setIsBulkApproveOpen(false);
      await loadReports();
    } catch (error) {
      console.error('Error bulk approving reports:', error);
      toast.error(`Failed to approve reports: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const handleSelectReport = (reportId: string) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter((id: string) => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleSelectAll = () => {
    const pendingReports = filteredReports.filter((r: TeacherReport) => r.status === 'Pending');
    if (selectedReports.length === pendingReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(pendingReports.map((r: TeacherReport) => r.id));
    }
  };

  const filteredReports = reports.filter((report: TeacherReport) => {
    const matchesSearch = report.teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.topics_taught.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (report.grade || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || report.status.toLowerCase() === statusFilter;
    const matchesTeacher = teacherFilter === "all" || report.teacher_id === teacherFilter;
    const matchesGrade = gradeFilter === "all" || report.grade === gradeFilter;
    
    const matchesDateRange = (!dateRange.start || new Date(report.date) >= new Date(dateRange.start)) &&
                           (!dateRange.end || new Date(report.date) <= new Date(dateRange.end));
    
    return matchesSearch && matchesStatus && matchesTeacher && matchesGrade && matchesDateRange;
  });

  const getTeachers = () => {
    const teachers = [...new Set(reports.map((r: TeacherReport) => r.teacher_id))];
    return teachers.map((teacherId: string) => {
      const report = reports.find((r: TeacherReport) => r.teacher_id === teacherId);
      return {
        id: teacherId,
        name: report?.teacher.full_name || 'Unknown'
      };
    });
  };

  const getGrades = () => {
    return [...new Set(reports.map((r: TeacherReport) => r.grade))].sort();
  };

  const getStats = () => {
    const total = reports.length;
    const pending = reports.filter((r: TeacherReport) => r.status === 'Pending').length;
    const approved = reports.filter((r: TeacherReport) => r.status === 'Approved').length;
    const rejected = reports.filter((r: TeacherReport) => r.status === 'Rejected').length;
    
    return { total, pending, approved, rejected };
  };

  const calculateDuration = (p: any) => {
    if (!p) return 0;
    const s = new Date(`2000-01-01T${p.start_time}`);
    const e = new Date(`2000-01-01T${p.end_time}`);
    return (e.getTime() - s.getTime()) / (1000 * 60 * 60);
  };

  const getTeacherWorkload = (teacherId: string) => {
    const teacherSchedules = schedules.filter(s => s.teacher_id === teacherId && s.is_active);
    const totalHours = teacherSchedules.reduce((acc, s) => {
      const p = periods.find(per => per.id === s.period_id);
      return acc + calculateDuration(p);
    }, 0);
    
    return {
      hours: totalHours,
      periods: teacherSchedules.length,
      status: totalHours > 30 ? "Overloaded" : totalHours > 24 ? "High" : "Normal",
      statusColor: totalHours > 30 ? "bg-red-100 text-red-700" : totalHours > 24 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Teacher Management Reports</h1>
        <p className="text-gray-600 mt-2">Monitor teacher activity and workload analytics</p>
      </div>

      <Tabs defaultValue="reports" className="space-y-6">
        <TabsList>
          <TabsTrigger value="reports">
            <FileText className="h-4 w-4 mr-2" />
            Daily Reports
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart2 className="h-4 w-4 mr-2" />
            Workload Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Approved reports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected reports</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
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
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="teacher">Teacher</Label>
              <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teachers</SelectItem>
                  {getTeachers().map((teacher: { id: string; name: string }) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="grade">Grade</Label>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {getGrades().map((grade: string) => (
                    <SelectItem key={grade} value={grade}>
                      Grade {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-gray-600">
          Showing {filteredReports.length} of {reports.length} reports
        </div>
        <div className="flex gap-2">
          {stats.pending > 0 && (
            <Dialog open={isBulkApproveOpen} onOpenChange={setIsBulkApproveOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Bulk Approve ({selectedReports.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Approve Reports</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to approve {selectedReports.length} selected reports?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBulkApproveOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleBulkApprove}>Approve All</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Teacher Reports</CardTitle>
          <CardDescription>Review and approve daily teaching reports</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-8 w-8 p-0"
                  >
                    {selectedReports.length === filteredReports.filter((r: TeacherReport) => r.status === 'Pending').length ? 
                      <CheckSquare className="h-4 w-4" /> : 
                      <Square className="h-4 w-4" />
                    }
                  </Button>
                </TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Topics</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    {report.status === 'Pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectReport(report.id)}
                        className="h-8 w-8 p-0"
                      >
                        {selectedReports.includes(report.id) ?
                          <CheckSquare className="h-4 w-4" /> :
                          <Square className="h-4 w-4" />
                        }
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-3 w-3 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{report.teacher.full_name}</div>
                        <div className="text-xs text-gray-500">{report.teacher.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(report.date).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-sm font-medium">
                      {report.grade || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm max-w-xs truncate" title={report.topics_taught}>
                      {report.topics_taught}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm">
                      <Users className="h-4 w-4 mr-1" />
                      {report.student_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{report.duration_hours}h</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      report.status === 'Approved' ? 'default' :
                      report.status === 'Pending' ? 'secondary' : 'destructive'
                    }>
                      {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {report.status === 'Pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => handleApproveReport(report.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-red-700 border-red-300 hover:bg-red-50"
                          onClick={() => handleRejectReport(report.id)}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredReports.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4" />
              <p className="text-lg font-medium">No reports found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {schedules.filter(s => s.is_active).reduce((acc, s) => {
                    const p = periods.find(per => per.id === s.period_id);
                    return acc + calculateDuration(p);
                  }, 0).toFixed(1)}h
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
                  {(schedules.filter(s => s.is_active).reduce((acc, s) => {
                    const p = periods.find(per => per.id === s.period_id);
                    return acc + calculateDuration(p);
                  }, 0) / (teachers.length || 1)).toFixed(1)}h
                </div>
                <p className="text-xs text-muted-foreground">Per teacher per week</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Teacher Workload & Capacity</CardTitle>
              <CardDescription>Live analytics pulled from the weekly class schedule</CardDescription>
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
                    // Mock coverage based on reports vs schedules
                    const coverage = Math.min(100, Math.round((reports.filter(r => r.teacher_id === teacher.id && r.status === 'Approved').length / Math.max(1, workload.periods)) * 100));
                    
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
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No teacher workload data available. Ensure schedules are created.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}


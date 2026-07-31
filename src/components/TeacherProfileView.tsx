"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import { WEEKDAY_LABELS } from "@/lib/weekday-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Mail,
  Phone,
  Calendar,
  Briefcase,
  School,
  User,
  Download
} from "lucide-react";
import { adminApi } from "../lib/api";
import ImpersonateUserButton from "./admin/ImpersonateUserButton";
import { formatWorkingDays } from "@/lib/weekday-utils";

interface GradeAssigned {
  gradeName: string;
  sectionsAssigned: string[];
}

interface AssignedSchool {
  schoolId: string;
  schoolName: string;
  gradesAssigned: GradeAssigned[];
  subjects?: string[];
}

interface Teacher {
  id: string | number;
  teacher_id?: string;
  full_name?: string;
  name?: string;
  email: string;
  phone?: string;
  qualification?: string;
  experience?: string;
  experience_years?: number;
  specialization?: string;
  status: string;
  role?: string;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  teacher_schools?: TeacherSchool[];
  assignedSchools?: AssignedSchool[];
}

interface TeacherSchool {
  id?: string;
  teacher_id?: string;
  school_id: string;
  schoolId?: string;
  grades_assigned?: string[];
  grade_sections_assigned?: string | Array<{ grade: string; sections: string[] }>;
  gradesAssigned?: GradeAssigned[];
  subjects?: string[];
  working_days_per_week?: number;
  working_days?: number[];
  max_students_per_session?: number;
  is_primary?: boolean;
  schoolName?: string;
  schools?: {
    id: string;
    name: string;
    school_code: string;
    city?: string;
    state?: string;
  };
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'Present' | 'Absent (Approved)' | 'Absent (Unapproved)' | 'Late';
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
}

interface DailyReport {
  id: string;
  date: string;
  summary: string;
  grade?: string;
  school_name?: string;
  subjects?: string[];
}

interface TeacherProfileViewProps {
  teacher: Teacher | null;
  open: boolean;
  onClose: () => void;
  refreshTrigger?: number; // Add refresh trigger
}

export default function TeacherProfileView({ teacher, open, onClose, refreshTrigger }: TeacherProfileViewProps) {
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [workSummary, setWorkSummary] = useState({
    totalWorkingDays: 0,
    totalLeavesTaken: 0,
    attendancePercentage: 0,
    totalDays: 0
  });
  const [loading, setLoading] = useState(false);
  const [_selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (open && teacher) {
      setCurrentTeacher(teacher);
      loadTeacherData();
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- load when open/teacher, loadTeacherData stable */
  }, [open, teacher]);

  // Handle refresh trigger
  useEffect(() => {
    if (open && teacher && refreshTrigger) {
      loadTeacherData();
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- load on refreshTrigger only */
  }, [refreshTrigger]);

  // Update current teacher when prop changes
  useEffect(() => {
    if (teacher) {
      setCurrentTeacher(teacher);
    }
  }, [teacher]);

  const loadTeacherData = async () => {
    if (!teacher) return;
    
    setLoading(true);
    try {
      const { data: teacherList } = await adminApi.teachers.list();
      const list = Array.isArray((teacherList as any)?.teachers)
        ? (teacherList as any).teachers
        : (teacherList as any) || [];
      const teacherId = String(teacher.id ?? teacher.teacher_id ?? '');
      const updatedTeacher = (list as Teacher[]).find((t) => String(t.id ?? (t as Teacher).teacher_id) === teacherId);
      if (updatedTeacher) {
        setCurrentTeacher(updatedTeacher);
      }

      const { data: attendanceData } = await adminApi.teacherAttendance.list({ teacherId: String(teacher.id ?? teacher.teacher_id) });
      const records = ((attendanceData as any)?.attendance || []) as AttendanceRecord[];
      setAttendanceRecords(records);

      const presentDays = records.filter((r) => r.status === 'Present').length;
      const leaveDays = records.filter((r) => r.status === 'Absent (Approved)').length;
      const totalDays = records.length;

      setWorkSummary({
        totalWorkingDays: presentDays,
        totalLeavesTaken: leaveDays,
        attendancePercentage: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
        totalDays,
      });

      // Load teacher daily reports (recent) via API, fall back to empty if unavailable
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 30);

        const schools = currentTeacher?.assignedSchools ?? currentTeacher?.teacher_schools ?? [];
        const schoolId =
          (currentTeacher?.teacher_schools?.find((s) => s.is_primary) as TeacherSchool | undefined)?.school_id
          ?? (currentTeacher?.teacher_schools?.[0] as TeacherSchool | undefined)?.school_id
          ?? (schools[0] as AssignedSchool | undefined)?.schoolId;

        const { data: reportsData } = await adminApi.teacherReports.list({
          ...(schoolId ? { school_id: schoolId } : {}),
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
        });

        type RawTeacherReport = {
          id?: string;
          date?: string;
          created_at?: string;
          summary?: string;
          grade?: string;
          school_name?: string;
          subjects?: string[];
          teacher_id?: string;
        };

        const raw = ((reportsData as any)?.reports || (reportsData as any)?.teacherReports || (reportsData as any) || []) as RawTeacherReport[];

        const filtered = raw.filter((r) => !r.teacher_id || String(r.teacher_id) === String(teacher.id ?? teacher.teacher_id));

        const mapped: DailyReport[] = filtered
          .map((r) => ({
            id: r.id || `${r.date || r.created_at || ''}`,
            date: r.date || (r.created_at ? String(r.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10)),
            summary: r.summary || '',
            grade: r.grade,
            school_name: r.school_name,
            subjects: r.subjects,
          }))
          .filter((r) => r.summary.trim() !== '')
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));

        setDailyReports(mapped);
      } catch (e) {
        console.warn('Teacher reports unavailable:', e);
        setDailyReports([]);
      }
    } catch (error) {
      console.error('Error loading teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present':
        return 'bg-green-100 text-green-800';
      case 'Absent (Approved)':
        return 'bg-yellow-100 text-yellow-800';
      case 'Absent (Unapproved)':
        return 'bg-red-100 text-red-800';
      case 'Late':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDayStatus = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    type AttRecord = { date?: string; status?: string };
    const record = attendanceRecords.find((r: AttRecord) => r.date === dateStr);
    
    if (record) {
      if (record.status === 'Present') return 'present';
      if (record.status === 'Absent (Approved)') return 'leave';
      return 'absent';
    }
    
    // Check if weekend
    const day = date.getDay();
    if (day === 0 || day === 6) return 'weekend';
    
    return 'normal';
  };

  const exportAttendanceCSV = () => {
    if (!teacher) return;
    
    const headers = ['Date', 'Status', 'Check In', 'Check Out', 'Notes'];
    type CsvRecord = { date?: string; status?: string; check_in_time?: string; check_out_time?: string; notes?: string };
    const rows = attendanceRecords.map((r: CsvRecord) => [
      r.date,
      r.status,
      r.check_in_time || 'N/A',
      r.check_out_time || 'N/A',
      r.notes || ''
    ]);
    
    const csv = [headers, ...rows].map((row: (string | undefined)[]) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTeacher?.full_name || 'teacher'}_attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!currentTeacher) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Teacher Profile</DialogTitle>
            <ImpersonateUserButton userId={currentTeacher.id} label="Sign in as teacher" />
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading teacher data...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* General Information */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  General Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="text-lg font-semibold">{currentTeacher.name ?? currentTeacher.full_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-lg flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {currentTeacher.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Number</p>
                    <p className="text-lg flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {currentTeacher.phone ?? 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Teacher ID</p>
                    <p className="text-lg font-mono">{currentTeacher.teacher_id ?? String(currentTeacher.id ?? '')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Qualification</p>
                    <p className="text-lg">{currentTeacher.qualification ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Experience</p>
                    <p className="text-lg">
                      {currentTeacher.experience !== undefined && currentTeacher.experience !== ''
                        ? currentTeacher.experience
                        : currentTeacher.experience_years != null
                          ? `${currentTeacher.experience_years} years`
                          : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Specialization</p>
                    <p className="text-lg">{currentTeacher.specialization ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Joining</p>
                    <p className="text-lg flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {(() => {
                        const raw = currentTeacher.createdAt ?? currentTeacher.created_at;
                        if (!raw) return 'N/A';
                        const d = new Date(raw);
                        return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
                      })()}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={
                      (currentTeacher.status === 'Active' || currentTeacher.status === 'active') ? 'bg-green-500' :
                      currentTeacher.status === 'On Leave' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }>
                      {currentTeacher.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assigned Schools and Grades */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <School className="h-5 w-5" />
                  Assigned Schools and Grades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const schools = currentTeacher.assignedSchools ?? currentTeacher.teacher_schools ?? [];
                  if (!schools.length) return <p className="text-muted-foreground">No schools assigned</p>;
                  return (
                    <div className="space-y-4">
                      {schools.map((schoolAssignment, idx) => {
                        const isNewShape = 'schoolName' in schoolAssignment && 'gradesAssigned' in schoolAssignment;
                        const schoolName = isNewShape
                          ? (schoolAssignment as AssignedSchool).schoolName
                          : (schoolAssignment as TeacherSchool).schools?.name ?? 'Unknown School';
                        const key = isNewShape
                          ? (schoolAssignment as AssignedSchool).schoolId
                          : (schoolAssignment as TeacherSchool).id ?? (schoolAssignment as TeacherSchool).school_id ?? idx;
                        const gradesAssigned = isNewShape
                          ? (schoolAssignment as AssignedSchool).gradesAssigned ?? []
                          : [];
                        const gradeSectionsLegacy = (schoolAssignment as TeacherSchool).grade_sections_assigned
                          ? (typeof (schoolAssignment as TeacherSchool).grade_sections_assigned === 'string'
                              ? JSON.parse((schoolAssignment as TeacherSchool).grade_sections_assigned as string)
                              : (schoolAssignment as TeacherSchool).grade_sections_assigned)
                          : [];
                        const gradesLegacy = (schoolAssignment as TeacherSchool).grades_assigned ?? [];
                        const hasNewGrades = Array.isArray(gradesAssigned) && gradesAssigned.length > 0;
                        const hasLegacyGrades = gradeSectionsLegacy.length > 0 || gradesLegacy.length > 0;
                        return (
                          <div key={String(key)} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg flex items-center gap-2">
                                  {schoolName}
                                  {(schoolAssignment as TeacherSchool).is_primary && (
                                    <Badge variant="secondary" className="text-xs">Primary</Badge>
                                  )}
                                </h4>
                                {(schoolAssignment as TeacherSchool).schools?.school_code && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {(schoolAssignment as TeacherSchool).schools?.school_code}
                                  </p>
                                )}
                                <div className="mt-3 space-y-2">
                                  <div>
                                    <p className="text-sm font-medium">Grades &amp; Sections:</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {hasNewGrades
                                        ? (gradesAssigned as GradeAssigned[]).map((gs) => {
                                            const sectionsStr = gs.sectionsAssigned?.length
                                              ? ` (${gs.sectionsAssigned.join(', ')})`
                                              : '';
                                            return (
                                              <Badge key={gs.gradeName} variant="outline" className="mr-1">
                                                {gs.gradeName}{sectionsStr}
                                              </Badge>
                                            );
                                          })
                                        : hasLegacyGrades
                                          ? gradeSectionsLegacy.length > 0
                                            ? gradeSectionsLegacy.map((gs: { grade: string; sections?: string[] }) => {
                                                const sectionsStr = gs.sections?.length ? ` (${gs.sections.join(', ')})` : '';
                                                return (
                                                  <Badge key={gs.grade} variant="outline" className="mr-1">
                                                    {gs.grade}{sectionsStr}
                                                  </Badge>
                                                );
                                              })
                                            : gradesLegacy.map((grade) => (
                                                <Badge key={grade} variant="outline" className="mr-1">{grade}</Badge>
                                              ))
                                          : <span className="text-muted-foreground text-sm">No grades assigned</span>}
                                    </div>
                                  </div>
                                  {(() => {
                                    const subj = (schoolAssignment as AssignedSchool).subjects ?? (schoolAssignment as TeacherSchool).subjects ?? [];
                                    if (!Array.isArray(subj) || subj.length === 0) return null;
                                    return (
                                      <div>
                                        <p className="text-sm font-medium">Subjects:</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                          {subj.map((subject) => (
                                            <Badge key={subject} variant="outline">{subject}</Badge>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  {((schoolAssignment as TeacherSchool).working_days_per_week != null || (schoolAssignment as TeacherSchool).max_students_per_session != null) && (
                                    <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                                      {(schoolAssignment as TeacherSchool).working_days_per_week != null && (
                                        <div>
                                          <p className="text-muted-foreground">Working Days:</p>
                                          <p className="font-medium">
                                            {(schoolAssignment as TeacherSchool).working_days?.length
                                              ? formatWorkingDays((schoolAssignment as TeacherSchool).working_days)
                                              : `${(schoolAssignment as TeacherSchool).working_days_per_week} days`}
                                          </p>
                                        </div>
                                      )}
                                      {(schoolAssignment as TeacherSchool).max_students_per_session != null && (
                                        <div>
                                          <p className="text-muted-foreground">Max Students/Session:</p>
                                          <p className="font-medium">{(schoolAssignment as TeacherSchool).max_students_per_session}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Work Summary */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Work Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Working Days</p>
                    <p className="text-2xl font-bold text-blue-600">{workSummary.totalWorkingDays}</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Leaves Taken</p>
                    <p className="text-2xl font-bold text-yellow-600">{workSummary.totalLeavesTaken}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Attendance Percentage</p>
                    <p className="text-2xl font-bold text-green-600">{workSummary.attendancePercentage}%</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Days Tracked</p>
                    <p className="text-2xl font-bold text-gray-600">{workSummary.totalDays}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for Calendar, Reports, and Attendance */}
            <Tabs defaultValue="calendar" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                <TabsTrigger value="reports">Daily Reports</TabsTrigger>
                <TabsTrigger value="attendance">Attendance Record</TabsTrigger>
              </TabsList>

              {/* Calendar View */}
              <TabsContent value="calendar" className="space-y-4">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle>Attendance Calendar</CardTitle>
                    <CardDescription>
                      Visual representation of teacher attendance and leaves
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-2 p-4 bg-gray-50 rounded-lg">
                      {WEEKDAY_LABELS.map((day: string) => (
                        <div key={day} className="text-center font-semibold text-sm text-gray-600 py-2">
                          {day}
                        </div>
                      ))}
                      {Array.from({ length: 30 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() + i - 15);
                        const status = getDayStatus(date);
                        return (
                          <div
                            key={i}
                            className={`aspect-square flex items-center justify-center rounded cursor-pointer transition-colors ${
                              status === 'present' ? 'bg-green-500 text-white' :
                              status === 'leave' ? 'bg-yellow-500 text-white' :
                              status === 'absent' ? 'bg-red-500 text-white' :
                              status === 'weekend' ? 'bg-gray-300 text-gray-600' :
                              'bg-white border border-gray-200 hover:bg-gray-100'
                            }`}
                            onClick={() => setSelectedDate(date)}
                            title={date.toLocaleDateString()}
                          >
                            {date.getDate()}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span>Present</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span>Leave</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span>Absent</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-300 rounded"></div>
                        <span>Weekend</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Daily Reports */}
              <TabsContent value="reports" className="space-y-4">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle>Daily Reports</CardTitle>
                    <CardDescription>
                      Activity logs and reports submitted by the teacher
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dailyReports.length > 0 ? (
                      <div className="space-y-4">
                        {dailyReports.map((report) => (
                          <div key={report.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{new Date(report.date).toLocaleDateString()}</span>
                                  {report.grade && (
                                    <Badge variant="outline">{report.grade}</Badge>
                                  )}
                                  {report.school_name && (
                                    <Badge variant="outline">{report.school_name}</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mb-2">{report.summary}</p>
                                {report.subjects && report.subjects.length > 0 && (
                                  <div className="flex gap-2">
                                    {report.subjects.map((subject) => (
                                      <Badge key={subject} variant="secondary" className="text-xs">
                                        {subject}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No daily reports available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Attendance Record */}
              <TabsContent value="attendance" className="space-y-4">
                <Card className="bg-white">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Attendance Record</CardTitle>
                        <CardDescription>
                          Detailed attendance history with dates and status
                        </CardDescription>
                      </div>
                      <Button onClick={exportAttendanceCSV} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {attendanceRecords.length > 0 ? (
                      <div className="space-y-2">
                        {attendanceRecords.map((record) => (
                          <div key={record.id} className="border rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
                                <p className="text-sm text-muted-foreground">
                                  {record.check_in_time && `Check-in: ${record.check_in_time}`}
                                  {record.check_out_time && ` | Check-out: ${record.check_out_time}`}
                                </p>
                                {record.notes && (
                                  <p className="text-sm text-gray-600 mt-1">{record.notes}</p>
                                )}
                              </div>
                            </div>
                            <Badge className={getStatusColor(record.status)}>
                              {record.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No attendance records available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

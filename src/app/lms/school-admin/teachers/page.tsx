"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SchoolAdminTeacherManagementTable,
  type SchoolAdminTeacherTableRow,
} from "@/components/ui/school-admin-teacher-management-table";
import {
  Search,
  Download,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

interface Teacher {
  id?: string;
  teacher_id: string;
  full_name: string;
  email: string;
  phone: string;
  qualification: string;
  experience_years: number;
  specialization: string;
  status: string;
  created_at?: string;
  teacher_schools: {
    grades_assigned?: string[];
    grade_sections_assigned?: string | Array<{ grade: string; sections: string[] }>;
    subjects?: string[];
    working_days_per_week?: number;
    max_students_per_session?: number;
  }[];
  attendance_percentage?: number;
  leaves_taken?: number;
}

function mapTeacherToTableRow(teacher: Teacher): SchoolAdminTeacherTableRow {
  const id = String(teacher.id ?? teacher.teacher_id ?? "");
  const nameDisplay = teacher.full_name?.trim() || "—";
  const emailDisplay = teacher.email?.trim() || "No email";
  const qualificationDisplay = teacher.qualification?.trim() || "—";
  const specializationDisplay = teacher.specialization?.trim() || "";
  const leavesCount = teacher.leaves_taken ?? 0;
  const statusLabel = teacher.status || "Active";
  return {
    id,
    nameDisplay,
    emailDisplay,
    qualificationDisplay,
    specializationDisplay,
    leavesDisplay: `${leavesCount} day${leavesCount === 1 ? "" : "s"}`,
    leavesCount,
    statusLabel,
    searchBlob: [nameDisplay, emailDisplay, qualificationDisplay, specializationDisplay, statusLabel]
      .join(" ")
      .toLowerCase(),
  };
}

interface LeaveRequest {
  id: string;
  teacher_id: string;
  school_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
  status: string;
  total_days?: number;
  substitute_required?: boolean;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  profiles: {
    id: string;
    full_name: string;
    email: string;
  };
  reviewer?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  approver?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

function TeachersContent() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [pendingLeavesCount, setPendingLeavesCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("all");
  // Controlled tab so ?tab=leaves (linked from the dashboard) actually lands on
  // the Leaves tab — the previous uncontrolled Tabs ignored the query param.
  const [activeTab, setActiveTab] = useState<"teachers" | "leaves">("teachers");

  useEffect(() => {
    // Read on mount rather than in a lazy initializer — `window` isn't available
    // during SSR, and seeding from it would cause a hydration mismatch.
    const tab = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "leaves") setActiveTab("leaves");
  }, []);

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Loading teachers for school admin...');
      
      // Parallel API calls for better performance
      const [teachersResponse, leavesResponse, pendingLeavesResponse] =
        await Promise.allSettled([
          // Explicit limit — backend defaults to 50, and this page derives its
          // own counts/filters from the full roster.
          schoolAdminApi.teachers.list({ limit: 500 }),
          schoolAdminApi.leaves.list(leaveStatusFilter === "all" ? {} : { status: leaveStatusFilter }),
          schoolAdminApi.leaves.list({ status: "Pending" }),
        ]);

      // Get school_id from school API (uses school_admins table)
      try {
        const schoolRes = await schoolAdminApi.school.get();
        const schoolData = schoolRes.data ?? {};
        const school = (schoolData as { school?: { id?: string } }).school;
        if (!school?.id) {
          setError('No school assigned to your account. Please contact support.');
          setTeachers([]);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error fetching school info:', err);
        setError('Failed to load school information. Please try again.');
        setTeachers([]);
        setLoading(false);
        return;
      }

      // Handle teachers response
      if (teachersResponse.status === 'fulfilled') {
        const result = teachersResponse.value.data ?? {};
        const teacherSchools =
          (result as { teachers?: unknown[] }).teachers ??
          (Array.isArray(result) ? result : []);
        console.log('✅ Teachers loaded from API:', teacherSchools.length);

        if (teacherSchools.length === 0) {
          console.warn('⚠️ No teachers found for this school');
          setTeachers([]);
        } else {
          // Transform the API response to match expected format
           
          // The backend returns a flat teacher object per row — id, full_name,
          // email, qualification, etc. at the top level. A legacy shape with
          // nested `teacher` / `profile` keys is handled as a fallback.
          type TeacherRow = {
            id?: string;
            teacher_id?: string;
            full_name?: string;
            email?: string;
            phone?: string;
            qualification?: string;
            experience_years?: number;
            specialization?: string;
            status?: string;
            created_at?: string;
            attendance_percentage?: number;
            leaves_taken?: number;
            teacher_schools?: { grades_assigned?: string[]; subjects?: string[]; working_days_per_week?: number; max_students_per_session?: number }[];
            // legacy nested shape
            teacher?: { id?: string; teacher_id?: string; full_name?: string; email?: string; phone?: string; qualification?: string; experience_years?: number; specialization?: string; status?: string; created_at?: string };
            profile?: { id?: string; full_name?: string; email?: string; phone?: string };
            grades_assigned?: string[];
            subjects?: string[];
            working_days_per_week?: number;
            max_students_per_session?: number;
          };
          const teachersData = teacherSchools.map((raw: TeacherRow) => {
            // Prefer flat shape; fall back to legacy nested shape.
            const nested = raw.teacher ?? {};
            const profile = raw.profile ?? {};
            return {
              id: raw.id ?? nested.id ?? profile.id,
              teacher_id: raw.teacher_id ?? nested.teacher_id ?? `TCH-${(raw.id ?? nested.id ?? '').toString().slice(0, 8) || 'UNKNOWN'}`,
              full_name: raw.full_name ?? nested.full_name ?? profile.full_name ?? '',
              email: raw.email ?? nested.email ?? profile.email ?? '',
              phone: raw.phone ?? nested.phone ?? profile.phone ?? '',
              qualification: raw.qualification ?? nested.qualification ?? '',
              experience_years: raw.experience_years ?? nested.experience_years ?? 0,
              specialization: raw.specialization ?? nested.specialization ?? '',
              status: raw.status ?? nested.status ?? 'Active',
              created_at: raw.created_at ?? nested.created_at,
              attendance_percentage: raw.attendance_percentage ?? 0,
              leaves_taken: raw.leaves_taken ?? 0,
              teacher_schools: raw.teacher_schools?.length
                ? raw.teacher_schools
                : [{
                    grades_assigned: raw.grades_assigned ?? [],
                    subjects: raw.subjects ?? [],
                    working_days_per_week: raw.working_days_per_week ?? 5,
                    max_students_per_session: raw.max_students_per_session ?? 30,
                  }],
            };
          }).filter((t) => Boolean(t.id) || Boolean(t.email));

          // Set teachers without mock stats - stats should come from database
          // If stats are needed, they should be fetched from the API
          setTeachers(teachersData as Teacher[]);
        }
      } else {
        console.error('❌ Error loading teachers from API');
        setError('Failed to load teachers');
        setTeachers([]);
      }

      // Handle leave requests response (non-blocking)
      if (leavesResponse.status === 'fulfilled') {
        const leavesResult = leavesResponse.value.data ?? {};
        const leaves =
          (leavesResult as { leaves?: LeaveRequest[] }).leaves ??
          ((Array.isArray(leavesResult) ? leavesResult : []) as LeaveRequest[]);
        
        // Debug logging to see what data we're receiving
        leaves.forEach((leave: LeaveRequest) => {
          if (leave.status === 'Approved') {
            console.log('📋 Leave approval data:', {
              leaveId: leave.id,
              status: leave.status,
              approved_by: leave.approved_by,
              approver: leave.approver ? {
                id: leave.approver.id,
                name: leave.approver.full_name,
                role: leave.approver.role
              } : null,
              reviewed_by: leave.reviewed_by,
              reviewer: leave.reviewer ? {
                id: leave.reviewer.id,
                name: leave.reviewer.full_name,
                role: leave.reviewer.role
              } : null
            });
          }
        });
        
        setLeaveRequests(leaves);
      } else {
        console.warn('⚠️ Leave requests unavailable:', leavesResponse.status === 'rejected' ? 'Network error' : 'API error');
        setLeaveRequests([]);
      }

      // Handle pending leaves count for badge (non-blocking)
      if (pendingLeavesResponse.status === 'fulfilled') {
        const pendingLeavesResult = pendingLeavesResponse.value.data ?? {};
        const pendingLeaves =
          (pendingLeavesResult as { leaves?: LeaveRequest[] }).leaves ??
          ((Array.isArray(pendingLeavesResult)
            ? pendingLeavesResult
            : []) as LeaveRequest[]);
        setPendingLeavesCount(pendingLeaves.length || 0);
      } else {
        console.warn('⚠️ Pending leaves count unavailable:', pendingLeavesResponse.status === 'rejected' ? 'Network error' : 'API error');
        setPendingLeavesCount(0);
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading teachers:', error);
       
      setError(error instanceof Error ? error.message : 'Failed to load teachers. Please try again.');
      setTeachers([]);
      setLoading(false);
    }
  }, [leaveStatusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTeachers();
  }, [loadTeachers]);

  // Note: handleAddTeacher, handleEditTeacher, and handleDeleteTeacher have been removed.
  // School admins can only view teachers - they cannot add, edit, or delete teachers.
  // Only main admins can manage teachers.

  const handleExportTeachers = () => {
    if (filteredTeachers.length === 0) {
      toast.warning('No teachers to export');
      return;
    }

    // Prepare CSV data
    const headers = ['Name', 'Email', 'Phone', 'Qualification', 'Specialization', 'Leaves Taken', 'Status'];
    const rows = filteredTeachers.map((teacher: Teacher) => [
      teacher.full_name || '',
      teacher.email || '',
      teacher.phone || '',
      teacher.qualification || '',
      teacher.specialization || '',
      teacher.leaves_taken || 0,
      teacher.status || 'Active'
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row: (string | number)[]) => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `teachers_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ Exported ${filteredTeachers.length} teacher(s) to CSV`);
  };

  const handleLeaveRequest = async (leaveId: string, action: 'approve' | 'reject') => {
    try {
      await schoolAdminApi.leaves.update(leaveId, { action });

      // Immediately update pending count (optimistic update)
      setPendingLeavesCount((prev) => Math.max(0, prev - 1));

      // Reload leave requests and teachers to refresh state
      await loadTeachers();
      toast.success(
        `Leave request ${
          action === 'approve' ? 'approved' : 'rejected'
        } successfully! Attendance has been updated automatically.`,
      );
    } catch (error) {
      console.error('Error updating leave request:', error);
      toast.error(`Error ${action === 'approve' ? 'approving' : 'rejecting'} leave request. Please try again.`);
    }
  };

  const filteredTeachers = teachers.filter((teacher: Teacher) => {
    const matchesSearch = teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || teacher.status.toLowerCase() === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const teacherTableRows = useMemo(
    () => filteredTeachers.map(mapTeacherToTableRow),
    [filteredTeachers],
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Teachers Management</h1>
        <p className="text-gray-600 mt-2">Manage teachers and track attendance</p>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Error loading teachers</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  setError(null);
                  loadTeachers();
                }}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "teachers" | "leaves")}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="leaves">
            Leave Requests
            {pendingLeavesCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingLeavesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Teachers Tab */}
        <TabsContent value="teachers" className="space-y-6">
          {/* Filters and Actions */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search teachers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {filteredTeachers.length} of {teachers.length} teachers
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportTeachers}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          {/* Teachers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Teachers List</CardTitle>
              <CardDescription>
                Manage teacher information and track performance — use column filters to narrow the list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SchoolAdminTeacherManagementTable
                rows={teacherTableRows}
                loading={loading}
                emptyMessage={
                  teachers.length === 0
                    ? "No teachers assigned to this school."
                    : "No teachers match your search or filters."
                }
                className="shadow-sm"
              />
              {!loading && filteredTeachers.length === 0 && teachers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No teachers assigned to this school</p>
                  <p className="text-sm mt-2">
                    Teachers need to be created and assigned to your school by the main administrator.
                  </p>
                  <p className="text-xs mt-1 text-gray-400">
                    If you believe this is an error, please contact support.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Requests Tab */}
        <TabsContent value="leaves" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Leave Requests</CardTitle>
                  <CardDescription>Review and approve teacher leave applications</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={leaveStatusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLeaveStatusFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={leaveStatusFilter === 'Pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLeaveStatusFilter('Pending')}
                  >
                    Pending
                  </Button>
                  <Button
                    variant={leaveStatusFilter === 'Approved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLeaveStatusFilter('Approved')}
                  >
                    Approved
                  </Button>
                  <Button
                    variant={leaveStatusFilter === 'Rejected' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLeaveStatusFilter('Rejected')}
                  >
                    Rejected
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {leaveRequests.length > 0 ? (
                <div className="space-y-4">
                  {leaveRequests.map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <Clock className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{leave.profiles?.full_name || 'Unknown Teacher'}</div>
                          <div className="text-sm text-gray-500">{leave.profiles?.email || ''}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Type:</span> {leave.leave_type || 'Personal'} • {' '}
                            <span className="font-medium">Dates:</span> {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()} ({leave.total_days || 0} days)
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Reason:</span> {leave.reason}
                          </div>
                          {leave.substitute_required && (
                            <Badge variant="outline" className="mt-1 text-xs">Substitute Required</Badge>
                          )}
                          {(leave.status === 'Approved' || leave.status === 'Rejected') && (
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">
                                {leave.status === 'Approved' ? 'Approved by:' : 'Reviewed by:'}
                              </span>{' '}
                              <span className="text-gray-700">
                                {(() => {
                                  // For approved leaves, prioritize approver, fallback to reviewer
                                  if (leave.status === 'Approved') {
                                    if (leave.approver?.full_name) {
                                      return `${leave.approver.full_name}${leave.approver.role ? ` (${leave.approver.role})` : ''}`;
                                    } else if (leave.reviewer?.full_name) {
                                      return `${leave.reviewer.full_name}${leave.reviewer.role ? ` (${leave.reviewer.role})` : ''}`;
                                    }
                                  } else {
                                    // For rejected leaves, show reviewer
                                    if (leave.reviewer?.full_name) {
                                      return `${leave.reviewer.full_name}${leave.reviewer.role ? ` (${leave.reviewer.role})` : ''}`;
                                    }
                                  }
                                  return 'N/A';
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {leave.status === 'Pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleLeaveRequest(leave.id, 'approve')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleLeaveRequest(leave.id, 'reject')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {leave.status === 'Approved' && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {leave.status === 'Rejected' && (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                        {leave.reviewed_at && (
                          <div className="text-xs text-gray-500 ml-2">
                            {new Date(leave.reviewed_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium">No pending leave requests</p>
                  <p className="text-sm">All leave requests have been processed</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Teacher Dialog removed - school admins cannot edit teachers */}
    </div>
  );
}

export default function TeachersManagement() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <TeachersContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { frontendLogger, handleApiErrorResponse } from "@/lib/frontend-logger";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData } from "@/lib/form-persistence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { 
  Label 
} from "@/components/ui/label";
import { 
  Textarea 
} from "@/components/ui/textarea";
import AddTeacherDialog from "@/components/AddTeacherDialog";
import WeekdayPicker from "@/components/WeekdayPicker";
import WorkingDaysHistoryPanel from "@/components/admin/WorkingDaysHistoryPanel";
import { formatWorkingDays } from "@/lib/weekday-utils";
import TeacherProfileView from "@/components/TeacherProfileView";
import { NotificationPanel, useNotifications } from "@/components/NotificationPanel";
import { 
  Users, 
  School, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Shield,
  Plus,
  Briefcase,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  TeacherManagementTable,
  type TeacherManagementRow,
} from "@/components/ui/teacher-management-table";

/** Grade with sections (new API shape) */
interface GradeAssigned {
  gradeName: string;
  sectionsAssigned: string[];
}

/** Section assigned to another teacher (API: section, teacherName) */
interface SectionAssignedToOther {
  section?: string;
  teacherName?: string;
  sectionName?: string;
  assignedToTeacherName?: string;
}

/** Assigned school (new API shape) */
interface AssignedSchool {
  schoolId: string;
  schoolName: string;
  gradesAssigned: GradeAssigned[];
  subjects?: string[];
  /** Which weekdays this teacher works at this school — 0=Sun..6=Sat. */
  workingDays?: number[];
  assignedFrom?: string | null;
  assignedUntil?: string | null;
  sectionsAssignedToOtherTeachers?: SectionAssignedToOther[];
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
  tenantId?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  temp_password?: string;
  teacher_schools?: TeacherSchool[];
  assignedSchools?: AssignedSchool[];
}

interface TeacherSchool {
  id?: string;
  teacher_id?: string;
  school_id: string;
  schoolId?: string;
  grades_assigned?: string[];
  grade_sections_assigned?: Array<{ grade: string; sections: string[] }>;
  gradesAssigned?: GradeAssigned[];
  subjects?: string[];
  working_days_per_week?: number;
  /** Which weekdays this teacher works at this school — 0=Sun..6=Sat. */
  working_days?: number[];
  /** When this working-days pattern takes effect (YYYY-MM-DD). */
  effective_from?: string;
  /** Calendar date the teacher's assignment to this school begins (YYYY-MM-DD). Optional. */
  assigned_from?: string;
  /** Calendar date the teacher's assignment to this school ends (YYYY-MM-DD). Optional — blank means ongoing. */
  assigned_until?: string;
  max_students_per_session?: number;
  is_primary?: boolean;
  schoolName?: string;
  sectionsAssignedToOtherTeachers?: SectionAssignedToOther[];
  schools?: {
    id: string;
    name: string;
    school_code: string;
  };
}

interface School {
  id: string;
  name: string;
  school_code: string;
  city?: string;
  state?: string;
  grades_offered?: string[];
  gradesOffered?: string[];
  grades?: { id: string; name: string; sections?: { id: string; name: string }[] }[];
  number_of_sections?: number;
  /** Which weekdays the school holds classes — 0=Sun..6=Sat. Constrains a teacher's working-days picker for this school. */
  operatingDays?: number[];
  operating_days?: number[];
}

interface LeaveRequest {
  id: string;
  teacher_id: string;
  school_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  applied_at?: string;
  approved_at?: string;
  rejected_at?: string;
  approved_by?: string;
  reviewer?: { id: string; full_name: string; email: string } | null;
  substitute_required?: boolean;
  admin_remarks?: string;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
  };
  schools?: {
    id: string;
    name: string;
    school_code: string;
  };
}

interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentApprovedDays: number;
  absentUnapprovedDays: number;
  attendanceRate: number;
  /** Real month-to-date average across active teachers (see AdminTeacherAttendanceService.list) — unlike attendanceRate (today's snapshot), this doesn't read 0% just because today hasn't been marked yet. */
  averageAttendanceRate?: number;
  presentToday?: number;
  absentToday?: number;
  onLeaveToday?: number;
  onHolidayToday?: number;
  totalTeachers?: number;
  teacherTodayStatus?: Record<string, { status: string; isOnLeave: boolean; leaveType?: string; attendanceRate?: number }>;
  /** Only present for teachers scheduled at 2+ schools the same day — see getStatusBadge below. */
  teacherTodaySchoolStatuses?: Record<string, Array<{ school_id: string; school_name: string; status: string }>>;
}

interface MonthlyAttendanceData {
  id: string;
  teacher_id: string;
  /** Legacy key used in some table rows */
  teacherId?: string;
  school_id?: string;
  month: string;
  year?: number;
  month_number?: number;
  month_name?: string;
  present_days: number;
  absent_days: number;
  leave_days: number;
  unreported_days: number;
  total_working_days: number;
  /** Legacy monthly endpoint field */
  total_days?: number;
  attendance_percentage: number;
  profiles?: { full_name: string; email: string };
  schools?: { name: string; school_code: string };
  /** Present only when unfiltered and the teacher works at >1 school. */
  by_school?: Array<{
    school_id: string;
    school_name: string;
    working_days?: number[];
    present_days: number;
    absent_days: number;
    leave_days: number;
    unreported_days: number;
    total_working_days: number;
    attendance_percentage: number;
  }>;
}

/** Normalized school assignment row for table display (API may use old or new shape). */
interface SchoolAssignmentRow {
  schoolId?: string;
  school_id?: string;
  schoolName?: string;
  schools?: { id?: string; name?: string };
  gradesAssigned?: GradeAssigned[];
  grade_sections_assigned?: Array<{ grade: string; sections: string[] }>;
  grades_assigned?: string[];
  sectionsAssignedToOtherTeachers?: SectionAssignedToOther[];
  subjects?: string[];
}

interface Stats {
  totalTeachers: number;
  activeTeachers: number;
  pendingLeaves: number;
  averageAttendance: number;
}

type TeacherTableRow = Omit<Teacher, "id"> & TeacherManagementRow;

function buildSchoolsSearchText(teacher: Teacher): string {
  const schools = teacher.assignedSchools ?? teacher.teacher_schools ?? [];
  const parts: string[] = [];
  for (const raw of schools) {
    const school = raw as SchoolAssignmentRow;
    parts.push(school.schoolName ?? school.schools?.name ?? "");
    const gradesAssigned =
      school.gradesAssigned ??
      (school.grade_sections_assigned && Array.isArray(school.grade_sections_assigned)
        ? school.grade_sections_assigned
        : []);
    const subjectsList = school.subjects ?? [];
    if (Array.isArray(subjectsList)) {
      parts.push(...subjectsList.map(String));
    }
    if (Array.isArray(gradesAssigned)) {
      for (const gs of gradesAssigned) {
        const row = gs as {
          gradeName?: string;
          grade?: string;
          sectionsAssigned?: string[];
          sections?: string[];
        };
        parts.push(row.gradeName ?? row.grade ?? "");
        const secs = row.sectionsAssigned ?? row.sections ?? [];
        parts.push(...secs.map(String));
      }
    }
    const assignedElsewhere = school.sectionsAssignedToOtherTeachers ?? [];
    for (const o of assignedElsewhere) {
      parts.push(o.section ?? o.sectionName ?? "", o.teacherName ?? o.assignedToTeacherName ?? "");
    }
  }
  return parts.join(" ").toLowerCase();
}

function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function mapTeacherToTableRow(teacher: Teacher): TeacherTableRow {
  const id = String(teacher.id);
  const nameDisplay = teacher.name ?? teacher.full_name ?? "—";
  const experienceDisplay =
    teacher.experience ??
    (teacher.experience_years != null ? `${teacher.experience_years} years` : "N/A");
  return {
    ...teacher,
    id,
    nameDisplay,
    email: teacher.email,
    phoneDisplay: teacher.phone ?? "N/A",
    qualificationDisplay: teacher.qualification ?? "N/A",
    experienceDisplay,
    status: teacher.status,
    roleDisplay: teacher.role ?? "teacher",
    schoolsSearchText: buildSchoolsSearchText(teacher),
  };
}

function renderTeacherSchoolsCell(teacher: TeacherTableRow) {
  const rawSchools = teacher.assignedSchools ?? teacher.teacher_schools ?? [];
  if ((rawSchools?.length ?? 0) === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400 italic">
        No schools assigned
      </span>
    );
  }
  return (
    <div className="space-y-2">
      {rawSchools.map((rawSchool, index) => {
        const school = rawSchool as SchoolAssignmentRow;
        const schoolKey = school.schoolId ?? school.school_id ?? (school.schools?.id ?? index);
        const schoolName = school.schoolName ?? school.schools?.name ?? "School";
        const gradesAssigned: Array<{
          gradeName?: string; grade?: string;
          sectionsAssigned?: string[]; sections?: string[];
        }> =
          school.gradesAssigned ??
          (Array.isArray(school.grade_sections_assigned) ? school.grade_sections_assigned : []);
        const gradeCount = gradesAssigned.length || (Array.isArray(school.grades_assigned) ? school.grades_assigned.length : 0);

        // Collect all sections from all grades
        const allSections: string[] = [];
        gradesAssigned.forEach((gs) => {
          (gs.sectionsAssigned ?? gs.sections ?? []).forEach((s) => allSections.push(s));
        });

        const subjectsList = school.subjects ?? [];
        const subjectsStr =
          Array.isArray(subjectsList) && subjectsList.length > 0
            ? subjectsList.join(", ")
            : null;

        // Build tooltip text with full grade/section detail
        const gradeDetail =
          gradesAssigned.length > 0
            ? gradesAssigned
                .map((gs) => {
                  const name = gs.gradeName ?? gs.grade ?? "";
                  const secs = gs.sectionsAssigned ?? gs.sections ?? [];
                  return secs.length > 0 ? `${name} (${secs.join(", ")})` : name;
                })
                .join(" · ")
            : Array.isArray(school.grades_assigned)
            ? (school.grades_assigned as string[]).join(", ")
            : "";

        return (
          <div key={String(schoolKey)} className="group">
            {/* School name chip */}
            <div className="flex items-start gap-1.5">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-5 w-5 rounded bg-indigo-100 flex items-center justify-center">
                  <School className="h-3 w-3 text-indigo-600" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{schoolName}</p>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {gradeCount > 0 && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100 cursor-default"
                      title={gradeDetail || undefined}
                    >
                      {gradeCount} grade{gradeCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {allSections.length > 0 && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100 cursor-default"
                      title={allSections.join(", ")}
                    >
                      {allSections.length} section{allSections.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {subjectsStr && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100 cursor-default"
                      title={subjectsStr}
                    >
                      {subjectsList.length} subject{subjectsList.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TeachersManagement() {
  // State management
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const { schools, refetch: refetchSchools } = useAdminSchools();
  const [configuringGradesForSchoolId, setConfiguringGradesForSchoolId] = useState<string | null>(null);
  // Collapsed by default — the grades/sections checklist can be long, and
  // most edits only touch one assignment at a time. Keyed by assignment
  // id/index so each school assignment card expands independently.
  const [expandedGradesAssignments, setExpandedGradesAssignments] = useState<Set<string>>(new Set());
  const [assignmentsBySchoolId, setAssignmentsBySchoolId] = useState<Record<string, { sectionId: string; teacherName: string }[]>>({});
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [monthlyAttendance, setMonthlyAttendance] = useState<MonthlyAttendanceData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  // "all" = combined across every school a teacher works at (default);
  // a specific school_id scopes every figure to just that school — teachers
  // who work 1-3 schools a week need both views (see attendance calendar plan).
  const [attendanceSchoolFilter, setAttendanceSchoolFilter] = useState<string>('all');
  const [expandedAttendanceRows, setExpandedAttendanceRows] = useState<Set<string>>(new Set());
  const [markingMissingAttendance, setMarkingMissingAttendance] = useState(false);
  const [activeTab, setActiveTab] = useState<'teachers' | 'attendance' | 'leaves'>('teachers');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Deep-link support: ?tab=leaves (used by the admin dashboard's "pending
  // leave requests" alert) or ?tab=attendance opens that tab directly.
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'leaves' || tab === 'attendance' || tab === 'teachers') {
      setActiveTab(tab);
      router.replace('/lms/admin/teachers');
    }
  }, [searchParams, router]);
  const [bulkDeleteTeachers, setBulkDeleteTeachers] = useState<TeacherTableRow[] | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeletingTeachers, setIsBulkDeletingTeachers] = useState(false);
  const [bulkSelectionResetKey, setBulkSelectionResetKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [_lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showProfileView, setShowProfileView] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [profileRefreshTrigger, setProfileRefreshTrigger] = useState(0);
  const [leaveRefreshTrigger, _setLeaveRefreshTrigger] = useState(0);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Notification system
  const { notifications, addNotification, markAsRead, dismiss } = useNotifications();

  // Form data - default initial state; load from storage in useEffect to avoid setState during render
  const defaultFormData = {
    full_name: "",
    email: "",
    phone: "",
    address: "",
    qualification: "",
    experience_years: 0,
    specialization: "",
    school_assignments: [] as TeacherSchool[],
    temp_password: ""
  };

  const [formData, setFormData] = useState(defaultFormData);

  // Load persisted form data on mount (deferred to avoid updating parent/store during render)
  useEffect(() => {
    const saved = loadFormData<{
      full_name: string;
      email: string;
      phone: string;
      address: string;
      qualification: string;
      experience_years: number;
      specialization: string;
      school_assignments: TeacherSchool[];
      temp_password: string;
    }>('admin-teachers-form');
    if (saved) setFormData(saved);
  }, []);

  useEffect(() => {
    if (!editingTeacher) return;
    formData.school_assignments.forEach((a: { school_id?: string }) => {
      const schoolId = a.school_id;
      if (!schoolId || assignmentsBySchoolId[schoolId]) return;
      adminApi.schools.getTeacherAssignments(schoolId)
        .then((res) => {
          const data = res.data as { assignments?: { sectionId: string; teacherName: string }[] };
          setAssignmentsBySchoolId((prev) => ({ ...prev, [schoolId]: data.assignments ?? [] }));
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTeacher?.id, formData.school_assignments.map((a: { school_id?: string }) => a.school_id).filter(Boolean).join(',')]);

  // Auto-save form data
  const { isDirty: isFormDirty } = useAutoSaveForm({
    formId: 'admin-teachers-form',
    formData,
    autoSave: true,
    autoSaveInterval: 3000,
    debounceDelay: 800,
    useSession: false,
    onLoad: (data) => {
      setFormData(data);
    },
  });

  // Auto-save teacher form data
  useAutoSaveForm({
    formId: 'admin-teachers-form',
    formData,
    autoSaveInterval: 3000,
    debounceDelay: 800,
    useSession: false,
    onLoad: (data) => {
      // Only load if form is empty (to avoid overwriting user input)
      if (!formData.full_name && !formData.email) {
        setFormData(data);
      }
    },
    markDirty: true,
  });

  const [leaveFormData, setLeaveFormData] = useState({
    status: "",
    admin_remarks: ""
  });
  
  // Auto-save leave form data
  useAutoSaveForm({
    formId: 'admin-leave-form',
    formData: leaveFormData,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: false,
    onLoad: (data) => {
      if (!leaveFormData.status) {
        setLeaveFormData(data);
      }
    },
    markDirty: true,
  });

  const [_showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [customSubjectInputs, setCustomSubjectInputs] = useState<Record<string, string>>({});
  const availableSubjects = ['Robotics', 'Coding', 'AI/ML', 'Python'];
  const [stats, setStats] = useState<Stats>({
    totalTeachers: 0,
    activeTeachers: 0,
    pendingLeaves: 0,
    averageAttendance: 0
  });

  // Update statistics
  // IMPORTANT: Use allLeaveRequests (not filtered leaveRequests) for accurate pending count
  const updateStats = useCallback((teachersData: Teacher[], leavesData: LeaveRequest[] = allLeaveRequests, attendanceData: AttendanceSummary | null = attendanceSummary) => {
    const active = teachersData.filter((t: Teacher) => (t.status === 'Active' || t.status === 'active')).length;
    const pendingLeaves = leavesData.filter((leave: LeaveRequest) => leave.status === 'Pending').length;
    
    setStats({
      totalTeachers: teachersData.length,
      activeTeachers: active,
      pendingLeaves: pendingLeaves,
      averageAttendance: attendanceData?.averageAttendanceRate ?? attendanceData?.attendanceRate ?? 0
    });
  }, [allLeaveRequests, attendanceSummary]);

  // Sync leaveRequests with allLeaveRequests based on current filter
  useEffect(() => {
    if (leaveStatusFilter === 'all') {
      setLeaveRequests(allLeaveRequests);
    } else {
      setLeaveRequests(allLeaveRequests.filter((leave: LeaveRequest) => leave.status === leaveStatusFilter));
    }
  }, [allLeaveRequests, leaveStatusFilter]);

  // Force refresh when leaveRefreshTrigger changes
  useEffect(() => {
    if (leaveRefreshTrigger > 0) {
      // Re-sync leaveRequests with current filter
      if (leaveStatusFilter === 'all') {
        setLeaveRequests(allLeaveRequests);
    } else {
        setLeaveRequests(allLeaveRequests.filter((leave: LeaveRequest) => leave.status === leaveStatusFilter));
      }
    }
  }, [leaveRefreshTrigger, allLeaveRequests, leaveStatusFilter]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    setLastRefresh(new Date());
    await loadAllData();
    setRefreshing(false);
  };

  // Helper function for fetch with timeout (using frontendLogger)
  const _fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
    frontendLogger.debug('API request initiated', {
      component: 'TeachersManagement',
      url,
      method: options.method || 'GET',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        frontendLogger.error('API request failed', {
          component: 'TeachersManagement',
          url,
          status: response.status,
          error: errorData,
        });
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      frontendLogger.debug('API request succeeded', {
        component: 'TeachersManagement',
        url,
        status: response.status,
      });
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        frontendLogger.error('Request timeout', {
          component: 'TeachersManagement',
          url,
          timeout,
        }, error);
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      frontendLogger.error('API request exception', {
        component: 'TeachersManagement',
        url,
      }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  // Load teachers
  const loadTeachers = useCallback(async () => {
    try {
      frontendLogger.info('Loading teachers', {
        component: 'TeachersManagement',
        action: 'loadTeachers',
      });

      const { data } = await adminApi.teachers.list();
      const teachersArray = Array.isArray(data?.data)
        ? data.data
        : (data?.teachers || data || []);
      
      frontendLogger.info('Teachers loaded successfully', {
        component: 'TeachersManagement',
        action: 'loadTeachers',
        count: teachersArray.length,
      });
      
      setTeachers(teachersArray);

      if (teachersArray.length === 0) {
        frontendLogger.warn('No teachers found in response', {
          component: 'TeachersManagement',
          action: 'loadTeachers',
        });
      }
    } catch (error) {
      const _errorInfo = handleApiErrorResponse(error, {
        component: 'TeachersManagement',
        action: 'loadTeachers',
      }, 'Failed to load teachers');
      
      frontendLogger.error('Error loading teachers', {
        component: 'TeachersManagement',
        action: 'loadTeachers',
      }, error instanceof Error ? error : new Error(String(error)));
      
      // Set empty array on error to prevent infinite loading
      setTeachers([]);
    }
  }, []);

  // Load leave requests
  const loadLeaveRequests = useCallback(async () => {
    try {
      frontendLogger.debug('Loading leave requests', {
        component: 'TeachersManagement',
        action: 'loadLeaveRequests',
      });

      const { data } = await adminApi.leaves.list();
      const rawLeaves = data?.leaves ?? data;
      const allLeaves = Array.isArray(rawLeaves) ? rawLeaves : [];
      
      frontendLogger.info('Leave requests loaded successfully', {
        component: 'TeachersManagement',
        action: 'loadLeaveRequests',
        count: allLeaves.length,
      });

      setAllLeaveRequests(allLeaves);
      
      // Filter based on current status filter
      if (leaveStatusFilter === 'all') {
        setLeaveRequests(allLeaves);
      } else {
        setLeaveRequests(allLeaves.filter((leave: LeaveRequest) => leave.status === leaveStatusFilter));
      }
    } catch (error) {
      const _errorInfo = handleApiErrorResponse(error, {
        component: 'TeachersManagement',
        action: 'loadLeaveRequests',
      }, 'Failed to load leave requests');
      
      frontendLogger.error('Error loading leave requests', {
        component: 'TeachersManagement',
        action: 'loadLeaveRequests',
      }, error instanceof Error ? error : new Error(String(error)));
      
      setAllLeaveRequests([]);
      setLeaveRequests([]);
    }
  }, [leaveStatusFilter]);

  // Filter leave requests by status
  const filterLeaveRequests = (status: 'all' | 'Pending' | 'Approved' | 'Rejected') => {
    setLeaveStatusFilter(status);
    if (status === 'all') {
      setLeaveRequests(allLeaveRequests);
    } else {
      interface LeaveRequest {
        id?: string;
        status?: string;
      }
      
      setLeaveRequests(allLeaveRequests.filter((leave: LeaveRequest) => leave.status === status));
    }
  };

  // Load monthly attendance data
  const loadMonthlyAttendance = useCallback(async (month?: string, schoolIdOverride?: string) => {
    try {
      setMonthlyLoading(true);
      const monthToLoad = month || selectedMonth;
      const schoolIdToLoad = schoolIdOverride ?? attendanceSchoolFilter;
      const { data } = await adminApi.teacherAttendance.monthly({
        month: monthToLoad,
        school_id: schoolIdToLoad !== 'all' ? schoolIdToLoad : undefined,
      });
      setMonthlyAttendance(data.monthlyData || data || []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load monthly attendance';
      toast.error(msg);
      setMonthlyAttendance([]);
    } finally {
      setMonthlyLoading(false);
    }
  }, [selectedMonth, attendanceSchoolFilter]);

  // Mark missing attendance
  const markMissingAttendance = useCallback(async () => {
    try {
      setMarkingMissingAttendance(true);
      
      // Get date range for the selected month
      const monthDate = new Date(`${selectedMonth}-01`);
      const monthStart = monthDate.toISOString().split('T')[0];
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data } = await adminApi.teacherAttendance.markMissing({
        start_date: monthStart,
        end_date: monthEnd,
      });
      
      toast.success(
        `Marked missing attendance: ${data.summary?.records_created ?? 0} records, ${data.summary?.teachers_affected ?? 0} teachers, ${data.summary?.dates_affected ?? 0} dates.`,
      );
      
      // Reload monthly attendance to show updated data
      await loadMonthlyAttendance();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to mark missing attendance: ${msg}`);
    } finally {
      setMarkingMissingAttendance(false);
    }
  }, [selectedMonth, loadMonthlyAttendance]);

  // Load attendance data
  const loadAttendanceData = useCallback(async () => {
    try {
      frontendLogger.debug('Loading attendance data', {
        component: 'TeachersManagement',
        action: 'loadAttendanceData',
      });
      
      const { data } = await adminApi.teacherAttendance.list();
      
      frontendLogger.info('Attendance data loaded successfully', {
        component: 'TeachersManagement',
        action: 'loadAttendanceData',
        hasSummary: !!data.summary,
        attendanceCount: data.attendance?.length || 0
      });

      // API returns { summary, teacherTodayStatus, attendance } — must merge
      // summary + per-teacher map; storing only `data.summary` drops teacherTodayStatus
      // and breaks the Today's Attendance table.
      const root = data as Record<string, unknown>;
      const body =
        root.data && typeof root.data === 'object'
          ? (root.data as Record<string, unknown>)
          : root;
      const sum = (body.summary ?? {}) as AttendanceSummary;
      const teacherTodayStatus =
        (body.teacherTodayStatus ?? {}) as AttendanceSummary['teacherTodayStatus'];
      const teacherTodaySchoolStatuses =
        (body.teacherTodaySchoolStatuses ?? {}) as AttendanceSummary['teacherTodaySchoolStatuses'];

      setAttendanceSummary({
        totalDays: sum.totalDays ?? 0,
        presentDays: sum.presentDays ?? 0,
        absentApprovedDays: sum.absentApprovedDays ?? 0,
        absentUnapprovedDays: sum.absentUnapprovedDays ?? 0,
        attendanceRate: sum.attendanceRate ?? 0,
        averageAttendanceRate: sum.averageAttendanceRate ?? 0,
        presentToday: sum.presentToday ?? 0,
        absentToday: sum.absentToday ?? 0,
        onLeaveToday: sum.onLeaveToday ?? 0,
        totalTeachers: sum.totalTeachers ?? 0,
        teacherTodayStatus,
        teacherTodaySchoolStatuses,
      });
    } catch (error) {
      const _errorInfo = handleApiErrorResponse(error, {
        component: 'TeachersManagement',
        action: 'loadAttendanceData',
      }, 'Failed to load attendance data');
      
      frontendLogger.error('Error loading attendance data', {
        component: 'TeachersManagement',
        action: 'loadAttendanceData',
      }, error instanceof Error ? error : new Error(String(error)));
      
      // Set a default summary so UI can still render
      // Use current teachers state or fallback to 0
      const teacherCount = teachers.length || 0;
      setAttendanceSummary({
        totalDays: 0,
        presentDays: 0,
        absentApprovedDays: 0,
        absentUnapprovedDays: 0,
        attendanceRate: 0,
        presentToday: 0,
        absentToday: 0,
        onLeaveToday: 0,
        totalTeachers: teacherCount,
        teacherTodayStatus: {},
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- teachers.length intentionally excluded to avoid unnecessary recalc
  }, []);


  // Main data loading function with retry mechanism and safety timeout
  const loadAllData = useCallback(async (retryCount = 0) => {
    frontendLogger.info('Starting to load all data', {
      component: 'TeachersManagement',
      action: 'loadAllData',
      attempt: retryCount + 1,
    });
    
    setLoading(true);
    
    // Safety timeout: Always stop loading after 15 seconds
    const safetyTimeout = setTimeout(() => {
      frontendLogger.warn('Safety timeout reached', {
        component: 'TeachersManagement',
        action: 'loadAllData',
      });
      setLoading(false);
    }, 15000);
    
    try {
      // Load data with Promise.allSettled to handle partial failures
      const results = await Promise.allSettled([
        loadTeachers(),
        loadLeaveRequests(),
        loadAttendanceData()
      ]);
      
      // Check if all succeeded
      const allSucceeded = results.every((result: PromiseSettledResult<unknown>) => result.status === 'fulfilled');
      
      if (allSucceeded) {
        frontendLogger.info('All data loaded successfully', {
          component: 'TeachersManagement',
          action: 'loadAllData',
        });
      } else {
        const failed = results.filter((r: PromiseSettledResult<unknown>) => r.status === 'rejected');
        frontendLogger.warn('Some data failed to load', {
          component: 'TeachersManagement',
          action: 'loadAllData',
          failedCount: failed.length,
          totalCount: results.length,
        });
      }
      
      clearTimeout(safetyTimeout);
      setLoading(false);
    } catch (error) {
      frontendLogger.error('Error loading data', {
        component: 'TeachersManagement',
        action: 'loadAllData',
        attempt: retryCount + 1,
      }, error instanceof Error ? error : new Error(String(error)));
      
      clearTimeout(safetyTimeout);
      
      // Retry up to 1 time with delay, then give up
      if (retryCount < 1) {
        const delay = 2000; // 2 seconds
        frontendLogger.info('Retrying data load', {
          component: 'TeachersManagement',
          action: 'loadAllData',
          delay,
          nextAttempt: retryCount + 2,
        });
        
        setTimeout(() => {
          loadAllData(retryCount + 1);
        }, delay);
        return;
      }
      
      frontendLogger.error('Max retries reached', {
        component: 'TeachersManagement',
        action: 'loadAllData',
      });
      setLoading(false);
    }
  }, [loadTeachers, loadLeaveRequests, loadAttendanceData]);

  // Load all data on mount (only once)
  useEffect(() => {
    loadAllData(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: () => loadAllData(0),
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
    hasUnsavedData: () => {
      // Check if any dialog is open (indicating unsaved changes)
      // Also check if forms have unsaved data via Zustand store
      return showAddDialog || showEditDialog || showLeaveDialog || isFormDirty;
    },
  });

  // Update stats when data changes
  useEffect(() => {
    // Always update stats when data changes, even if arrays are empty
    updateStats(teachers, allLeaveRequests, attendanceSummary);
  }, [teachers, allLeaveRequests, attendanceSummary, updateStats]);

  // Load monthly attendance when attendance tab is active
  useEffect(() => {
    if (activeTab === 'attendance') {
      loadMonthlyAttendance();
    }
  }, [activeTab, loadMonthlyAttendance]);

  const teacherTableRows = useMemo(
    () => teachers.map(mapTeacherToTableRow),
    [teachers],
  );

  // Handle view teacher profile
  const handleViewTeacherProfile = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowProfileView(true);
  };

  // Handle edit teacher
  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    const sources = teacher.assignedSchools ?? teacher.teacher_schools ?? [];
    // Clear cached assignments for this teacher's schools so we refetch fresh data (e.g. after an update)
    const schoolIds = sources.map((s: AssignedSchool | TeacherSchool) => s.schoolId ?? (s as TeacherSchool).school_id).filter(Boolean);
    setAssignmentsBySchoolId((prev) => {
      const next = { ...prev };
      schoolIds.forEach((id: string) => delete next[id]);
      return next;
    });

    const schoolAssignments = sources.map((assignment: TeacherSchool | AssignedSchool, i: number) => {
      const isNewShape = 'gradesAssigned' in assignment && Array.isArray(assignment.gradesAssigned);
      if (isNewShape) {
        const a = assignment as AssignedSchool;
        return {
          id: `assignment-${Date.now()}-${i}`,
          teacher_id: String(teacher.id),
          school_id: a.schoolId,
          school_name: a.schoolName,
          grades_assigned: a.gradesAssigned?.map((g) => g.gradeName) ?? [],
          grade_sections_assigned: a.gradesAssigned?.map((g) => ({ grade: g.gradeName, sections: g.sectionsAssigned ?? [] })) ?? [],
          subjects: Array.isArray(a.subjects) ? a.subjects : [],
          working_days: a.workingDays?.length ? a.workingDays : [1, 2, 3, 4, 5],
          working_days_per_week: a.workingDays?.length ? a.workingDays.length : 5,
          effective_from: todayStr(),
          assigned_from: a.assignedFrom ?? "",
          assigned_until: a.assignedUntil ?? "",
          max_students_per_session: 30,
          is_primary: i === 0,
        };
      }
      const t = assignment as TeacherSchool;
      const workingDays = t.working_days?.length ? t.working_days : [1, 2, 3, 4, 5];
      return {
        id: t.id || `assignment-${Date.now()}-${i}`,
        teacher_id: t.teacher_id ?? String(teacher.id),
        school_id: t.school_id ?? t.schoolId ?? '',
        grades_assigned: Array.isArray(t.grades_assigned) ? t.grades_assigned : [],
        grade_sections_assigned: Array.isArray(t.grade_sections_assigned) ? t.grade_sections_assigned : [],
        subjects: Array.isArray(t.subjects) ? t.subjects : [],
        working_days: workingDays,
        working_days_per_week: t.working_days_per_week ?? workingDays.length,
        effective_from: todayStr(),
        assigned_from: t.assigned_from ?? "",
        assigned_until: t.assigned_until ?? "",
        max_students_per_session: t.max_students_per_session ?? 30,
        is_primary: t.is_primary ?? false,
      };
    });

    const expYears = teacher.experience_years ?? (teacher.experience ? parseInt(teacher.experience, 10) : undefined);
    const experienceYears =
      expYears !== undefined && Number.isFinite(expYears) ? expYears : 0;
    setFormData({
      full_name: teacher.name ?? teacher.full_name ?? '',
      email: teacher.email,
      phone: teacher.phone ?? '',
      address: '',
      qualification: teacher.qualification ?? '',
      experience_years: experienceYears,
      specialization: teacher.specialization ?? '',
      school_assignments: schoolAssignments,
      temp_password: teacher.temp_password ?? '',
    });
    setShowPassword(false);
    setNewPassword(""); // Reset new password
    setShowNewPassword(false); // Reset new password visibility
    setCustomSubjectInputs({}); // Reset custom subject inputs
    setShowEditDialog(true);
  };

  // Handle change password
  const handleChangePassword = async () => {
    if (!editingTeacher) return;

    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    
    // Validate password strength (8+ chars, uppercase, lowercase, number)
    const { validatePasswordClient } = await import('@/lib/password-validation');
    const passwordError = validatePasswordClient(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (!(await confirmDialog({
      title: 'Change password?',
      description: `Change the password for "${editingTeacher.name ?? editingTeacher.full_name}". They will need to use the new password to log in.`,
      confirmText: 'Change Password',
    }))) {
      return;
    }

    try {
      setActionLoading('change-password');
      await adminApi.teachers.update(String(editingTeacher.id), {
        temp_password: newPassword,
        change_password: true,
      });

      toast.success(
        `Password changed for "${editingTeacher.name ?? editingTeacher.full_name}". Share the new password securely with the teacher.`,
      );
      setNewPassword("");
      setShowNewPassword(false);
      loadAllData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error changing password: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Generate new password
  const generateNewPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  // Copy new password to clipboard
  const copyNewPassword = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success('Password copied to clipboard');
    } catch {
      toast.error('Failed to copy password');
    }
  };

  // Handle update teacher
  const handleUpdateTeacher = async () => {
    if (!editingTeacher) return;

    // Validation: Check if at least one school and one grade are assigned
    interface SchoolAssignment {
      school_id?: string;
      grades_assigned?: string[];
      assigned_from?: string;
      assigned_until?: string;
      working_days?: number[];
    }

    const hasValidAssignments = formData.school_assignments.some((assignment: SchoolAssignment) =>
      assignment.school_id && (assignment.grades_assigned?.length ?? 0) > 0
    );

    if (!hasValidAssignments) {
      toast.error('Please assign at least one school and one grade before saving.');
      return;
    }

    const badDateRange = formData.school_assignments.find(
      (assignment: SchoolAssignment) =>
        assignment.assigned_from &&
        assignment.assigned_until &&
        assignment.assigned_until < assignment.assigned_from,
    );
    if (badDateRange) {
      toast.error('"Assigned Until" must not be before "Assigned From" for one of the school assignments.');
      return;
    }

    const badWorkingDays = formData.school_assignments.find((assignment: SchoolAssignment) => {
      const school = schools.find((s) => s.id === assignment.school_id);
      const operatingDays = school?.operatingDays;
      if (!operatingDays || !assignment.working_days) return false;
      return assignment.working_days.some((d) => !operatingDays.includes(d));
    });
    if (badWorkingDays) {
      const school = schools.find((s) => s.id === badWorkingDays.school_id);
      toast.error(`${school?.name ?? 'One of the assigned schools'} doesn't operate on one of the selected working days — adjust it before saving.`);
      return;
    }

    try {
      setActionLoading('edit');
      // Don't include temp_password in regular update (only use it for password change)
      const { temp_password: _temp_password, ...updateData } = formData;
      await adminApi.teachers.update(String(editingTeacher.id), updateData as Record<string, unknown>);

      toast.success('Teacher updated successfully');
      
      if (selectedTeacher && selectedTeacher.id === editingTeacher.id) {
        setProfileRefreshTrigger(prev => prev + 1);
      }
      
      setShowEditDialog(false);
      setEditingTeacher(null);
      resetForm();
      setShowPassword(false);
      setNewPassword("");
      setShowNewPassword(false);
      setCustomSubjectInputs({});
      loadAllData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error updating teacher: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete teacher
  const handleDeleteTeacher = async (teacherId: string) => {
    if (!(await confirmDialog({
      title: 'Delete this teacher?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    }))) return;

    try {
      setActionLoading(teacherId);
      await adminApi.teachers.delete(teacherId);

      setTeachers((prev) =>
        prev.filter((t) => String(t.id) !== String(teacherId)),
      );
      await loadAllData();
      toast.success('Teacher deleted successfully');
    } catch (error) {
      toast.error('Error deleting teacher');
    } finally {
      setActionLoading(null);
    }
  };

  const requestDeleteTeacherRow = (row: TeacherTableRow) => {
    void handleDeleteTeacher(String(row.id));
  };

  const requestBulkDeleteTeachers = (rows: TeacherTableRow[]) => {
    if (rows.length === 0) return;
    setBulkDeleteTeachers(rows);
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDeleteTeachers = async () => {
    if (!bulkDeleteTeachers?.length || isBulkDeletingTeachers) return;
    setIsBulkDeletingTeachers(true);
    try {
      const targets = bulkDeleteTeachers;
      const results = await Promise.allSettled(
        targets.map((t) => adminApi.teachers.delete(String(t.id))),
      );
      const succeededIds: string[] = [];
      const failedLabels: string[] = [];
      results.forEach((result, i) => {
        const row = targets[i];
        if (result.status === "fulfilled") {
          succeededIds.push(String(row.id));
        } else {
          failedLabels.push(row.nameDisplay || row.email || String(row.id));
        }
      });
      if (succeededIds.length > 0) {
        setTeachers((prev) =>
          prev.filter((t) => !succeededIds.includes(String(t.id))),
        );
        toast.success(
          `Deleted ${succeededIds.length} teacher${succeededIds.length !== 1 ? "s" : ""}.`,
        );
        setBulkSelectionResetKey((k) => k + 1);
        await loadAllData();
      }
      if (failedLabels.length > 0) {
        const preview = failedLabels.slice(0, 5).join(", ");
        toast.error(
          `Could not delete ${failedLabels.length} teacher${failedLabels.length !== 1 ? "s" : ""}: ${preview}${failedLabels.length > 5 ? "…" : ""}`,
        );
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Bulk delete failed unexpectedly.");
    } finally {
      setIsBulkDeletingTeachers(false);
      setIsBulkDeleteDialogOpen(false);
      setBulkDeleteTeachers(null);
    }
  };

  // Handle leave request action
  const handleLeaveAction = async (leaveId: string, action: 'approve' | 'reject') => {
    try {
      setActionLoading(leaveId);
      await adminApi.leaves.update({
        id: leaveId,
        status: action === 'approve' ? 'Approved' : 'Rejected',
        admin_remarks: leaveFormData.admin_remarks,
      });

      const leaveRequest =
        allLeaveRequests.find((l: LeaveRequest) => l.id === leaveId) ||
        leaveRequests.find((l: LeaveRequest) => l.id === leaveId);
      const teacherName = leaveRequest?.profiles?.full_name || 'Teacher';

      addNotification({
        type: 'success',
        title: `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `${teacherName}'s leave request has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
      });

      await loadLeaveRequests();
      setShowLeaveDialog(false);
      setSelectedLeave(null);
      setLeaveFormData({ status: '', admin_remarks: '' });
      loadAllData();
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to ${action} leave request`
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      address: "",
      qualification: "",
      experience_years: 0,
      specialization: "",
      school_assignments: [],
      temp_password: ""
    });
  };

  // Handle input change
  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Generate password
  const _generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, temp_password: password }));
  };

  // Handle add custom subject
  const handleAddCustomSubject = (assignmentIndex: number) => {
    const assignmentId = formData.school_assignments[assignmentIndex]?.id || `assignment-${assignmentIndex}`;
    const customSubject = customSubjectInputs[assignmentId]?.trim();
    
    if (!customSubject) {
      return;
    }

    // Check if subject already exists (case-insensitive)
    const assignment = formData.school_assignments[assignmentIndex];
    if (assignment) {
      const subjectExists = (assignment.subjects ?? []).some(
        (s: string) => s.toLowerCase() === customSubject.toLowerCase(),
      );
      if (subjectExists) {
        toast.warning('This subject is already added');
        return;
      }

      // Add custom subject
      const updatedAssignments = [...formData.school_assignments];
      updatedAssignments[assignmentIndex] = {
        ...updatedAssignments[assignmentIndex],
        subjects: [
          ...(updatedAssignments[assignmentIndex].subjects ?? []),
          customSubject,
        ],
      };
      
      setFormData(prev => ({
        ...prev,
        school_assignments: updatedAssignments
      }));

      // Clear input
      setCustomSubjectInputs(prev => ({
        ...prev,
        [assignmentId]: ''
      }));
    }
  };

  // A teacher physically can't be in two schools on the same weekday, so
  // flag it (as a warning, not a hard block — the admin may still have a
  // legitimate reason, e.g. a half-day arrangement) whenever two
  // assignments for different schools share a working day.
  const getScheduleOverlapWarning = (index: number): string | null => {
    const current = formData.school_assignments[index];
    const currentDays = current?.working_days ?? [];
    if (!current?.school_id || currentDays.length === 0) return null;
    const conflicts: string[] = [];
    formData.school_assignments.forEach((other, j) => {
      if (j === index || !other.school_id || other.school_id === current.school_id) return;
      const commonDays = currentDays.filter((d) => (other.working_days ?? []).includes(d));
      if (commonDays.length > 0) {
        const otherSchoolName = schools.find((s) => s.id === other.school_id)?.name ?? 'another school';
        conflicts.push(`${formatWorkingDays(commonDays)} — also assigned at ${otherSchoolName}`);
      }
    });
    return conflicts.length > 0 ? conflicts.join('; ') : null;
  };

  // Copy password
  const _copyPassword = () => {
    navigator.clipboard.writeText(formData.temp_password);
    toast.success('Password copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg font-medium text-gray-700">Loading teachers data...</p>
          <p className="text-sm text-gray-500">Please wait while we fetch the data</p>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(false);
              loadAllData(0);
            }}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teachers Management</h1>
          <div className="flex items-center gap-4 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-muted-foreground">Manage teachers, attendance, and leave requests</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Teacher
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Teachers</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalTeachers}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.activeTeachers}</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {stats.totalTeachers > 0 ? Math.round((stats.activeTeachers / stats.totalTeachers) * 100) : 0}% of total
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Leaves</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingLeaves}</p>
                {stats.pendingLeaves > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">Needs review</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Attendance</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.averageAttendance}%</p>
                <p className="text-xs text-gray-400 mt-1">Month to date</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'teachers'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Teachers
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'attendance'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'leaves'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Leave Requests
          </button>
        </div>

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
        <Card className="bg-white overflow-visible">
          <CardHeader>
            <div>
              <CardTitle>Teachers ({teachers.length})</CardTitle>
              <CardDescription>
                Manage teacher accounts and information — use the table search and column filters to narrow the list.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No teachers found</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by adding your first teacher.
                </p>
                <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2 mx-auto">
                  <Plus className="h-4 w-4" />
                  Add Teacher
                </Button>
              </div>
            ) : (
              <TeacherManagementTable<TeacherTableRow>
                rows={teacherTableRows}
                loading={false}
                onView={handleViewTeacherProfile}
                onEdit={handleEditTeacher}
                onDelete={requestDeleteTeacherRow}
                onBulkDeleteSelected={requestBulkDeleteTeachers}
                resetSelectionKey={bulkSelectionResetKey}
                renderSchoolsCell={renderTeacherSchoolsCell}
                searchPlaceholder="Search teachers by name, email, school, qualification…"
                itemsPerPage={15}
                emptyMessage="No teachers match your filters or search."
                className="shadow-sm"
              />
            )}
          </CardContent>
        </Card>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Teacher Attendance</CardTitle>
                <CardDescription>
                  View and manage teacher attendance records
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {attendanceSummary ? (
              <div className="space-y-6">
                {/* Attendance Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Users className="h-8 w-8 text-blue-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-blue-900">Total Teachers</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {attendanceSummary.totalTeachers || teachers.length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-green-900">Present Today</p>
                          <p className="text-2xl font-bold text-green-900">
                            {attendanceSummary.presentToday ?? attendanceSummary.presentDays ?? 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <XCircle className="h-8 w-8 text-red-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-red-900">Absent / Not marked</p>
                          <p className="text-2xl font-bold text-red-900">
                            {attendanceSummary.absentToday ?? 0}
                          </p>
                          <p className="text-xs text-red-800/80 mt-1 max-w-[11rem]">
                            Teachers without a present mark and not on approved leave.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Clock className="h-8 w-8 text-yellow-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-yellow-900">Average Attendance</p>
                          <p className="text-2xl font-bold text-yellow-900">
                            {attendanceSummary.attendanceRate || 0}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {(attendanceSummary.onLeaveToday ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {attendanceSummary.onLeaveToday} teacher
                    {attendanceSummary.onLeaveToday !== 1 ? 's are' : ' is'} on approved leave today
                    (counted separately from absent / not marked).
                  </p>
                )}
                {(attendanceSummary.onHolidayToday ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {attendanceSummary.onHolidayToday} teacher
                    {attendanceSummary.onHolidayToday !== 1 ? 's are' : ' is'} at a school with a declared holiday
                    today — excluded from &quot;Absent / Not marked&quot; and from the attendance rate.
                  </p>
                )}

                {/* Today's Attendance Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold text-gray-900">Today&apos;s Attendance</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Teacher Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Today&apos;s Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Account Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Attendance Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {teachers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                              No teachers found
                            </td>
                          </tr>
                        ) : (
                          teachers.map((teacher) => {
                            const tid = String(teacher.id ?? (teacher as { teacher_id?: string }).teacher_id ?? '');
                            const todayStatus =
                              attendanceSummary.teacherTodayStatus?.[tid] || {
                                status: 'Not Marked',
                                isOnLeave: false,
                              };
                            const perSchoolToday = attendanceSummary.teacherTodaySchoolStatuses?.[tid];
                            const statusBadge = (status: string, leaveType?: string) => {
                              switch (status) {
                                case 'Present':
                                  return <Badge className="bg-green-500 text-white">Present</Badge>;
                                case 'On Leave':
                                case 'Leave-Approved':
                                  return <Badge className="bg-blue-500 text-white">On Leave {leaveType ? `(${leaveType})` : ''}</Badge>;
                                case 'Absent':
                                  return <Badge className="bg-red-500 text-white">Absent</Badge>;
                                case 'Holiday':
                                  return <Badge className="bg-purple-500 text-white">Holiday</Badge>;
                                case 'Off Today':
                                  return <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50">Off Today</Badge>;
                                case 'Not Marked':
                                  return <Badge variant="outline" className="border-gray-300 text-gray-600">Not Marked</Badge>;
                                default:
                                  return <Badge variant="outline" className="border-gray-300 text-gray-600">{status}</Badge>;
                              }
                            };
                            // Scheduled at 2+ schools today (rare) — show each school's own
                            // status instead of one merged badge, so covering one school but
                            // missing another isn't hidden behind a single "Present".
                            const getStatusBadge = () =>
                              perSchoolToday && perSchoolToday.length > 1 ? (
                                <div className="flex flex-col gap-1">
                                  {perSchoolToday.map((s) => (
                                    <div key={s.school_id} className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-gray-500 truncate max-w-[100px]" title={s.school_name}>
                                        {s.school_name}:
                                      </span>
                                      {statusBadge(s.status)}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                statusBadge(todayStatus.status, todayStatus.leaveType)
                              );

                            return (
                              <tr key={tid || teacher.email} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {teacher.name ?? teacher.full_name ?? '—'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {teacher.email}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {getStatusBadge()}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Badge className={teacher.status === 'Active' ? 'bg-green-500' : 'bg-gray-500'}>
                                    {teacher.status || 'Active'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {todayStatus.attendanceRate !== undefined ? todayStatus.attendanceRate : (attendanceSummary.attendanceRate || 0)}%
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Monthly Attendance Table - Below Today's Attendance */}
                <div className="border rounded-lg overflow-hidden mt-6">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Monthly Attendance
                      </h3>
                      <div className="flex items-center gap-2">
                        <Select
                          value={attendanceSchoolFilter}
                          onValueChange={(v) => {
                            setAttendanceSchoolFilter(v);
                            loadMonthlyAttendance(undefined, v);
                          }}
                        >
                          <SelectTrigger className="w-48" title="Filter working days to one school, or view combined totals across all schools a teacher works at">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All schools (combined)</SelectItem>
                            {(schools ?? []).map((s: { id: string; name: string }) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="month"
                          value={selectedMonth}
                          onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            loadMonthlyAttendance(e.target.value);
                          }}
                          className="w-40"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadMonthlyAttendance()}
                          disabled={monthlyLoading}
                          title="Refresh monthly attendance data"
                        >
                          <RefreshCw className={`h-4 w-4 ${monthlyLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={markMissingAttendance}
                          disabled={markingMissingAttendance || monthlyLoading}
                          title="Mark missing attendance for teachers with scheduled periods but no reports"
                          className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                        >
                          {markingMissingAttendance ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Mark Missing</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    {monthlyAttendance.length > 0 ? (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Teacher Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              School
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Working Days
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Present Days
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Absent Days
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Leave Days
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Unreported Days
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Attendance %
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {monthlyAttendance.map((monthly, monthlyIndex) => {
                            const rowKey = monthly.id ?? `${monthly.teacher_id ?? monthly.teacherId ?? monthlyIndex}-${monthly.month ?? monthlyIndex}`;
                            const hasBySchool = (monthly.by_school?.length ?? 0) > 0;
                            const isExpanded = expandedAttendanceRows.has(rowKey);
                            return (
                              <Fragment key={rowKey}>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {monthly.profiles?.full_name || 'N/A'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {monthly.profiles?.email || ''}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {hasBySchool ? (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                                      onClick={() =>
                                        setExpandedAttendanceRows((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(rowKey)) next.delete(rowKey);
                                          else next.add(rowKey);
                                          return next;
                                        })
                                      }
                                      title="This teacher works at multiple schools — click to see working days per school"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                      {monthly.by_school!.length} schools
                                    </button>
                                  ) : (
                                    monthly.schools?.name || 'N/A'
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {monthly.total_working_days ?? monthly.total_days ?? 0}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="text-sm font-medium text-green-600">
                                      {monthly.present_days ?? 0}
                                    </span>
                                    {(monthly.total_working_days ?? monthly.total_days ?? 0) > 0 && (
                                      <span className="ml-2 text-xs text-gray-500">
                                        ({(((monthly.present_days ?? 0) / (monthly.total_working_days ?? monthly.total_days ?? 1)) * 100).toFixed(1)}%)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="text-sm font-medium text-red-600">
                                      {monthly.absent_days ?? 0}
                                    </span>
                                    {(monthly.total_working_days ?? monthly.total_days ?? 0) > 0 && (
                                      <span className="ml-2 text-xs text-gray-500">
                                        ({(((monthly.absent_days ?? 0) / (monthly.total_working_days ?? monthly.total_days ?? 1)) * 100).toFixed(1)}%)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="text-sm font-medium text-blue-600">
                                      {monthly.leave_days ?? 0}
                                    </span>
                                    {(monthly.total_working_days ?? monthly.total_days ?? 0) > 0 && (
                                      <span className="ml-2 text-xs text-gray-500">
                                        ({(((monthly.leave_days ?? 0) / (monthly.total_working_days ?? monthly.total_days ?? 1)) * 100).toFixed(1)}%)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="text-sm font-medium text-orange-600">
                                      {monthly.unreported_days ?? 0}
                                    </span>
                                    {(monthly.total_working_days ?? monthly.total_days ?? 0) > 0 && (monthly.unreported_days ?? 0) > 0 && (
                                      <span className="ml-2 text-xs text-gray-500">
                                        ({(((monthly.unreported_days ?? 0) / (monthly.total_working_days ?? monthly.total_days ?? 1)) * 100).toFixed(1)}%)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Badge className={
                                    (monthly.attendance_percentage ?? 0) >= 90 ? 'bg-green-500 text-white' :
                                    (monthly.attendance_percentage ?? 0) >= 75 ? 'bg-yellow-500 text-white' :
                                    (monthly.attendance_percentage ?? 0) >= 50 ? 'bg-orange-500 text-white' :
                                    'bg-red-500 text-white'
                                  }>
                                    {(typeof monthly.attendance_percentage === 'number'
                                    ? monthly.attendance_percentage
                                    : ((monthly.total_days ?? monthly.total_working_days)
                                      ? Math.round(((monthly.present_days ?? 0) / (monthly.total_days ?? monthly.total_working_days ?? 1)) * 100)
                                      : 0)).toFixed(1)}%
                                  </Badge>
                                </td>
                              </tr>
                              {hasBySchool && isExpanded && monthly.by_school!.map((sb) => (
                                <tr key={`${rowKey}-${sb.school_id}`} className="bg-indigo-50/40">
                                  <td className="px-4 py-2 pl-8 text-xs text-gray-400 whitespace-nowrap">
                                    working days
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-700">
                                    <span className="inline-flex items-center gap-1">
                                      <School className="h-3 w-3 text-indigo-500" />
                                      {sb.school_name}
                                    </span>
                                    <div className="text-[10px] text-gray-400 pl-4">{formatWorkingDays(sb.working_days)}</div>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-700">
                                    {sb.total_working_days}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-green-600">
                                    {sb.present_days}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-red-600">
                                    {sb.absent_days}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-blue-600">
                                    {sb.leave_days}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-orange-600">
                                    {sb.unreported_days}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <Badge
                                      variant="outline"
                                      className={
                                        sb.attendance_percentage >= 90 ? 'border-green-300 text-green-700' :
                                        sb.attendance_percentage >= 75 ? 'border-yellow-300 text-yellow-700' :
                                        sb.attendance_percentage >= 50 ? 'border-orange-300 text-orange-700' :
                                        'border-red-300 text-red-700'
                                      }
                                    >
                                      {sb.attendance_percentage.toFixed(1)}%
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                              </Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900">
                              Totals
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {monthlyAttendance.reduce((sum, m) => sum + (m.total_working_days ?? m.total_days ?? 0), 0)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-green-600">
                              {monthlyAttendance.reduce((sum, m) => sum + (m.present_days ?? 0), 0)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-600">
                              {monthlyAttendance.reduce((sum, m) => sum + (m.absent_days ?? 0), 0)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                              {monthlyAttendance.reduce((sum, m) => sum + (m.leave_days ?? 0), 0)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-orange-600">
                              {monthlyAttendance.reduce((sum, m) => sum + (m.unreported_days ?? 0), 0)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {monthlyAttendance.length > 0
                                ? (monthlyAttendance.reduce((sum, m) => sum + (m.attendance_percentage ?? 0), 0) / monthlyAttendance.length).toFixed(1)
                                : '0.0'}%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        {monthlyLoading ? (
                          <div className="flex items-center justify-center">
                            <RefreshCw className="h-5 w-5 animate-spin text-gray-400 mr-2" />
                            Loading monthly attendance data...
                          </div>
                        ) : (
                          <div>
                            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                            <p>No monthly attendance data available for {new Date(`${selectedMonth}-01`).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                            <p className="text-xs text-gray-400 mt-1">Select a different month or mark attendance to see data</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Attendance Data</h3>
                <p className="text-muted-foreground mb-4">
                  Attendance records will appear here once teachers start marking attendance.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Leave Requests Section */}
        {activeTab === 'leaves' && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>
              Manage teacher leave requests and approvals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Status Count Badges */}
            <div className="flex gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Active ({allLeaveRequests.filter((leave: LeaveRequest) => leave.status === 'Pending').length})
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Approved ({allLeaveRequests.filter((leave: LeaveRequest) => leave.status === 'Approved').length})
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  Rejected ({allLeaveRequests.filter((leave: LeaveRequest) => leave.status === 'Rejected').length})
                </Badge>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={leaveStatusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => filterLeaveRequests('all')}
              >
                All
              </Button>
              <Button
                variant={leaveStatusFilter === 'Pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => filterLeaveRequests('Pending')}
              >
                Active
              </Button>
              <Button
                variant={leaveStatusFilter === 'Approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => filterLeaveRequests('Approved')}
              >
                Approved
              </Button>
              <Button
                variant={leaveStatusFilter === 'Rejected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => filterLeaveRequests('Rejected')}
              >
                Rejected
              </Button>
            </div>

            {leaveRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 mb-2" />
                <p>No {leaveStatusFilter === 'all' ? '' : leaveStatusFilter.toLowerCase()} leave requests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leaveRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{request.profiles?.full_name}</div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            request.status === 'Pending' 
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200' 
                              : request.status === 'Approved'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {request.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {request.start_date} to {request.end_date} ({request.total_days} days)
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Type:</span> {request.leave_type}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">School:</span> {request.schools?.name}
                      </div>
                      {request.substitute_required && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Substitute Required
                        </Badge>
                      )}
                      {request.status === 'Approved' && request.approved_at && (
                        <div className="text-xs text-green-600">
                          <span className="font-medium">Approved on:</span> {new Date(request.approved_at).toLocaleDateString()}
                          {request.reviewer?.full_name && ` by ${request.reviewer.full_name}`}
                        </div>
                      )}
                      {request.status === 'Rejected' && request.rejected_at && (
                        <div className="text-xs text-red-600">
                          <span className="font-medium">Rejected on:</span> {new Date(request.rejected_at).toLocaleDateString()}
                          {request.reviewer?.full_name && ` by ${request.reviewer.full_name}`}
                        </div>
                      )}
                      {request.admin_remarks && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Admin Remarks:</span> {request.admin_remarks}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {request.status === 'Pending' ? (
                        <>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedLeave(request);
                              setLeaveFormData({ status: 'Approved', admin_remarks: '' });
                              setShowLeaveDialog(true);
                            }}
                            disabled={actionLoading === request.id}
                          >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => {
                                setSelectedLeave(request);
                                setLeaveFormData({ status: 'Rejected', admin_remarks: '' });
                                setShowLeaveDialog(true);
                              }}
                              disabled={actionLoading === request.id}
                            >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {request.status === 'Approved' ? '✓ Approved' : '✗ Rejected'}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* Add Teacher Dialog */}
      <AddTeacherDialog
        isOpen={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          // Don't call resetForm here - AddTeacherDialog handles its own reset
        }}
        onSuccess={async () => {
          setShowAddDialog(false);
          
          // Small delay to ensure database transaction is committed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          try {
            await loadTeachers();
            await loadAllData();
          } catch {
            await loadAllData();
          }
        }}
      />

      <Dialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsBulkDeleteDialogOpen(open);
          if (!open) setBulkDeleteTeachers(null);
        }}
      >
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected teachers</DialogTitle>
            <DialogDescription>
              This cannot be undone. School assignments and related records for these teachers may be removed or orphaned depending on server policy.
            </DialogDescription>
          </DialogHeader>
          {bulkDeleteTeachers && bulkDeleteTeachers.length > 0 && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-gray-700">
                Delete <span className="font-semibold">{bulkDeleteTeachers.length}</span> teacher
                {bulkDeleteTeachers.length !== 1 ? "s" : ""}?
              </p>
              <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-muted-foreground">
                {bulkDeleteTeachers.slice(0, 20).map((t) => (
                  <li key={t.id}>
                    {t.nameDisplay} ({t.email})
                  </li>
                ))}
                {bulkDeleteTeachers.length > 20 && (
                  <li className="list-none pl-0 text-muted-foreground/80">
                    …and {bulkDeleteTeachers.length - 20} more
                  </li>
                )}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsBulkDeleteDialogOpen(false);
                setBulkDeleteTeachers(null);
              }}
              disabled={isBulkDeletingTeachers}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              disabled={isBulkDeletingTeachers || !bulkDeleteTeachers?.length}
              onClick={() => void confirmBulkDeleteTeachers()}
            >
              {isBulkDeletingTeachers ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {bulkDeleteTeachers?.length ?? 0} teacher
                  {(bulkDeleteTeachers?.length ?? 0) !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open: boolean) => {
        setShowEditDialog(open);
        if (!open) {
          setShowPassword(false); // Reset password visibility when closing
        }
      }}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>
              Update teacher information and school assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 bg-white rounded-lg overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_full_name">Full Name</Label>
                <Input
                  id="edit_full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_phone">Phone</Label>
                <Input
                  id="edit_phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="edit_qualification">Qualification</Label>
                <Input
                  id="edit_qualification"
                  value={formData.qualification}
                  onChange={(e) => handleInputChange('qualification', e.target.value)}
                  placeholder="Enter qualification"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_experience_years">Experience (Years)</Label>
                <Input
                  id="edit_experience_years"
                  type="number"
                  value={formData.experience_years}
                  onChange={(e) => handleInputChange('experience_years', parseInt(e.target.value) || 0)}
                  placeholder="Enter years of experience"
                />
              </div>
              <div>
                <Label htmlFor="edit_specialization">Specialization</Label>
                <Input
                  id="edit_specialization"
                  value={formData.specialization}
                  onChange={(e) => handleInputChange('specialization', e.target.value)}
                  placeholder="Enter specialization"
                />
              </div>
            </div>
            <div>
              <Label>Change Current Password</Label>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Use this to reset the password if the teacher has forgotten it. A new password will be generated and assigned.
                </p>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="new_password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8: uppercase, lowercase, number)"
                    className="pl-10 pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={generateNewPassword}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Generate
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={copyNewPassword}
                    disabled={!newPassword}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleChangePassword}
                    disabled={!newPassword || newPassword.length < 8 || actionLoading === 'change-password'}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {actionLoading === 'change-password' ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <Shield className="h-3 w-3" />
                        Change Password
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            {/* School and Grade Assignments Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">School & Grade Assignments</h3>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const newAssignment: TeacherSchool = {
                      id: `temp-${Date.now()}`,
                      teacher_id: String(editingTeacher?.id ?? ''),
                      school_id: '',
                      grades_assigned: [],
                      subjects: [],
                      working_days: [1, 2, 3, 4, 5],
                      working_days_per_week: 5,
                      effective_from: todayStr(),
                      assigned_from: todayStr(),
                      assigned_until: "",
                      max_students_per_session: 30,
                      is_primary: formData.school_assignments.length === 0
                    };
                    setFormData(prev => ({
                      ...prev,
                      school_assignments: [...prev.school_assignments, newAssignment]
                    }));
                  }}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <School className="h-4 w-4" />
                  Add School
                </Button>
              </div>
              
              {formData.school_assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <School className="mx-auto h-12 w-12 mb-2" />
                  <p>No schools assigned</p>
                  <p className="text-sm">Click &quot;Add School&quot; to assign schools and grades</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.school_assignments.map((assignment, index) => {
                    const assignmentKey = assignment.id ?? `assignment-${assignment.school_id ?? index}-${index}`;
                    const assignedSchool = schools.find((s) => s.id === assignment.school_id);
                    const assignedSchoolName = assignedSchool?.name;
                    const gradeCount = (assignment.grades_assigned ?? []).length;
                    const scheduleWarning = getScheduleOverlapWarning(index);
                    const isGradesExpanded = expandedGradesAssignments.has(assignmentKey);
                    const toggleGradesExpanded = () => {
                      setExpandedGradesAssignments((prev) => {
                        const next = new Set(prev);
                        if (next.has(assignmentKey)) next.delete(assignmentKey);
                        else next.add(assignmentKey);
                        return next;
                      });
                    };
                    const gradesWithSectionsForAssignment: Array<{ id: string; name: string; sections?: { id: string; name: string }[] }> =
                      (assignedSchool?.grades && Array.isArray(assignedSchool.grades)) ? assignedSchool.grades : [];
                    const sectionAssignmentsForAssignment = assignment.school_id ? (assignmentsBySchoolId[assignment.school_id] ?? []) : [];
                    const assignedBySectionIdForAssignment = Object.fromEntries(
                      sectionAssignmentsForAssignment.map((a) => [a.sectionId, a.teacherName]),
                    );
                    const currentTeacherNameForAssignment = editingTeacher?.name ?? editingTeacher?.full_name ?? '';
                    const selectAllGrades = () => {
                      const updatedAssignments = [...formData.school_assignments];
                      updatedAssignments[index].grades_assigned = gradesWithSectionsForAssignment.map((g) => g.name);
                      updatedAssignments[index].grade_sections_assigned = gradesWithSectionsForAssignment.map((g) => ({
                        grade: g.name,
                        sections: (g.sections ?? [])
                          .filter((sec) => {
                            const assignedName = assignedBySectionIdForAssignment[sec.id];
                            return (
                              !assignedName ||
                              !currentTeacherNameForAssignment ||
                              assignedName.trim().toLowerCase() === currentTeacherNameForAssignment.trim().toLowerCase()
                            );
                          })
                          .map((sec) => sec.name),
                      }));
                      setFormData(prev => ({ ...prev, school_assignments: updatedAssignments }));
                    };
                    const clearAllGrades = () => {
                      const updatedAssignments = [...formData.school_assignments];
                      updatedAssignments[index].grades_assigned = [];
                      updatedAssignments[index].grade_sections_assigned = [];
                      setFormData(prev => ({ ...prev, school_assignments: updatedAssignments }));
                    };
                    return (
                    <div
                      key={assignmentKey}
                      className={`border rounded-lg p-4 space-y-4 border-l-4 ${assignment.is_primary ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-gray-300'}`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <School className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium leading-tight">
                              {assignedSchoolName || `School ${index + 1}`}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {assignment.is_primary && (
                                <Badge className="bg-blue-600 hover:bg-blue-600 text-[10px] h-4 px-1.5">Primary</Badge>
                              )}
                              {(assignment.working_days ?? []).length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {(assignment.working_days ?? []).length} day{(assignment.working_days ?? []).length === 1 ? '' : 's'}/week
                                </span>
                              )}
                              {gradeCount > 0 && (
                                <span className="text-xs text-muted-foreground">· {gradeCount} grade{gradeCount === 1 ? '' : 's'}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="flex items-center gap-1.5 text-sm">
                            <input
                              type="checkbox"
                              checked={assignment.is_primary}
                              onChange={(e) => {
                                const updatedAssignments = [...formData.school_assignments];
                                updatedAssignments[index].is_primary = e.target.checked;
                                // If this is set as primary, unset others
                                if (e.target.checked) {
                                  updatedAssignments.forEach((a, i) => {
                                    if (i !== index) a.is_primary = false;
                                  });
                                }
                                setFormData(prev => ({
                                  ...prev,
                                  school_assignments: updatedAssignments
                                }));
                              }}
                            />
                            Primary School
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                school_assignments: prev.school_assignments.filter((_, i) => i !== index)
                              }));
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`school_${index}`}>School</Label>
                        <Select
                          value={assignment.school_id}
                          onValueChange={(value) => {
                            const updatedAssignments = [...formData.school_assignments];
                            updatedAssignments[index].school_id = value;
                            updatedAssignments[index].grades_assigned = []; // Reset grades when school changes
                            setFormData(prev => ({
                              ...prev,
                              school_assignments: updatedAssignments
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a school" />
                          </SelectTrigger>
                          <SelectContent>
                            {schools.map((school) => (
                              <SelectItem key={school.id} value={school.id}>
                                {school.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mt-4">
                        <Label>Working Days at This School</Label>
                        <WeekdayPicker
                          idPrefix={`working_days_${index}`}
                          value={assignment.working_days ?? [1, 2, 3, 4, 5]}
                          allowedDays={schools.find((s) => s.id === assignment.school_id)?.operatingDays}
                          onChange={(days) => {
                            const updatedAssignments = [...formData.school_assignments];
                            updatedAssignments[index].working_days = days;
                            updatedAssignments[index].working_days_per_week = days.length;
                            setFormData(prev => ({
                              ...prev,
                              school_assignments: updatedAssignments
                            }));
                          }}
                        />
                        {scheduleWarning && (
                          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                              <span className="font-medium">Schedule conflict:</span> {scheduleWarning}.
                              A teacher can&apos;t physically be at two schools on the same day — double-check this is intentional.
                            </span>
                          </div>
                        )}
                        <div className="mt-2 max-w-xs">
                          <Label htmlFor={`effective_from_${index}`} className="text-xs text-gray-500">
                            Effective from
                          </Label>
                          <Input
                            id={`effective_from_${index}`}
                            type="date"
                            value={assignment.effective_from ?? todayStr()}
                            onChange={(e) => {
                              const updatedAssignments = [...formData.school_assignments];
                              updatedAssignments[index].effective_from = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                school_assignments: updatedAssignments
                              }));
                            }}
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Changing the days above only applies from this date onward — earlier
                            attendance keeps using whatever pattern was in effect before.
                          </p>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 max-w-md">
                          <div>
                            <Label htmlFor={`assigned_from_${index}`} className="text-xs text-gray-500">
                              Assigned From
                            </Label>
                            <Input
                              id={`assigned_from_${index}`}
                              type="date"
                              value={assignment.assigned_from ?? ""}
                              onChange={(e) => {
                                const updatedAssignments = [...formData.school_assignments];
                                updatedAssignments[index].assigned_from = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  school_assignments: updatedAssignments
                                }));
                              }}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`assigned_until_${index}`} className="text-xs text-gray-500">
                              Assigned Until (optional)
                            </Label>
                            <Input
                              id={`assigned_until_${index}`}
                              type="date"
                              value={assignment.assigned_until ?? ""}
                              onChange={(e) => {
                                const updatedAssignments = [...formData.school_assignments];
                                updatedAssignments[index].assigned_until = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  school_assignments: updatedAssignments
                                }));
                              }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          The date range this teacher is actually assigned/present at this school
                          (not the weekly pattern above) — leave &quot;Assigned Until&quot; blank if ongoing.
                          Class Scheduling only allows scheduling this teacher here within this window.
                        </p>
                        {assignment.school_id && editingTeacher && (
                          <WorkingDaysHistoryPanel
                            teacherId={String(editingTeacher.id)}
                            schoolId={assignment.school_id}
                          />
                        )}
                      </div>

                      {assignment.school_id && (
                        <>
                          <div>
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={toggleGradesExpanded}
                                className="flex items-center gap-1.5 text-left"
                              >
                                {isGradesExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}
                                <Label className="cursor-pointer">
                                  Grades and Sections <span className="text-red-500">*</span>
                                </Label>
                                <span className="text-xs text-muted-foreground">
                                  {gradeCount > 0 ? `(${gradeCount} selected)` : '(none selected)'}
                                </span>
                              </button>
                              {isGradesExpanded && gradesWithSectionsForAssignment.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                                    onClick={selectAllGrades}
                                  >
                                    Select All
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                                    onClick={clearAllGrades}
                                  >
                                    Clear All
                                  </Button>
                                </div>
                              )}
                            </div>
                            {isGradesExpanded && (
                            <div className="mt-2 space-y-3 max-h-96 overflow-y-auto border rounded-md p-3">
                              {(() => {
                                const sid = assignment.school_id;
                                if (!sid) {
                                  return (
                                    <div className="text-center py-4 text-sm text-muted-foreground">
                                      Please select a school first
                                    </div>
                                  );
                                }
                                const school = schools.find((s) => s.id === sid);
                                const gradesWithSections = (school?.grades && Array.isArray(school.grades)) ? school.grades : [];
                                if (gradesWithSections.length === 0) {
                                  const isConfiguring = configuringGradesForSchoolId === sid;
                                  return (
                                    <div className="text-center py-4 text-sm text-muted-foreground space-y-2">
                                      <p>This school has no grades configured. You can create default grades and sections here.</p>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        disabled={isConfiguring}
                                        onClick={async () => {
                                          setConfiguringGradesForSchoolId(sid);
                                          try {
                                            await adminApi.schools.initAcademicStructure(sid);
                                            await refetchSchools();
                                          } catch (e) {
                                            console.error("Failed to init academic structure:", e);
                                          } finally {
                                            setConfiguringGradesForSchoolId(null);
                                          }
                                        }}
                                      >
                                        {isConfiguring ? "Configuring…" : "Configure grades"}
                                      </Button>
                                    </div>
                                  );
                                }
                                const gradeSections: Array<{ grade?: string; sections?: string[] }> = assignment.grade_sections_assigned || [];
                                const sectionAssignments = assignmentsBySchoolId[sid] ?? [];
                                const assignedBySectionId = Object.fromEntries(sectionAssignments.map((a) => [a.sectionId, a.teacherName]));
                                return gradesWithSections.map((gradeObj: { id: string; name: string; sections?: { id: string; name: string }[] }) => {
                                  const gradeName = gradeObj.name;
                                  const sections = Array.isArray(gradeObj.sections) ? gradeObj.sections : [];
                                  const isGradeSelected = (assignment.grades_assigned ?? []).includes(gradeName);
                                  const currentGradeSectionData = gradeSections.find((gs) => gs.grade === gradeName);
                                  const currentSelectedSections = currentGradeSectionData?.sections || [];
                                  return (
                                    <div key={gradeObj.id} className="border rounded-lg p-3 space-y-2">
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={isGradeSelected}
                                          onChange={(e) => {
                                            const updatedAssignments = [...formData.school_assignments];
                                            const gsList = updatedAssignments[index].grade_sections_assigned || [];
                                            if (e.target.checked) {
                                              const prevGrades = updatedAssignments[index].grades_assigned ?? [];
                                              updatedAssignments[index].grades_assigned = [...prevGrades, gradeName];
                                              updatedAssignments[index].grade_sections_assigned = [...gsList, { grade: gradeName, sections: [] }];
                                            } else {
                                              const prevGrades = updatedAssignments[index].grades_assigned ?? [];
                                              updatedAssignments[index].grades_assigned = prevGrades.filter((g: string) => g !== gradeName);
                                              updatedAssignments[index].grade_sections_assigned = gsList.filter((gs) => gs.grade !== gradeName);
                                            }
                                            setFormData(prev => ({ ...prev, school_assignments: updatedAssignments }));
                                          }}
                                        />
                                        <Label className="text-sm font-medium">{gradeName}</Label>
                                      </div>
                                      {isGradeSelected && (
                                        <div className="ml-6 space-y-2">
                                          <Label className="text-xs text-gray-600">Select Sections:</Label>
                                          <div className="flex flex-wrap gap-2">
                                            {sections.map((sec: { id: string; name: string }) => {
                                              const assignedName = assignedBySectionId[sec.id];
                                              const currentTeacherName = editingTeacher?.name ?? editingTeacher?.full_name ?? '';
                                              const isAssignedToOther = Boolean(
                                                assignedName &&
                                                  currentTeacherName &&
                                                  assignedName.trim().toLowerCase() !== currentTeacherName.trim().toLowerCase(),
                                              );
                                              return (
                                                <div key={sec.id} className={`flex items-center space-x-1 ${isAssignedToOther ? 'opacity-75' : ''}`}>
                                                  <input
                                                    type="checkbox"
                                                    disabled={isAssignedToOther}
                                                    checked={currentSelectedSections.includes(sec.name)}
                                                    onChange={(e) => {
                                                      const updatedAssignments = [...formData.school_assignments];
                                                      const gsList = updatedAssignments[index].grade_sections_assigned || [];
                                                      const gradeSectionIndex = gsList.findIndex((gs) => gs.grade === gradeName);
                                                      if (gradeSectionIndex >= 0) {
                                                        const updatedGradeSections = [...gsList];
                                                        if (e.target.checked) {
                                                          if (!updatedGradeSections[gradeSectionIndex].sections?.includes(sec.name)) {
                                                            updatedGradeSections[gradeSectionIndex] = {
                                                              ...updatedGradeSections[gradeSectionIndex],
                                                              sections: [...(updatedGradeSections[gradeSectionIndex].sections || []), sec.name]
                                                            };
                                                          }
                                                        } else {
                                                          updatedGradeSections[gradeSectionIndex] = {
                                                            ...updatedGradeSections[gradeSectionIndex],
                                                            sections: (updatedGradeSections[gradeSectionIndex].sections || []).filter((s: string) => s !== sec.name)
                                                          };
                                                        }
                                                        updatedAssignments[index].grade_sections_assigned = updatedGradeSections;
                                                      }
                                                      setFormData(prev => ({ ...prev, school_assignments: updatedAssignments }));
                                                    }}
                                                  />
                                                  <Label className="text-xs">
                                                    {sec.name}
                                                    {isAssignedToOther && <span className="text-muted-foreground font-normal ml-1">(Assigned: {assignedName})</span>}
                                                  </Label>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                            )}
                          </div>

                          <div>
                            <Label>Subjects</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {availableSubjects.map((subject) => (
                                <Label key={subject} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={(assignment.subjects ?? []).includes(subject)}
                                    onChange={(e) => {
                                      const updatedAssignments = [...formData.school_assignments];
                                      const subj = updatedAssignments[index].subjects ?? [];
                                      if (e.target.checked) {
                                        updatedAssignments[index].subjects = [...subj, subject];
                                      } else {
                                        updatedAssignments[index].subjects = subj.filter((s: string) => s !== subject);
                                      }
                                      setFormData(prev => ({
                                        ...prev,
                                        school_assignments: updatedAssignments
                                      }));
                                    }}
                                  />
                                  <span className="text-sm">{subject}</span>
                                </Label>
                              ))}
                              {/* Display custom subjects */}
                              {(assignment.subjects ?? [])
                                .filter((subject: string) => !availableSubjects.includes(subject))
                                .map((subject) => (
                                  <Label key={subject} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={(assignment.subjects ?? []).includes(subject)}
                                      onChange={(e) => {
                                        const updatedAssignments = [...formData.school_assignments];
                                        const subj = updatedAssignments[index].subjects ?? [];
                                        if (e.target.checked) {
                                          updatedAssignments[index].subjects = [...subj, subject];
                                        } else {
                                          updatedAssignments[index].subjects = subj.filter((s: string) => s !== subject);
                                        }
                                        setFormData(prev => ({
                                          ...prev,
                                          school_assignments: updatedAssignments
                                        }));
                                      }}
                                    />
                                    <span className="text-sm">{subject}</span>
                                  </Label>
                                ))}
                            </div>
                            {/* Add Custom Subject */}
                            <div className="mt-2 flex gap-2">
                              <Input
                                placeholder="Enter custom subject"
                                value={customSubjectInputs[assignment.id ?? `assignment-${index}`] || ''}
                                onChange={(e) => setCustomSubjectInputs(prev => ({
                                  ...prev,
                                  [assignment.id ?? `assignment-${index}`]: e.target.value
                                }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomSubject(index);
                                  }
                                }}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => handleAddCustomSubject(index)}
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Plus className="h-4 w-4" />
                                Add
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor={`max_students_${index}`}>Max Students/Session</Label>
                            <Input
                              id={`max_students_${index}`}
                              type="number"
                              min="1"
                              max="50"
                              value={assignment.max_students_per_session}
                              onChange={(e) => {
                                const updatedAssignments = [...formData.school_assignments];
                                updatedAssignments[index].max_students_per_session = parseInt(e.target.value) || 30;
                                setFormData(prev => ({
                                  ...prev,
                                  school_assignments: updatedAssignments
                                }));
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setCustomSubjectInputs({});
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTeacher}
              disabled={actionLoading === 'edit'}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {actionLoading === 'edit' ? 'Updating...' : 'Update Teacher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Action Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {leaveFormData.status === 'Approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </DialogTitle>
            <DialogDescription>
              {leaveFormData.status === 'Approved' 
                ? 'Are you sure you want to approve this leave request?' 
                : 'Are you sure you want to reject this leave request?'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="admin_remarks">Admin Remarks (Optional)</Label>
              <Textarea
                id="admin_remarks"
                value={leaveFormData.admin_remarks}
                onChange={(e) => setLeaveFormData(prev => ({ ...prev, admin_remarks: e.target.value }))}
                placeholder="Enter any remarks about this decision..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedLeave) {
                  handleLeaveAction(selectedLeave.id, leaveFormData.status === 'Approved' ? 'approve' : 'reject');
                }
              }}
              className={leaveFormData.status === 'Approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {leaveFormData.status === 'Approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Panel */}
      <NotificationPanel
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onDismiss={dismiss}
      />

      {/* Teacher Profile View */}
      <TeacherProfileView
        teacher={selectedTeacher}
        open={showProfileView}
        onClose={() => {
          setShowProfileView(false);
          setSelectedTeacher(null);
        }}
        refreshTrigger={profileRefreshTrigger}
      />
    </div>
  );
}

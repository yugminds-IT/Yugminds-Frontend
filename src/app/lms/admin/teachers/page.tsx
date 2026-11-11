"use client";

import { TEACHING_SUBJECTS } from "@/lib/report-subjects";
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { frontendLogger, handleApiErrorResponse } from "@/lib/frontend-logger";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData } from "@/lib/form-persistence";
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
import AddTeacherDialog from "@/components/AddTeacherDialog";
import CopySchoolAssignmentDialog from "@/components/CopySchoolAssignmentDialog";
import WeekdayPicker from "@/components/WeekdayPicker";
import WorkingDaysHistoryPanel from "@/components/admin/WorkingDaysHistoryPanel";
import { formatWorkingDays } from "@/lib/weekday-utils";
import TeacherProfileView from "@/components/TeacherProfileView";
import { NotificationPanel, useNotifications } from "@/components/NotificationPanel";
import { 
  School, 
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Shield,
  Plus,
  Briefcase,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { requestClose, useDirtySnapshot } from "@/hooks/useUnsavedCloseGuard";
import type { TeacherManagementRow } from "@/components/ui/teacher-management-table";
import ConfirmModal from "@/components/portal/ConfirmModal";
import TodayRun from "@/components/admin/teachers/TodayRun";
import TeachersTab, { type StatusFilter } from "@/components/admin/teachers/TeachersTab";
import AttendanceTab from "@/components/admin/teachers/AttendanceTab";
import LeavesTab from "@/components/admin/teachers/LeavesTab";
import { EmergencyLeaveModal, LeaveDecisionModal } from "@/components/admin/teachers/LeaveModals";
import { idOf, isActive, plural, todayKey, type TodayKey } from "@/components/admin/teachers/utils";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes and leave rows
import "@/components/admin/teachers/teachers.css";

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
  last_login?: string | null;
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
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  applied_at?: string;
  approved_at?: string;
  rejected_at?: string;
  approved_by?: string;
  reviewer?: { id: string; full_name: string; email: string } | null;
  substitute_required?: boolean;
  is_emergency?: boolean;
  school_admin_status?: 'pending' | 'approved' | 'rejected';
  admin_status?: 'pending' | 'approved' | 'rejected';
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
  /** Absent days that still have a report (submitted after the 8pm cutoff). */
  late_report_days?: number;
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
    late_report_days?: number;
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

export default function TeachersManagement() {
  // State management
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  // Emergency leave filed on behalf of a teacher (admin = stage 2; school admin must still approve)
  const [emOpen, setEmOpen] = useState(false);
  const [emKey, setEmKey] = useState(0);
  const [emSaving, setEmSaving] = useState(false);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [todayFilter, setTodayFilter] = useState<TodayKey | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { schools, refetch: refetchSchools } = useAdminSchools();
  const [configuringGradesForSchoolId, setConfiguringGradesForSchoolId] = useState<string | null>(null);
  // Collapsed by default — the grades/sections checklist can be long, and
  // most edits only touch one assignment at a time. Keyed by assignment
  // id/index so each school assignment card expands independently.
  const [expandedGradesAssignments, setExpandedGradesAssignments] = useState<Set<string>>(new Set());
  const [assignmentsBySchoolId, setAssignmentsBySchoolId] = useState<Record<string, { sectionId: string; teacherId?: number; teacherName: string }[]>>({});
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
  const [isBulkDeletingTeachers, setIsBulkDeletingTeachers] = useState(false);
  const [bulkSelectionResetKey, setBulkSelectionResetKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [teachersFailed, setTeachersFailed] = useState(false);
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
  const [copySourceTeacher, setCopySourceTeacher] = useState<TeacherTableRow | null>(null);
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

  // Fetches for every school (not just ones already assigned to this
  // teacher) so the school-picker dropdown can show "(Assigned: Name)" for
  // schools not yet added, same as the Add Teacher dialog's checklist.
  useEffect(() => {
    if (!editingTeacher || schools.length === 0) return;
    schools.forEach((school) => {
      const schoolId = school.id;
      if (!schoolId || assignmentsBySchoolId[schoolId]) return;
      adminApi.schools.getTeacherAssignments(schoolId)
        .then((res) => {
          const data = res.data as { assignments?: { sectionId: string; teacherId?: number; teacherName: string }[] };
          setAssignmentsBySchoolId((prev) => ({ ...prev, [schoolId]: data.assignments ?? [] }));
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTeacher?.id, schools.length]);

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
  const availableSubjects: string[] = [...TEACHING_SUBJECTS];
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

      setTeachersFailed(false);
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
      
      // Keep any teachers already on screen; the page says "did not load" only when there is nothing to show.
      setTeachersFailed(true);
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

  const handleCopyAssignment = (teacher: TeacherTableRow) => {
    setCopySourceTeacher(teacher);
  };

  // Handle view teacher profile
  const handleViewTeacherProfile = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowProfileView(true);
  };

  // Handle edit teacher
  // `extraSources` lets a "Copy school assignment" action pre-fill additional
  // school rows (from a DIFFERENT teacher) as an unsaved draft alongside this
  // teacher's own real assignments — the admin reviews/adjusts them here
  // (same conflict warnings as any manual edit) before clicking Update.
  const handleEditTeacher = (teacher: Teacher, extraSources: AssignedSchool[] = []) => {
    setEditingTeacher(teacher);
    const sources = [...(teacher.assignedSchools ?? teacher.teacher_schools ?? []), ...extraSources];
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

  // Loads the target teacher's real data, then opens their Edit dialog with
  // the source teacher's picked schools appended as unsaved draft rows —
  // nothing is written until the admin reviews and clicks Update Teacher.
  const handleCopyConfirm = async (schoolIds: string[], targetTeacherId: string) => {
    if (!copySourceTeacher) return;
    try {
      const res = await adminApi.teachers.get(targetTeacherId);
      const targetTeacher = (res.data?.data ?? res.data) as Teacher;
      const sourceSchools = copySourceTeacher.assignedSchools ?? copySourceTeacher.teacher_schools ?? [];
      const extraSources = sourceSchools.filter((s: AssignedSchool | TeacherSchool) =>
        schoolIds.includes(s.schoolId ?? (s as TeacherSchool).school_id ?? ''),
      ) as AssignedSchool[];
      handleEditTeacher(targetTeacher, extraSources);
      setCopySourceTeacher(null);
      toast.success(
        `Pre-filled ${extraSources.length} school${extraSources.length === 1 ? '' : 's'} from ${copySourceTeacher.nameDisplay ?? copySourceTeacher.name ?? 'the source teacher'} — review and click "Update Teacher" to save.`,
      );
    } catch {
      toast.error('Could not load the target teacher — try again.');
    }
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

  // Delete one teacher after the confirmation modal
  const confirmDeleteTeacher = async () => {
    if (!deleting) return;
    const teacherId = String(deleting.id);
    const label = deleting.name ?? deleting.full_name ?? deleting.email;
    try {
      setActionLoading(teacherId);
      await adminApi.teachers.delete(teacherId);

      setTeachers((prev) =>
        prev.filter((t) => String(t.id) !== String(teacherId)),
      );
      await loadAllData();
      toast.success(`${label} was deleted.`);
      setDeleting(null);
    } catch (error) {
      toast.error('Could not delete the teacher. Try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const requestBulkDeleteTeachers = (rows: TeacherTableRow[]) => {
    if (rows.length === 0) return;
    setBulkDeleteTeachers(rows);
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
      setBulkDeleteTeachers(null);
    }
  };

  const submitEmergencyLeave = async (v: { teacher_id: string; school_id: string; start_date: string; end_date: string; reason: string }) => {
    setEmSaving(true);
    try {
      await adminApi.leaves.createEmergency(v);
      toast.success("Emergency leave recorded with your approval. The school admin must approve it before attendance changes.");
      setEmOpen(false);
      await loadLeaveRequests();
    } catch (error) {
      const serverMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(serverMsg || 'Could not record the emergency leave.');
    } finally {
      setEmSaving(false);
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
    } catch (error) {
      // Surface the server's reason (e.g. emergency leave needs the school admin's approval first)
      const serverMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addNotification({
        type: 'error',
        title: 'Error',
        message: serverMsg || `Failed to ${action} leave request`
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

  const isEditTeacherDirty = useDirtySnapshot(showEditDialog, {
    formData,
    newPassword,
  });

  const discardEditTeacherDialog = () => {
    setShowEditDialog(false);
    setEditingTeacher(null);
    resetForm();
    setShowPassword(false);
    setNewPassword("");
    setShowNewPassword(false);
    setCustomSubjectInputs({});
  };

  const requestCloseEditTeacher = () => {
    void requestClose(isEditTeacherDirty, discardEditTeacherDialog);
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

  /* ───────── derived ───────── */
  const todayMap = attendanceSummary?.teacherTodayStatus ?? {};
  const perSchoolMap = attendanceSummary?.teacherTodaySchoolStatuses ?? {};
  const activeList = teachers.filter((t) => isActive(t));
  const todayCounts: Record<TodayKey, number> = { present: 0, leave: 0, absent: 0, off: 0 };
  activeList.forEach((t) => { todayCounts[todayKey(todayMap[idOf(t)]?.status)] += 1; });
  const pendingLeaves = allLeaveRequests.filter((l) => l.status === 'Pending');
  const pendingEmergency = pendingLeaves.filter((l) => l.is_emergency).length;
  const leaveCounts = {
    all: allLeaveRequests.length,
    Pending: pendingLeaves.length,
    Approved: allLeaveRequests.filter((l) => l.status === 'Approved').length,
    Rejected: allLeaveRequests.filter((l) => l.status === 'Rejected').length,
  };
  const average = attendanceSummary ? (attendanceSummary.averageAttendanceRate ?? attendanceSummary.attendanceRate ?? null) : null;
  const tabs: { id: 'teachers' | 'attendance' | 'leaves'; label: string; n?: number }[] = [
    { id: 'teachers', label: 'Teachers', n: teachers.length },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leaves', label: 'Leave requests', n: pendingLeaves.length || undefined },
  ];
  const findTeacher = (id: string) => teachers.find((t) => String(t.id) === id);
  const clearFilters = () => { setTodayFilter(null); setStatusFilter('all'); };

  let status: React.ReactNode;
  if (loading && teachers.length === 0) status = 'Loading teachers…';
  else if (teachersFailed && teachers.length === 0) status = 'The teachers did not load. Try again.';
  else if (teachers.length === 0) status = 'No teachers yet. Add the first one to get started.';
  else if (pendingLeaves.length > 0) {
    status = <><strong>{plural(pendingLeaves.length, 'leave request')}</strong> {pendingLeaves.length === 1 ? 'is' : 'are'} waiting for a decision{pendingEmergency > 0 ? `, ${pendingEmergency} of them an emergency` : ''}.</>;
  } else if (activeList.length === 0) status = 'No teacher account is active right now.';
  else status = <><strong>{todayCounts.present} of {plural(activeList.length, 'active teacher')}</strong> {todayCounts.present === 1 ? 'is' : 'are'} present today.</>;

  const goTab = (id: 'teachers' | 'attendance' | 'leaves') => setActiveTab(id);
  const openEmergency = () => { setEmKey((k) => k + 1); setEmOpen(true); };

  if (loading && teachers.length === 0) {
    return (
      <div className="sd-page">
        <div className="sd-skel" style={{ height: '22rem', borderRadius: '1.75rem' }} />
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      </div>
    );
  }

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="at-title">
        <div className="sd-hero-copy">
          <h1 id="at-title" className="mc-hero-title">Teachers</h1>
          <p className="sd-where">Every teacher on the platform</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => setShowAddDialog(true)}><Plus aria-hidden="true" />Add teacher</button>
            {pendingLeaves.length > 0 ? (
              <button className="sd-btn sd-btn--ghost-dark" onClick={() => goTab('leaves')}>Review {plural(pendingLeaves.length, 'leave request')}</button>
            ) : (
              <button className="sd-btn sd-btn--ghost-dark" onClick={openEmergency}>Record emergency leave</button>
            )}
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={handleRefresh} disabled={refreshing} aria-label={refreshing ? 'Refreshing' : 'Refresh'} title="Refresh">
              <RefreshCw className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>
        <TodayRun
          counts={todayCounts}
          selected={todayFilter}
          onSelect={(k) => { setTodayFilter(k); if (k) goTab('teachers'); }}
          caption={attendanceSummary ? 'Today, active teachers only. Pick a stop to filter' : 'Attendance has not loaded'}
        />
      </section>

      <div className="sd-ledger" role="group" aria-label="Teacher numbers">
        <button type="button" aria-pressed={statusFilter === 'all' && !todayFilter && activeTab === 'teachers'} onClick={() => { clearFilters(); goTab('teachers'); }}>
          <span className="sd-l">All teachers</span><b className="sd-n">{teachers.length}</b><small>{teachers.length === 0 ? 'None yet' : teachers.length - activeList.length > 0 ? `${teachers.length - activeList.length} inactive` : 'Every account is active'}</small>
        </button>
        <button type="button" aria-pressed={statusFilter === 'active'} onClick={() => { setTodayFilter(null); setStatusFilter(statusFilter === 'active' ? 'all' : 'active'); goTab('teachers'); }}>
          <span className="sd-l">Active accounts</span><b className="sd-n">{activeList.length}</b><small>{teachers.length > 0 ? `${Math.round((activeList.length / teachers.length) * 100)}% of all teachers` : 'None yet'}</small>
        </button>
        <button type="button" data-hot={pendingLeaves.length > 0} onClick={() => goTab('leaves')}>
          <span className="sd-l">Pending leaves</span><b className="sd-n">{pendingLeaves.length}</b><small>{pendingLeaves.length > 0 ? (pendingEmergency > 0 ? `${pendingEmergency} emergency` : 'Waiting for a decision') : 'Nothing waiting'}</small>
        </button>
        <button type="button" onClick={() => goTab('attendance')}>
          <span className="sd-l">Attendance</span><b className="sd-n">{average == null || teachers.length === 0 ? '–' : `${Math.round(average)}%`}</b><small>Month to date, tap for details</small>
        </button>
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Teachers, attendance and leave" style={{ justifySelf: 'start' }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" className="mc-tab" aria-selected={activeTab === t.id} onClick={() => goTab(t.id)}>
            {t.label}{t.n != null && <b>{t.n}</b>}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && teachersFailed && teachers.length === 0 && !loading && (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the teachers</b>
            <p>Check your connection, then try again. Nothing was changed.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void loadTeachers()}>Try again</button>
          </div>
        </section>
      )}

      {activeTab === 'teachers' && !(teachersFailed && teachers.length === 0 && !loading) && (
        <TeachersTab
          teachers={teachers}
          today={todayMap}
          perSchool={perSchoolMap}
          todayFilter={todayFilter}
          statusFilter={statusFilter}
          onClearFilters={clearFilters}
          resetKey={bulkSelectionResetKey}
          busyId={actionLoading}
          onAdd={() => setShowAddDialog(true)}
          onView={(id) => { const t = findTeacher(id); if (t) handleViewTeacherProfile(t); }}
          onEdit={(id) => { const t = findTeacher(id); if (t) handleEditTeacher(t); }}
          onCopy={(id) => { const row = teacherTableRows.find((r) => String(r.id) === id); if (row) handleCopyAssignment(row); }}
          onDelete={(id) => { const t = findTeacher(id); if (t) setDeleting(t); }}
          onBulkDelete={(ids) => requestBulkDeleteTeachers(teacherTableRows.filter((r) => ids.includes(String(r.id))))}
        />
      )}

      {activeTab === 'attendance' && (
        <AttendanceTab
          rows={monthlyAttendance}
          loading={monthlyLoading}
          month={selectedMonth}
          onMonth={(m) => { setSelectedMonth(m); void loadMonthlyAttendance(m); }}
          schoolFilter={attendanceSchoolFilter}
          onSchoolFilter={(v) => { setAttendanceSchoolFilter(v); void loadMonthlyAttendance(undefined, v); }}
          schoolOptions={(schools ?? []).map((sc: { id: string; name: string }) => ({ id: sc.id, name: sc.name }))}
          onRefresh={() => void loadMonthlyAttendance()}
          onMarkMissing={markMissingAttendance}
          marking={markingMissingAttendance}
        />
      )}

      {activeTab === 'leaves' && (
        <LeavesTab
          leaves={leaveRequests}
          counts={leaveCounts}
          filter={leaveStatusFilter}
          onFilter={filterLeaveRequests}
          busyId={actionLoading}
          onApprove={(l) => { setSelectedLeave(allLeaveRequests.find((x) => x.id === l.id) ?? null); setLeaveFormData({ status: 'Approved', admin_remarks: '' }); setShowLeaveDialog(true); }}
          onReject={(l) => { setSelectedLeave(allLeaveRequests.find((x) => x.id === l.id) ?? null); setLeaveFormData({ status: 'Rejected', admin_remarks: '' }); setShowLeaveDialog(true); }}
          onRecord={openEmergency}
        />
      )}

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

      <CopySchoolAssignmentDialog
        open={!!copySourceTeacher}
        onClose={() => setCopySourceTeacher(null)}
        sourceTeacher={copySourceTeacher}
        teachers={teacherTableRows}
        onConfirm={handleCopyConfirm}
      />

      <ConfirmModal
        open={bulkDeleteTeachers !== null}
        onClose={() => setBulkDeleteTeachers(null)}
        title={`Delete ${plural(bulkDeleteTeachers?.length ?? 0, 'teacher')}?`}
        confirmLabel="Delete teachers"
        danger
        busy={isBulkDeletingTeachers}
        onConfirm={() => void confirmBulkDeleteTeachers()}
      >
        <p>This cannot be undone. Their school assignments and related records may be removed or orphaned, depending on server policy.</p>
        <ul className="at-names">
          {(bulkDeleteTeachers ?? []).slice(0, 20).map((t) => <li key={t.id}>{t.nameDisplay} ({t.email})</li>)}
          {(bulkDeleteTeachers?.length ?? 0) > 20 && <li style={{ listStyle: 'none' }}>…and {(bulkDeleteTeachers?.length ?? 0) - 20} more</li>}
        </ul>
      </ConfirmModal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this teacher?"
        subtitle={deleting ? (deleting.name ?? deleting.full_name ?? deleting.email) : undefined}
        confirmLabel="Delete teacher"
        danger
        busy={actionLoading !== null && actionLoading === String(deleting?.id)}
        onConfirm={() => void confirmDeleteTeacher()}
      >
        <p>This cannot be undone. Their school assignments and related records may be removed or orphaned, depending on server policy.</p>
      </ConfirmModal>

      <EmergencyLeaveModal
        key={emKey}
        open={emOpen}
        teachers={teachers}
        busy={emSaving}
        onClose={() => setEmOpen(false)}
        onSubmit={(v) => void submitEmergencyLeave(v)}
      />

      {/* Edit Teacher Dialog */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open: boolean) => {
          if (open) {
            setShowEditDialog(true);
            return;
          }
          requestCloseEditTeacher();
        }}
      >
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
                            {schools.map((school) => {
                              const assignedTeacherNames = [...new Set(
                                (assignmentsBySchoolId[school.id] ?? [])
                                  .filter((a) => a.teacherId !== editingTeacher?.id)
                                  .map((a) => a.teacherName),
                              )];
                              return (
                              <SelectItem key={school.id} value={school.id}>
                                {school.name}
                                {assignedTeacherNames.length > 0 && ` (Assigned: ${assignedTeacherNames.join(', ')})`}
                              </SelectItem>
                              );
                            })}
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
            <Button variant="outline" onClick={requestCloseEditTeacher}>
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

      <LeaveDecisionModal
        leave={showLeaveDialog ? selectedLeave : null}
        action={leaveFormData.status === 'Approved' ? 'approve' : 'reject'}
        busy={actionLoading !== null && actionLoading === selectedLeave?.id}
        remarks={leaveFormData.admin_remarks}
        onRemarks={(v) => setLeaveFormData((prev) => ({ ...prev, admin_remarks: v }))}
        onClose={() => setShowLeaveDialog(false)}
        onConfirm={() => { if (selectedLeave) void handleLeaveAction(selectedLeave.id, leaveFormData.status === 'Approved' ? 'approve' : 'reject'); }}
      />

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

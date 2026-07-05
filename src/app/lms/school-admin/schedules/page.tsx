"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Search,
  Building2,
  MapPin,
  Send,
  Loader2,
  ArrowRight,
  AlertCircle,
  MoreVertical,
  Copy,
  Repeat,
  ClipboardCopy,
  ChevronDown,
  Coffee,
  ChevronUp,
  LayoutDashboard,
  Bell,
  ShieldCheck,
  Download,
  FileText,
  FileSpreadsheet,
  Printer,
  History,
  Activity,
  ExternalLink,
  CheckCircle2,
  DoorOpen,
  CalendarDays
} from "lucide-react";
import { useSchoolAdmin } from "@/contexts/SchoolAdminContext";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";

interface Schedule {
  id: string;
  school_id: string;
  class_id?: string;
  teacher_id?: string;
  subject: string;
  grade: string;
  day_of_week: string;
  period_id?: string;
  room_id?: string;
  start_time: string;
  end_time: string;
  academic_year: string;
  is_active: boolean;
  notes?: string;
  class?: {
    id: string;
    class_name: string;
    grade: string;
    subject: string;
  };
  teacher?: {
    id: string;
    full_name: string;
    email: string;
  };
  period?: {
    id: string;
    period_number: number;
    start_time: string;
    end_time: string;
  };
  room?: {
    id: string;
    room_number: string;
    room_name?: string;
    capacity?: number;
  };
}

interface Period {
  id: string;
  school_id: string;
  period_number: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Room {
  id: string;
  school_id: string;
  room_number: string;
  room_name?: string;
  room_type?: string;
  capacity?: number;
  location?: string;
  facilities?: string[];
  is_active: boolean;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  subjects: string[];
  grades_assigned: string[];
  teacher_schools?: Array<{
    grades_assigned: string[];
    subjects: string[];
    working_days_per_week: number;
    max_students_per_session: number;
  }>;
}

interface Class {
  id: string;
  class_name: string;
  grade: string;
  subject?: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const GRID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AVAILABLE_GRADES = [
  'Pre-K', 
  'Kindergarten', 
  'Grade 1', 
  'Grade 2', 
  'Grade 3', 
  'Grade 4', 
  'Grade 5',
  'Grade 6', 
  'Grade 7', 
  'Grade 8', 
  'Grade 9', 
  'Grade 10', 
  'Grade 11', 
  'Grade 12'
];

export default function ClassSchedulingPage() {
  const { schoolInfo } = useSchoolAdmin();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolGrades, setSchoolGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [lockedFields, setLockedFields] = useState<{ day_of_week?: boolean; period_id?: boolean }>({});
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWizard, setShowWizard] = useState<boolean | null>(null);
  const [breakDuration, setBreakDuration] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && showWizard === null) {
      setShowWizard(periods.length === 0 && rooms.length === 0);
    }
  }, [loading, periods.length, rooms.length, showWizard]);

  const initialScheduleForm = {
    class_id: '',
    teacher_id: '',
    subject: '',
    grade: '',
    day_of_week: 'Monday',
    period_id: '',
    room_id: '',
    start_time: '',
    end_time: '',
    academic_year: '2024-25',
    notes: ''
  };

  const initialPeriodForm = {
    period_number: 1,
    start_time: '',
    end_time: '',
    is_active: true
  };

  const initialRoomForm = {
    room_number: '',
    room_name: '',
    room_type: 'Regular Classroom',
    capacity: '',
    location: '',
    facilities: [] as string[],
    is_active: true
  };

  // Form states
  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm);
  const [periodForm, setPeriodForm] = useState(initialPeriodForm);
  const [roomForm, setRoomForm] = useState(initialRoomForm);

  // Copy and Repeat Automations State
  const [copyScheduleDialogOpen, setCopyScheduleDialogOpen] = useState(false);
  const [scheduleToCopy, setScheduleToCopy] = useState<Schedule | null>(null);
  const [targetDay, setTargetDay] = useState<string>('');
  
  const [copyDayDialogOpen, setCopyDayDialogOpen] = useState(false);
  const [sourceDayToCopy, setSourceDayToCopy] = useState<string | null>(null);
  const [targetDays, setTargetDays] = useState<string[]>([]);
  const [copyResults, setCopyResults] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // Section 7 & 8 State
  const [showCompletionTracker, setShowCompletionTracker] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [selectedTeachersToPush, setSelectedTeachersToPush] = useState<string[]>([]);
  const [lastPushTimestamp, setLastPushTimestamp] = useState<string | null>(null);
  const [pushSuccessSummary, setPushSuccessSummary] = useState<string | null>(null);

  // Section 9, 10 & 11 State
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationResults, setValidationResults] = useState<{ errors: string[]; warnings: string[]; info: string[] } | null>(null);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2024-25');
  const [selectedTeacherWorkload, setSelectedTeacherWorkload] = useState<Teacher | null>(null);
  
  const ACADEMIC_YEARS = ['2023-24', '2024-25', '2025-26'];

  const SUBJECT_COLORS: Record<string, string> = {
    'Mathematics': 'blue',
    'Science': 'green',
    'English': 'purple',
    'Social Studies': 'amber',
    'Art': 'pink',
    'Music': 'indigo',
    'Physical Education': 'orange',
    'Computer Science': 'cyan',
    'History': 'red',
    'Geography': 'emerald'
  };

  const getSubjectColor = (subject: string) => {
    const s = subject?.trim() || 'Other';
    if (SUBJECT_COLORS[s]) return SUBJECT_COLORS[s];
    const colors = ['blue', 'green', 'purple', 'amber', 'pink', 'indigo', 'orange', 'cyan', 'red', 'emerald'];
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getColorClasses = (color: string) => {
    const mapping: Record<string, { border: string, bg: string, text: string }> = {
      blue: { border: 'border-l-blue-500', bg: 'bg-blue-50/50', text: 'text-blue-700' },
      green: { border: 'border-l-green-500', bg: 'bg-green-50/50', text: 'text-green-700' },
      purple: { border: 'border-l-purple-500', bg: 'bg-purple-50/50', text: 'text-purple-700' },
      amber: { border: 'border-l-amber-500', bg: 'bg-amber-50/50', text: 'text-amber-700' },
      pink: { border: 'border-l-pink-500', bg: 'bg-pink-50/50', text: 'text-pink-700' },
      indigo: { border: 'border-l-indigo-500', bg: 'bg-indigo-50/50', text: 'text-indigo-700' },
      orange: { border: 'border-l-orange-500', bg: 'bg-orange-50/50', text: 'text-orange-700' },
      cyan: { border: 'border-l-cyan-500', bg: 'bg-cyan-50/50', text: 'text-cyan-700' },
      red: { border: 'border-l-red-500', bg: 'bg-red-50/50', text: 'text-red-700' },
      emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50/50', text: 'text-emerald-700' }
    };
    return mapping[color] || mapping.blue;
  };

  // Helper function to normalize grade for comparison
  const normalizeGradeForComparison = (grade: string): string => {
    // Remove "Grade " prefix and convert to lowercase for comparison
    const normalized = grade.replace(/^Grade\s+/i, '').trim().toLowerCase();
    // Handle special cases
    if (normalized === 'pre-k' || normalized === 'prek') return 'pre-k';
    if (normalized === 'k' || normalized === 'kindergarten') return 'kindergarten';
    return normalized;
  };

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch school info to get grades_offered and school_id
      try {
        const schoolResponse = await schoolAdminApi.school.get();
        const schoolData = schoolResponse.data ?? {};
        const school = (schoolData as { school?: { grades_offered?: string[] } }).school;

        if (school?.grades_offered && Array.isArray(school.grades_offered)) {
          setSchoolGrades(school.grades_offered);
        } else {
          setSchoolGrades(AVAILABLE_GRADES);
        }
      } catch {
        setSchoolGrades(AVAILABLE_GRADES);
      }

      // Load all data in parallel
      const [schedulesRes, periodsRes, roomsRes, teachersRes] = await Promise.all([
        schoolAdminApi.schedules.list(),
        schoolAdminApi.periods.list(),
        schoolAdminApi.rooms.list(),
        schoolAdminApi.teachers.list(),
      ]);

      // Schedules
      {
        const data = schedulesRes.data ?? {};
        const schedulesArr =
          (data as { schedules?: Schedule[] }).schedules ??
          ((Array.isArray(data) ? data : []) as Schedule[]);
        setSchedules(schedulesArr);
      }

      // Periods
      {
        const data = periodsRes.data ?? {};
        const periodsArr =
          (data as { periods?: Period[] }).periods ??
          ((Array.isArray(data) ? data : []) as Period[]);
        setPeriods(periodsArr);
      }

      // Rooms
      try {
        const data = roomsRes.data ?? {};
        const roomsArr =
          (data as { rooms?: Room[] }).rooms ??
          ((Array.isArray(data) ? data : []) as Room[]);
        setRooms(roomsArr);
      } catch {
        setRooms([]);
      }

      // Teachers
      try {
        const data = teachersRes.data ?? {};
        const teacherSchools =
          (data as { teachers?: unknown[] }).teachers ??
          (Array.isArray(data) ? data : []);
        
        type TeacherSchoolRow = {
          id?: string; 
          teacher_id?: string; 
          full_name?: string;
          email?: string;
          phone?: string;
          subjects?: string[];
          grades_assigned?: string[];
          teacher?: { full_name?: string; email?: string; phone?: string; profile_id?: string }; 
          profile?: { id?: string; fullName?: string; full_name?: string; email?: string; phone?: string } 
        };
        const transformedTeachers = (teacherSchools as TeacherSchoolRow[])
          .map((ts): Teacher | null => {
            const teacher = ts.teacher ?? {};
            const profile = ts.profile ?? {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const profileId = ts.id ?? profile.id ?? ts.teacher_id ?? (teacher as any).profile_id;
            
            if (!profileId) {
              return null;
            }

            const transformed: Teacher = {
              id: profileId,
              full_name: ts.full_name ?? profile.full_name ?? profile.fullName ?? teacher.full_name ?? 'Unknown',
              email: ts.email ?? teacher.email ?? profile.email ?? '',
              phone: (ts.phone ?? teacher.phone ?? profile.phone ?? '') as string,
              subjects: ts.subjects || [],
              grades_assigned: ts.grades_assigned || [],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              teacher_schools: (ts as any).teacher_schools || []
            };

            if (transformed.full_name === 'Unknown' || !transformed.email) {
              return null;
            }
            return transformed;
          })
          .filter((t): t is Teacher => t !== null);
        setTeachers(transformedTeachers);
      } catch {
        setTeachers([]);
      }

      setClasses([]);

    } catch (error) {
      console.error('Error loading scheduling data:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData depends on schoolInfo.id only
  }, [schoolInfo?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter schedules
  const filteredSchedules = schedules.filter((schedule: Schedule) => {
    const matchesGrade = selectedGrade === 'all' || schedule.grade === selectedGrade;
    const matchesSearch = searchTerm === '' || 
      schedule.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.teacher?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.room?.room_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = !schedule.academic_year || schedule.academic_year === selectedAcademicYear;
    
    return matchesGrade && matchesSearch && matchesYear && schedule.is_active;
  });

  // Section 5: Add Schedule Modal Derivatives
  const uniqueSubjects = [...new Set(schedules.map((s: Schedule) => s.subject))].filter(Boolean).sort();
  
  const sectionsForGrade = classes.filter(c => c.grade === scheduleForm.grade && c.class_name);
  
  const calculateDuration = (p: Period | undefined | null) => {
    if (!p) return 0;
    const s = new Date(`2000-01-01T${p.start_time}`);
    const e = new Date(`2000-01-01T${p.end_time}`);
    return (e.getTime() - s.getTime()) / 3600000;
  };
  
  const getTeacherLoad = (tId: string) => {
    return schedules
      .filter(s => s.teacher_id === tId)
      .reduce((acc, s) => {
        const p = periods.find(per => per.id === s.period_id);
        return acc + calculateDuration(p);
      }, 0);
  };
  
  const isTeacherAssigned = (t: Teacher, sub: string, gr: string) => {
    if (!sub || !gr) return true;
    
    const normalizeGrade = (g: string) => g.toLowerCase().replace(/grade\s+/g, '').trim();
    const normGr = normalizeGrade(gr);
    const normSub = sub.toLowerCase().trim();

    // Check direct properties if they exist (preferred for this dashboard)
    const subjects = t.subjects || [];
    const grades = t.grades_assigned || [];
    
    const hasSubject = subjects.some((s: string) => s.toLowerCase().trim() === normSub);
    const hasGrade = grades.some((g: string) => normalizeGrade(g) === normGr);
    
    if (hasSubject && hasGrade) return true;

    // Fallback: Check teacher_schools array
    const schoolData = t.teacher_schools?.[0];
    if (schoolData) {
      const tsHasSub = schoolData.subjects.some((s: string) => s.toLowerCase().trim() === normSub);
      const tsHasGr = schoolData.grades_assigned.some((g: string) => normalizeGrade(g) === normGr);
      if (tsHasSub && tsHasGr) return true;
    }
    
    return false;
  };
  
  const filteredTeachers = (scheduleForm.subject && scheduleForm.grade)
    ? teachers.filter(t => isTeacherAssigned(t, scheduleForm.subject, scheduleForm.grade))
    : teachers;
    
  // Final safety: If no teachers match the specific filter, show all teachers 
  // but sorted by load, so the user isn't stuck with an empty list.
  const displayTeachers = filteredTeachers.length > 0 ? filteredTeachers : teachers;
    
  const isTeacherAvailable = (tId: string | null | undefined, day: string, periodId: string) => {
    if (!tId || !day || !periodId) return true;
    return !schedules.some(s => s.teacher_id === tId && s.day_of_week === day && s.period_id === periodId && s.id !== editingSchedule?.id);
  };
  
  const isRoomAvailable = (rId: string | null | undefined, day: string, periodId: string) => {
    if (!rId || !day || !periodId) return true;
    return !schedules.some(s => s.room_id === rId && s.day_of_week === day && s.period_id === periodId && s.id !== editingSchedule?.id);
  };
  
  let suggestedTeacher: Teacher | null = null;
  if (scheduleForm.subject && scheduleForm.grade && scheduleForm.day_of_week && scheduleForm.period_id) {
    const availableFiltered = filteredTeachers.filter(t => isTeacherAvailable(t.id, scheduleForm.day_of_week, scheduleForm.period_id));
    if (availableFiltered.length > 0) {
      suggestedTeacher = availableFiltered.sort((a, b) => getTeacherLoad(a.id) - getTeacherLoad(b.id))[0];
    }
  }
  
  let conflictWarning: string | null = null;
  if (scheduleForm.teacher_id && !isTeacherAvailable(scheduleForm.teacher_id, scheduleForm.day_of_week, scheduleForm.period_id)) {
    const conflict = schedules.find(s => s.teacher_id === scheduleForm.teacher_id && s.day_of_week === scheduleForm.day_of_week && s.period_id === scheduleForm.period_id && s.id !== editingSchedule?.id);
    if (conflict) {
      const t = teachers.find(t => t.id === scheduleForm.teacher_id);
      const p = periods.find(p => p.id === scheduleForm.period_id);
      conflictWarning = `${t?.full_name} is already assigned to ${conflict.subject} – ${conflict.grade} on ${conflict.day_of_week} Period ${p?.period_number}. Please choose a different teacher or period.`;
    }
  } else if (scheduleForm.room_id && !isRoomAvailable(scheduleForm.room_id, scheduleForm.day_of_week, scheduleForm.period_id)) {
    const conflict = schedules.find(s => s.room_id === scheduleForm.room_id && s.day_of_week === scheduleForm.day_of_week && s.period_id === scheduleForm.period_id && s.id !== editingSchedule?.id);
    if (conflict) {
      const r = rooms.find(r => r.id === scheduleForm.room_id);
      const p = periods.find(p => p.id === scheduleForm.period_id);
      conflictWarning = `Room ${r?.room_number} is already booked for ${conflict.subject} – ${conflict.grade} on ${conflict.day_of_week} Period ${p?.period_number}. Please choose a different room.`;
    }
  }

  // Handle schedule operations
  const handleCreateSchedule = async () => {
    // Prepare request body - convert empty strings to null for optional fields
    const requestBody = {
      ...scheduleForm,
      teacher_id: scheduleForm.teacher_id || null,
      period_id: scheduleForm.period_id || null,
      room_id: scheduleForm.room_id || null,
      class_id: scheduleForm.class_id || null,
      notes: scheduleForm.notes || null
    };
    
    try {
      await schoolAdminApi.schedules.create(requestBody);
      await loadData();
      
      if (scheduleForm.period_id) {
        const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number);
        const currentIndex = sortedPeriods.findIndex(p => p.id === scheduleForm.period_id);
        if (currentIndex !== -1 && currentIndex < sortedPeriods.length - 1) {
          const nextPeriod = sortedPeriods[currentIndex + 1];
          setScheduleForm(prev => ({
            ...prev,
            period_id: nextPeriod.id,
            start_time: nextPeriod.start_time,
            end_time: nextPeriod.end_time,
            notes: ''
          }));
          return;
        }
      }
      
      setScheduleDialogOpen(false);
      resetScheduleForm();
    } catch (error) {
      console.error('Error creating schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create schedule';
      toast.error(errorMessage);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;

    try {
      const requestBody = {
        ...scheduleForm,
        teacher_id: scheduleForm.teacher_id || null,
        period_id: scheduleForm.period_id || null,
        room_id: scheduleForm.room_id || null,
        class_id: scheduleForm.class_id || null,
        notes: scheduleForm.notes || null
      };

      await schoolAdminApi.schedules.update(editingSchedule.id, requestBody);
      await loadData();
      setScheduleDialogOpen(false);
      setEditingSchedule(null);
      resetScheduleForm();
    } catch (error) {
      console.error('Error updating schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update schedule';
      toast.error(errorMessage);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!(await confirmDialog({
      title: 'Delete this schedule?',
      confirmText: 'Delete',
      variant: 'danger',
    }))) return;

    try {
      await schoolAdminApi.schedules.delete(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule';
      toast.error(errorMessage);
    }
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      class_id: schedule.class_id || '',
      teacher_id: schedule.teacher_id || '',
      subject: schedule.subject,
      grade: schedule.grade,
      day_of_week: schedule.day_of_week,
      period_id: schedule.period_id || '',
      room_id: schedule.room_id || '',
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      academic_year: schedule.academic_year,
      notes: schedule.notes || ''
    });
    setScheduleDialogOpen(true);
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      class_id: '',
      teacher_id: '',
      subject: '',
      grade: '',
      day_of_week: 'Monday',
      period_id: '',
      room_id: '',
      start_time: '',
      end_time: '',
      academic_year: '2024-25',
      notes: ''
    });
    setEditingSchedule(null);
    setLockedFields({});
  };

  const handleAddScheduleGrid = (day: string, periodId: string) => {
    const period = periods.find(p => p.id === periodId);
    setScheduleForm({
      class_id: '',
      teacher_id: '',
      subject: '',
      grade: '',
      day_of_week: day,
      period_id: periodId,
      room_id: '',
      start_time: period ? period.start_time : '',
      end_time: period ? period.end_time : '',
      academic_year: '2024-25',
      notes: ''
    });
    setLockedFields({ day_of_week: true, period_id: true });
    setEditingSchedule(null);
    setScheduleDialogOpen(true);
  };

  // Handle period operations
  const handleCreatePeriod = async () => {
    try {
      await schoolAdminApi.periods.create(periodForm);
      await loadData();
      setPeriodForm({ period_number: (periodForm.period_number || 1) + 1, start_time: periodForm.end_time, end_time: '', is_active: true });
      setEditingPeriod(null);
    } catch (error) {
      console.error('Error creating period:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      toast.error(err.response?.data?.error ?? err.response?.data?.details ?? 'Failed to create period');
    }
  };

  const handleUpdatePeriod = async () => {
    if (!editingPeriod) return;
    if (!periodForm.start_time || !periodForm.end_time) return;

    try {
      await schoolAdminApi.periods.update(editingPeriod.id, periodForm);
      await loadData();
      setPeriodForm({ period_number: 1, start_time: '', end_time: '', is_active: true });
      setEditingPeriod(null);
    } catch (error) {
      console.error('Error updating period:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      toast.error(err.response?.data?.error ?? err.response?.data?.details ?? 'Failed to update period');
    }
  };

  const handleDeletePeriod = async (id: string) => {
    if (!id) {
      toast.error('Period ID is missing');
      return;
    }

    if (!(await confirmDialog({
      title: 'Delete this period?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    }))) return;

    try {
      await schoolAdminApi.periods.delete(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting period:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      toast.error(err.response?.data?.error ?? err.response?.data?.details ?? (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

   
  const handleEditPeriod = (period: Period) => {
    setEditingPeriod(period);
    setPeriodForm({
      period_number: period.period_number || 1,
      start_time: period.start_time || '',
      end_time: period.end_time || '',
      is_active: period.is_active !== undefined ? period.is_active : true
    });
  };

  // Pre-fill form when opening Manage Periods if not editing an existing one
  useEffect(() => {
    if (periodDialogOpen && !editingPeriod && periods.length > 0) {
      const sorted = [...periods].sort((a, b) => a.period_number - b.period_number);
      const last = sorted[sorted.length - 1];
      if (!last.start_time || !last.end_time) return;
      
      const startObj = new Date(`2000-01-01T${last.start_time}`);
      const endObj = new Date(`2000-01-01T${last.end_time}`);
      const durationMs = endObj.getTime() - startObj.getTime();
      
      const newStart = new Date(`2000-01-01T${last.end_time}`);
      const newEnd = new Date(newStart.getTime() + durationMs);
      
      const formatTimeForInput = (d: Date) => {
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      };

      setPeriodForm({
        period_number: last.period_number + 1,
        start_time: formatTimeForInput(newStart),
        end_time: formatTimeForInput(newEnd),
        is_active: true
      });
    }
  }, [periodDialogOpen, periods, editingPeriod]);

  const handleInsertBreak = async (periodId: string, durationMin: number) => {
    if (!durationMin || durationMin <= 0) return;
    try {
      const selectedPeriod = periods.find(p => p.id === periodId);
      if (!selectedPeriod) return;
      
      const periodsToShift = periods.filter(p => p.period_number > selectedPeriod.period_number);
      
      for (const p of periodsToShift) {
        const startMs = new Date(`2000-01-01T${p.start_time}`).getTime() + durationMin * 60000;
        const endMs = new Date(`2000-01-01T${p.end_time}`).getTime() + durationMin * 60000;
        
        await schoolAdminApi.periods.update(p.id, {
          ...p,
          start_time: new Date(startMs).toTimeString().substring(0,5),
          end_time: new Date(endMs).toTimeString().substring(0,5)
        });
      }
      await loadData();
      setBreakDuration({...breakDuration, [periodId]: ''});
    } catch(err) {
      console.error(err);
      toast.error('Error inserting break');
    }
  };

  const handleUseTemplate = async (template: 'standard' | 'extended' | 'halfday') => {
    if (!(await confirmDialog({
      title: 'Apply this template?',
      description: 'This will delete all existing periods.',
      confirmText: 'Apply',
      variant: 'danger',
    }))) return;
    try {
      setLoading(true);
      await Promise.all(periods.map(p => schoolAdminApi.periods.delete(p.id)));
      
      const config = [];
      let currentMs = new Date('2000-01-01T09:00').getTime();
      let count = 8;
      let durationMin = 45;
      
      if (template === 'extended') {
        count = 6;
        durationMin = 60;
      } else if (template === 'halfday') {
        currentMs = new Date('2000-01-01T08:00').getTime();
        count = 5;
        durationMin = 40;
      }

      for (let i = 1; i <= count; i++) {
        const endMs = currentMs + durationMin * 60000;
        config.push({
          period_number: i,
          start_time: new Date(currentMs).toTimeString().substring(0,5),
          end_time: new Date(endMs).toTimeString().substring(0,5),
          is_active: true
        });
        currentMs = endMs;
      }

      for (const p of config) {
        await schoolAdminApi.periods.create(p);
      }
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Error applying template');
    } finally {
      setLoading(false);
    }
  };

  const validatePeriodTimes = (start: string, end: string) => {
    if (!start || !end) return 'Required';
    const s = new Date(`2000-01-01T${start}`).getTime();
    const e = new Date(`2000-01-01T${end}`).getTime();
    const minTime = new Date(`2000-01-01T06:00`).getTime();
    const maxTime = new Date(`2000-01-01T20:00`).getTime();
    
    if (s >= e) return 'End time must be after start time';
    if (s < minTime || e > maxTime) return 'Must be between 6:00 AM and 8:00 PM';
    return null;
  };

  const periodError = validatePeriodTimes(periodForm.start_time, periodForm.end_time);

  const resetPeriodForm = () => {
    setPeriodForm({ period_number: 1, start_time: '', end_time: '', is_active: true });
    setEditingPeriod(null);
  };

  // Handle room operations
  const handleCreateRoom = async () => {
    try {
      await schoolAdminApi.rooms.create({
        ...roomForm,
        capacity: roomForm.capacity ? parseInt(roomForm.capacity) : null
      });
      await loadData();
      setRoomDialogOpen(false);
      setRoomForm({
        room_number: '',
        room_name: '',
        room_type: 'Regular Classroom',
        capacity: '',
        location: '',
        facilities: [],
        is_active: true
      });
      setEditingRoom(null);
    } catch (error) {
      console.error('Error creating room:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      toast.error(err.response?.data?.error ?? err.response?.data?.details ?? 'Failed to create room');
    }
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom) return;

    try {
      await schoolAdminApi.rooms.update(editingRoom.id, {
        ...roomForm,
        capacity: roomForm.capacity ? parseInt(roomForm.capacity) : null
      });
      await loadData();
      setRoomDialogOpen(false);
      setRoomForm({
        room_number: '',
        room_name: '',
        room_type: 'Regular Classroom',
        capacity: '',
        location: '',
        facilities: [],
        is_active: true
      });
      setEditingRoom(null);
    } catch (error) {
      console.error('Error updating room:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      toast.error(err.response?.data?.error ?? err.response?.data?.details ?? 'Failed to update room');
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!(await confirmDialog({
      title: 'Delete this room?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    }))) return;

    try {
      await schoolAdminApi.rooms.delete(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting room:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      toast.error(err.response?.data?.error ?? err.response?.data?.details ?? 'Failed to delete room');
    }
  };

  // Handle sync schedules to teachers
  // Copy and Repeat Automations Handlers
  const handleCopyToDay = async () => {
    if (!scheduleToCopy || !targetDay) return;
    setIsCopying(true);
    try {
      // Basic check for existing schedule in that slot
      const hasConflict = schedules.some(s => 
        s.day_of_week === targetDay && 
        s.period_id === scheduleToCopy.period_id && 
        (s.teacher_id === scheduleToCopy.teacher_id || s.room_id === scheduleToCopy.room_id)
      );
      
      if (hasConflict) {
        toast.warning(`Cannot copy to ${targetDay}: A conflict exists in that period.`);
        return;
      }

      await schoolAdminApi.schedules.create({
        subject: scheduleToCopy.subject,
        grade: scheduleToCopy.grade,
        day_of_week: targetDay,
        period_id: scheduleToCopy.period_id,
        teacher_id: scheduleToCopy.teacher_id,
        room_id: scheduleToCopy.room_id,
        class_id: scheduleToCopy.class_id,
        start_time: scheduleToCopy.start_time,
        end_time: scheduleToCopy.end_time,
        academic_year: scheduleToCopy.academic_year,
        notes: scheduleToCopy.notes
      });
      
      await loadData();
      setCopyScheduleDialogOpen(false);
      setScheduleToCopy(null);
      setTargetDay('');
    } catch (error) {
      console.error('Error copying schedule:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to copy schedule');
    } finally {
      setIsCopying(false);
    }
  };

  const handleRepeatAcrossWeek = async (schedule: Schedule) => {
    const confirmRepeat = await confirmDialog({
      title: 'Repeat across the week?',
      description: `Repeat "${schedule.subject}" across all remaining days at the same time.`,
      confirmText: 'Repeat',
    });
    if (!confirmRepeat) return;

    setIsCopying(true);
    let successCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const otherDays = DAYS_OF_WEEK.filter(d => d !== schedule.day_of_week);

    for (const day of otherDays) {
      const alreadyExists = schedules.some(s => 
        s.day_of_week === day && 
        s.period_id === schedule.period_id
      );

      if (alreadyExists) {
        skippedCount++;
        continue;
      }

      try {
        await schoolAdminApi.schedules.create({
          subject: schedule.subject,
          grade: schedule.grade,
          day_of_week: day,
          period_id: schedule.period_id,
          teacher_id: schedule.teacher_id,
          room_id: schedule.room_id,
          class_id: schedule.class_id,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          academic_year: schedule.academic_year,
          notes: schedule.notes
        });
        successCount++;
      } catch (error) {
        errors.push(`${day}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    await loadData();
    setIsCopying(false);
    if (errors.length > 0) {
      toast.warning(`Repeat complete: ${successCount} days added, ${skippedCount} skipped, ${errors.length} error(s).`);
    } else {
      toast.success(`Repeat complete: ${successCount} days added, ${skippedCount} skipped.`);
    }
  };

  const handleCopyEntireDay = async () => {
    if (!sourceDayToCopy || targetDays.length === 0) return;
    setIsCopying(true);
    
    const daySchedules = schedules.filter(s => s.day_of_week === sourceDayToCopy && s.is_active);
    if (daySchedules.length === 0) {
      toast.warning(`No schedules found for ${sourceDayToCopy}`);
      setIsCopying(false);
      return;
    }

    let totalSuccess = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const targetDay of targetDays) {
      for (const schedule of daySchedules) {
        const hasConflict = schedules.some(s => 
          s.day_of_week === targetDay && 
          s.period_id === schedule.period_id
        );

        if (hasConflict) {
          totalSkipped++;
          continue;
        }

        try {
          await schoolAdminApi.schedules.create({
            subject: schedule.subject,
            grade: schedule.grade,
            day_of_week: targetDay,
            period_id: schedule.period_id,
            teacher_id: schedule.teacher_id,
            room_id: schedule.room_id,
            class_id: schedule.class_id,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            academic_year: schedule.academic_year,
            notes: schedule.notes
          });
          totalSuccess++;
        } catch (error) {
          errors.push(`${targetDay} Period ${periods.find(p => p.id === schedule.period_id)?.period_number}: ${error instanceof Error ? error.message : 'Error'}`);
        }
      }
    }

    await loadData();
    setIsCopying(false);
    if (errors.length === 0) {
      setCopyDayDialogOpen(false);
      setSourceDayToCopy(null);
      setTargetDays([]);
      toast.success(`Successfully copied entire day! Total: ${totalSuccess} items added, ${totalSkipped} slots skipped due to existing entries.`);
    } else {
      setCopyResults({ success: totalSuccess, skipped: totalSkipped, errors });
    }
  };

   
  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({
      room_number: room.room_number || '',
      room_name: room.room_name || '',
      room_type: room.room_type || 'Regular Classroom',
      capacity: room.capacity ? String(room.capacity) : '',
      location: room.location || '',
      facilities: room.facilities || [],
      is_active: room.is_active !== undefined ? room.is_active : true
    });
  };

  const resetRoomForm = () => {
    setRoomForm({
      room_number: '',
      room_name: '',
      room_type: 'Regular Classroom',
      capacity: '',
      location: '',
      facilities: [],
      is_active: true
    });
    setEditingRoom(null);
  };

  // Get available grades - filter to only show school's assigned grades
  const getAvailableGrades = () => {
    if (schoolGrades.length > 0) {
      // Filter AVAILABLE_GRADES to only include grades assigned to the school
      const normalizedSchoolGrades = schoolGrades.map((g: string) => normalizeGradeForComparison(g));
      return AVAILABLE_GRADES.filter((grade: string) => {
        const normalizedGrade = normalizeGradeForComparison(grade);
        return normalizedSchoolGrades.includes(normalizedGrade);
      });
    }
    // Fallback to all available grades if school grades not loaded yet
    return AVAILABLE_GRADES;
  };

  const availableGrades = getAvailableGrades();
  
  // Get unique grades from schedules (for filter dropdown)
  const uniqueGradesFromSchedules = [...new Set(schedules.map((s: Schedule) => s.grade))].sort();

  // Format time for display
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Section 7 Logic: Completion Calculation
  const totalPossibleSlots = (periods.length || 1) * GRID_DAYS.length;
  const uniqueGrades = [...new Set(schedules.map((s: Schedule) => s.grade))].filter(Boolean).sort();
  const completionStats = uniqueGrades.map(grade => {
    const filledSlots = new Set(
      schedules
        .filter((s: Schedule) => s.grade === grade && s.is_active)
        .map((s: Schedule) => `${s.day_of_week}-${s.period_id}`)
    ).size;
    
    return {
      grade,
      filled: filledSlots,
      total: totalPossibleSlots,
      percentage: Math.round((filledSlots / (totalPossibleSlots || 1)) * 100)
    };
  });

  // Section 8 Logic: Push to Teachers
  const teachersWithSchedules = teachers.filter(t => 
    schedules.some(s => s.teacher_id === t.id && s.is_active)
  );

  const generatePushPreview = (teacherId: string) => {
    const teacherSchedules = schedules
      .filter(s => s.teacher_id === teacherId && s.is_active)
      .sort((a, b) => {
        const dayOrder = DAYS_OF_WEEK.indexOf(a.day_of_week) - DAYS_OF_WEEK.indexOf(b.day_of_week);
        if (dayOrder !== 0) return dayOrder;
        return a.start_time.localeCompare(b.start_time);
      });
    
    if (teacherSchedules.length === 0) return "No schedules found.";

    let text = "Your Weekly Schedule:\n\n";
    let currentDay = "";
    teacherSchedules.forEach(s => {
      if (s.day_of_week !== currentDay) {
        currentDay = s.day_of_week;
        text += `${currentDay}:\n`;
      }
      text += `  • ${s.subject} - ${s.grade}, ${formatTime(s.start_time)} - ${formatTime(s.end_time)}\n`;
    });
    return text;
  };

  const handlePushToSelectedTeachers = async () => {
    if (selectedTeachersToPush.length === 0) return;
    setIsSyncing(true);
    try {
      await schoolAdminApi.schedules.syncToTeachers({
        teacherIds: selectedTeachersToPush
      });
      
      setLastPushTimestamp(new Date().toLocaleString());
      setPushSuccessSummary(`Notifications successfully sent to ${selectedTeachersToPush.length} teachers.`);
      setTimeout(() => {
        setPushModalOpen(false);
        setPushSuccessSummary(null);
      }, 2500);
      await loadData();
    } catch (error) {
      console.error('Error pushing schedules:', error);
      toast.error('Failed to send notifications');
    } finally {
      setIsSyncing(false);
    }
  };

  // Section 9: Validation
  const runValidation = () => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];

    const activeSchedules = schedules.filter(s => s.is_active && s.academic_year === selectedAcademicYear);
    const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number);

    // Errors: Teacher/Room double-booked
    const teacherUsage: Record<string, string[]> = {};
    const roomUsage: Record<string, string[]> = {};

    activeSchedules.forEach(s => {
      if (s.teacher_id) {
        const key = `${s.day_of_week}-${s.period_id}-${s.teacher_id}`;
        if (!teacherUsage[key]) teacherUsage[key] = [];
        teacherUsage[key].push(`${s.subject} (${s.grade})`);
        if (teacherUsage[key].length > 1) {
          const p = sortedPeriods.find(p => p.id === s.period_id);
          errors.push(`Teacher ${s.teacher?.full_name} is double-booked on ${s.day_of_week} Period ${p?.period_number}`);
        }
      }
      if (s.room_id) {
        const key = `${s.day_of_week}-${s.period_id}-${s.room_id}`;
        if (!roomUsage[key]) roomUsage[key] = [];
        roomUsage[key].push(`${s.subject} (${s.grade})`);
        if (roomUsage[key].length > 1) {
          const p = sortedPeriods.find(p => p.id === s.period_id);
          errors.push(`Room ${s.room?.room_number} is double-booked on ${s.day_of_week} Period ${p?.period_number}`);
        }
      }
    });

    // Warnings: Empty days, Overloaded teachers, Empty period slots
    uniqueGrades.forEach(grade => {
      GRID_DAYS.forEach(day => {
        const hasClass = activeSchedules.some(s => s.grade === grade && s.day_of_week === day);
        if (!hasClass) {
          warnings.push(`Grade ${grade} has no classes scheduled on ${day}`);
        }
      });
    });

    teachers.forEach(teacher => {
      const load = getTeacherLoad(teacher.id);
      if (load > 30) {
        warnings.push(`Teacher ${teacher.full_name} is overloaded (${load.toFixed(1)} hrs/wk)`);
      }
    });

    sortedPeriods.forEach(period => {
      GRID_DAYS.forEach(day => {
        const isUsed = activeSchedules.some(s => s.day_of_week === day && s.period_id === period.id);
        if (!isUsed) {
          warnings.push(`No classes scheduled for any grade on ${day} Period ${period.period_number}`);
        }
      });
    });

    // Info: Stats, Unused teachers/rooms
    info.push(`Total active schedules for ${selectedAcademicYear}: ${activeSchedules.length}`);
    const unusedTeachers = teachers.filter(t => !activeSchedules.some(s => s.teacher_id === t.id));
    if (unusedTeachers.length > 0) info.push(`${unusedTeachers.length} teachers have no classes assigned this week.`);
    
    const unusedRooms = rooms.filter(r => !activeSchedules.some(s => s.room_id === r.id));
    if (unusedRooms.length > 0) info.push(`${unusedRooms.length} rooms are completely unused.`);

    setValidationResults({ 
      errors: [...new Set(errors)], 
      warnings: [...new Set(warnings)], 
      info 
    });
    setValidationModalOpen(true);
  };

  // Section 10: Export logic
  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.text(`School Timetable - ${selectedAcademicYear}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Grade: ${selectedGrade === 'all' ? 'All Grades' : selectedGrade}`, 14, 22);

      const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number);
      const head = [['Day \\ Period', ...sortedPeriods.map(p => `P${p.period_number}`)]];
      const body = GRID_DAYS.map(day => {
        const row = [day];
        sortedPeriods.forEach(period => {
          const cellSchedules = filteredSchedules.filter(s => s.day_of_week === day && s.period_id === period.id);
          row.push(cellSchedules.map(s => `${s.subject}\n(${s.grade})`).join('\n---\n'));
        });
        return row;
      });

      autoTable(doc, {
        head,
        body,
        startY: 30,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`timetable-${selectedGrade}-${selectedAcademicYear}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Schedule');

      worksheet.columns = [
        { header: 'Day', key: 'day', width: 15 },
        { header: 'Start Time', key: 'start', width: 12 },
        { header: 'End Time', key: 'end', width: 12 },
        { header: 'Subject', key: 'subject', width: 20 },
        { header: 'Grade', key: 'grade', width: 15 },
        { header: 'Teacher', key: 'teacher', width: 25 },
        { header: 'Room', key: 'room', width: 15 },
      ];

      filteredSchedules.forEach(s => {
        worksheet.addRow({
          day: s.day_of_week,
          start: s.start_time,
          end: s.end_time,
          subject: s.subject,
          grade: s.grade,
          teacher: s.teacher?.full_name || 'N/A',
          room: s.room?.room_number || 'N/A'
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `schedule-${selectedAcademicYear}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel Export Error:', error);
      toast.error('Failed to generate Excel file');
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-gray-50/50">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading timetable...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50/30">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Class Scheduling</h1>
              <p className="text-xs text-gray-500 mt-0.5">Build and manage your school&apos;s weekly timetable</p>
            </div>
          </div>

          {/* Right: utilities */}
          <div className="flex items-center gap-2">
            <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
              <SelectTrigger className="w-[120px] h-9 text-sm border-gray-200 bg-gray-50 hover:bg-gray-100">
                <History className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACADEMIC_YEARS.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-gray-200" />

            <Button variant="ghost" size="sm" onClick={runValidation} className="h-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-sm gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Validate
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-sm gap-1.5">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="h-4 w-4 mr-2" />Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />Print View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-6 w-px bg-gray-200" />

            <Button
              size="sm"
              onClick={() => {
                const ids = teachersWithSchedules.map(t => t.id);
                setSelectedTeachersToPush(ids);
                setPushSuccessSummary(null);
                setPushModalOpen(true);
              }}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-sm gap-1.5"
            >
              {isSyncing ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Pushing...</>
              ) : (
                <><Bell className="h-4 w-4" />Push to Teachers</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-2">
        <Button size="sm" onClick={() => setScheduleDialogOpen(true)} className="h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-sm gap-1.5">
          <Plus className="h-3.5 w-3.5" />Add Schedule
        </Button>
        <div className="h-5 w-px bg-gray-200 mx-1" />
        <Button variant="ghost" size="sm" onClick={() => setPeriodDialogOpen(true)} className="h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-sm gap-1.5">
          <Clock className="h-3.5 w-3.5" />Manage Periods
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRoomDialogOpen(true)} className="h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-sm gap-1.5">
          <Building2 className="h-3.5 w-3.5" />Manage Rooms
        </Button>
      </div>

      {showWizard ? (
        <div className="flex items-center justify-center p-8 min-h-[70vh]">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Set up your timetable</h2>
              <p className="text-gray-500 mt-1.5 text-sm">Complete these steps to start building your schedule</p>
            </div>
            <div className="space-y-3">
              {[
                { step: 1, title: 'Add school periods', desc: 'Define daily time slots (e.g. Period 1: 9:00 – 9:45 AM)', done: periods.length > 0, action: () => setPeriodDialogOpen(true), label: periods.length > 0 ? 'Edit Periods' : 'Add Periods' },
                { step: 2, title: 'Add classrooms', desc: 'Set up rooms where classes take place', done: rooms.length > 0, action: () => setRoomDialogOpen(true), label: rooms.length > 0 ? 'Edit Rooms' : 'Add Rooms' },
              ].map(({ step, title, desc, done, action, label }) => (
                <div key={step} className={`flex items-center gap-4 p-4 rounded-xl border-2 bg-white transition-all ${done ? 'border-green-100 bg-green-50/30' : 'border-gray-100 hover:border-blue-100 hover:bg-blue-50/20'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${done ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {done ? <CheckCircle2 className="w-5 h-5" /> : step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${done ? 'text-green-700' : 'text-gray-900'}`}>{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <Button size="sm" variant={done ? 'outline' : 'default'} onClick={action} className={`text-xs h-8 flex-shrink-0 ${done ? '' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    {label}
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => setShowWizard(false)}
                disabled={periods.length === 0}
                className="w-full mt-2 h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm shadow-blue-200 rounded-xl gap-2"
              >
                Start Building Timetable <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
      <div className="p-6 space-y-4">
      <Tabs defaultValue="grid" className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-white border border-gray-200 shadow-sm rounded-lg p-1">
            <TabsTrigger value="grid" className="rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-sm">Grid View</TabsTrigger>
            <TabsTrigger value="list" className="rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-sm">Schedule List</TabsTrigger>
            <TabsTrigger value="workload" className="rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-sm">Teacher Workload</TabsTrigger>
          </TabsList>

          {/* Inline filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-[150px] h-9 text-sm bg-white border-gray-200 shadow-sm">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {uniqueGradesFromSchedules.map((grade: string) => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search subject, teacher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 w-56 text-sm bg-white border-gray-200 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Grid View Tab */}
        <TabsContent value="grid" className="space-y-4">
          {/* Completion Tracker */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowCompletionTracker(!showCompletionTracker)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/80 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-800">Completion Tracker</span>
                <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5 font-medium">
                  {completionStats.length} grades
                </span>
              </div>
              {showCompletionTracker ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
            {showCompletionTracker && (
              <div className="px-5 pb-4 pt-1 border-t border-gray-50">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mt-3">
                  {completionStats.map(stat => (
                    <button
                      key={stat.grade}
                      className="text-left group p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all"
                      onClick={() => {
                        setSelectedGrade(stat.grade);
                        window.scrollTo({ top: document.getElementById('grid-card')?.offsetTop || 0, behavior: 'smooth' });
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-700 group-hover:text-blue-700 truncate">{stat.grade}</span>
                        <span className={`text-xs font-bold tabular-nums ${stat.percentage === 100 ? 'text-green-600' : 'text-gray-400'}`}>{stat.percentage}%</span>
                      </div>
                      <Progress value={stat.percentage} className="h-1.5" />
                      <p className="text-[10px] text-gray-400 mt-1.5">{stat.filled}/{stat.total} slots</p>
                    </button>
                  ))}
                  {completionStats.length === 0 && (
                    <div className="col-span-full py-6 text-center text-sm text-gray-400">
                      No schedules yet — add one to start tracking.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Grid View */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" id="grid-card">
            <div className="overflow-x-auto w-full">
              <div className="min-w-max">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
                        <TableHead className="w-28 sticky left-0 bg-gray-50/80 z-20 border-r border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider shadow-[1px_0_0_0_#f3f4f6]">
                          Day
                        </TableHead>
                        {[...periods].sort((a, b) => a.period_number - b.period_number).map((period) => (
                          <TableHead key={period.id} className="min-w-[200px] text-center border-r border-gray-100 py-3 px-3">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Period {period.period_number}</div>
                            <div className="text-xs text-gray-400 font-normal mt-0.5">
                              {formatTime(period.start_time)} – {formatTime(period.end_time)}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {GRID_DAYS.map((day, dayIdx) => (
                        <TableRow key={day} className={`hover:bg-transparent ${dayIdx < GRID_DAYS.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <TableCell className="sticky left-0 bg-white z-10 border-r border-gray-100 align-middle shadow-[1px_0_0_0_#f3f4f6] group/row py-3 px-3">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{day.slice(0,3)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-md"
                                onClick={() => {
                                  setSourceDayToCopy(day);
                                  setTargetDays([]);
                                  setCopyResults(null);
                                  setCopyDayDialogOpen(true);
                                }}
                                title="Copy entire day"
                              >
                                <ClipboardCopy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          {[...periods].sort((a, b) => a.period_number - b.period_number).map(period => {
                            const cellSchedules = filteredSchedules.filter(s => s.day_of_week === day && s.period_id === period.id);
                            return (
                              <TableCell key={`${day}-${period.id}`} className="border-r border-gray-50 p-2 align-top min-h-28 relative group bg-white">
                                {cellSchedules.length > 0 ? (
                                  <div className="space-y-2 flex flex-col min-h-24">
                                    {cellSchedules.map(schedule => {
                                      const colorClasses = getColorClasses(getSubjectColor(schedule.subject));
                                      return (
                                        <div
                                          key={schedule.id}
                                          className={`rounded-lg p-2.5 transition-all group/card relative border-l-[3px] shadow-sm hover:shadow-md cursor-pointer ${colorClasses.border} ${colorClasses.bg}`}
                                          onClick={() => handleEditSchedule(schedule)}
                                        >
                                          <div className="flex justify-between items-start gap-1">
                                            <span className={`font-semibold text-xs leading-tight ${colorClasses.text}`}>
                                              {schedule.subject}
                                            </span>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-5 w-5 -mt-0.5 -mr-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity rounded hover:bg-white/80 flex-shrink-0"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <MoreVertical className="h-3 w-3 text-gray-500" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="w-44 shadow-lg">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setScheduleToCopy(schedule); setTargetDay(''); setCopyScheduleDialogOpen(true); }}>
                                                  <Copy className="h-3.5 w-3.5 mr-2" />Copy to day
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRepeatAcrossWeek(schedule); }}>
                                                  <Repeat className="h-3.5 w-3.5 mr-2" />Repeat across week
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditSchedule(schedule); }}>
                                                  <Edit className="h-3.5 w-3.5 mr-2" />Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id); }}>
                                                  <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                          <div className="mt-1.5 space-y-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="text-[10px] font-semibold bg-white/70 text-gray-600 rounded px-1.5 py-0.5 border border-white/50">
                                                {schedule.grade}
                                              </span>
                                              {schedule.room?.room_number && (
                                                <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                                                  <MapPin className="h-2.5 w-2.5" />{schedule.room.room_number}
                                                </span>
                                              )}
                                            </div>
                                            {schedule.teacher?.full_name && (
                                              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                                <div className="w-4 h-4 rounded-full bg-white/80 border border-white flex items-center justify-center text-[8px] font-bold text-gray-600 flex-shrink-0">
                                                  {schedule.teacher.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="truncate">{schedule.teacher.full_name}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    <button
                                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 hover:text-blue-600 py-1 px-2 rounded border border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 w-full mt-auto flex items-center justify-center gap-1"
                                      onClick={() => handleAddScheduleGrid(day, period.id)}
                                    >
                                      <Plus className="h-3 w-3" /> Add
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-all w-full min-h-24 flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-gray-300 hover:text-blue-500"
                                    onClick={() => handleAddScheduleGrid(day, period.id)}
                                  >
                                    <Plus className="h-4 w-4" />
                                    <span className="text-[10px] font-medium">Add class</span>
                                  </button>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
          </div>
        </TabsContent>

        {/* Schedule List Tab */}
        <TabsContent value="list">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">All Schedules</h3>
                <p className="text-xs text-gray-400 mt-0.5">{filteredSchedules.length} entries for {selectedAcademicYear}</p>
              </div>
            </div>
            {filteredSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No schedules found</p>
                <p className="text-xs text-gray-400 mt-1">Add a schedule from the grid or use the + Add Schedule button</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Day</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Teacher</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Room</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules
                    .sort((a: Schedule, b: Schedule) => {
                      const dayOrder = DAYS_OF_WEEK.indexOf(a.day_of_week) - DAYS_OF_WEEK.indexOf(b.day_of_week);
                      if (dayOrder !== 0) return dayOrder;
                      return a.start_time.localeCompare(b.start_time);
                    })
                    .map((schedule: Schedule) => {
                      const colorClasses = getColorClasses(getSubjectColor(schedule.subject));
                      return (
                        <TableRow key={schedule.id} className="hover:bg-gray-50/50 group">
                          <TableCell className="py-3">
                            <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded px-2 py-1">{schedule.day_of_week.slice(0,3)}</span>
                          </TableCell>
                          <TableCell className="py-3 text-xs text-gray-500 font-mono tabular-nums">
                            {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 bg-${getSubjectColor(schedule.subject)}-500`} />
                              <span className={`text-sm font-semibold ${colorClasses.text}`}>{schedule.subject}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs bg-blue-50 text-blue-700 font-medium rounded px-2 py-0.5">{schedule.grade}</span>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-gray-600">{schedule.teacher?.full_name || <span className="text-gray-300 italic text-xs">Unassigned</span>}</TableCell>
                          <TableCell className="py-3 text-sm text-gray-500">{schedule.room?.room_number || <span className="text-gray-300">—</span>}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600" onClick={() => handleEditSchedule(schedule)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50 hover:text-red-500" onClick={() => handleDeleteSchedule(schedule.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Teacher Workload Tab */}
        <TabsContent value="workload">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">Teacher Workload</h3>
              <p className="text-xs text-gray-400 mt-0.5">Weekly periods and hours — {selectedAcademicYear}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Teacher</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subjects</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grades</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Periods</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Hours/wk</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Load</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.length === 0 ? (
                  <TableRow>
                    <td colSpan={7} className="py-12 text-center text-sm text-gray-400">No teachers found</td>
                  </TableRow>
                ) : teachers.map((teacher: Teacher) => {
                  const teacherSchedules = schedules.filter(s => s.teacher_id === teacher.id && s.is_active && (!s.academic_year || s.academic_year === selectedAcademicYear));
                  const hours = getTeacherLoad(teacher.id);
                  const periodsCount = teacherSchedules.length;
                  const teacherSubjects = [...new Set(teacherSchedules.map(s => s.subject))];
                  const teacherGrades = [...new Set(teacherSchedules.map(s => s.grade))];
                  const isOverloaded = hours > 30;
                  const isHigh = hours > 24;

                  return (
                    <TableRow
                      key={teacher.id}
                      className="hover:bg-blue-50/20 cursor-pointer transition-colors group"
                      onClick={() => setSelectedTeacherWorkload(teacher)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {teacher.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{teacher.full_name}</p>
                            <p className="text-[10px] text-gray-400">{teacher.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {teacherSubjects.slice(0, 3).map(s => (
                            <span key={s} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getColorClasses(getSubjectColor(s)).bg} ${getColorClasses(getSubjectColor(s)).text}`}>{s}</span>
                          ))}
                          {teacherSubjects.length === 0 && <span className="text-xs text-gray-300 italic">None</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {teacherGrades.map(g => (
                            <span key={g} className="text-[10px] font-medium bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{g}</span>
                          ))}
                          {teacherGrades.length === 0 && <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <span className="text-sm font-bold text-gray-700">{periodsCount}</span>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <span className={`text-sm font-bold tabular-nums ${isOverloaded ? 'text-red-600' : isHigh ? 'text-orange-500' : 'text-gray-700'}`}>{hours.toFixed(1)}h</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2 w-28">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all ${isOverloaded ? 'bg-red-500' : isHigh ? 'bg-orange-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min((hours / 30) * 100, 100)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold ${isOverloaded ? 'text-red-600' : isHigh ? 'text-orange-500' : 'text-green-600'}`}>
                            {isOverloaded ? 'Over' : isHigh ? 'High' : 'OK'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <ExternalLink className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
      </div>
      )}

      {/* Add/Edit Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => {
        setScheduleDialogOpen(open);
        if (!open) {
          resetScheduleForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogTitle className="sr-only">{editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}</DialogTitle>
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Fill in the details below to {editingSchedule ? 'update the' : 'create a new'} class schedule</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* When */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">When</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Day of Week <span className="text-red-400">*</span></Label>
                  {lockedFields.day_of_week ? (
                    <div className="px-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium h-10 flex items-center text-sm">{scheduleForm.day_of_week}</div>
                  ) : (
                    <Select value={scheduleForm.day_of_week} onValueChange={(value) => setScheduleForm({ ...scheduleForm, day_of_week: value })}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day: string) => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Period <span className="text-red-400">*</span></Label>
                  {lockedFields.period_id ? (
                    <div className="px-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium h-10 flex items-center text-sm">
                      {periods.find((p: Period) => p.id === scheduleForm.period_id)
                        ? `Period ${periods.find((p: Period) => p.id === scheduleForm.period_id)?.period_number}`
                        : ''}
                    </div>
                  ) : (
                    <Select
                      value={scheduleForm.period_id || ''}
                      onValueChange={(value) => {
                        const selectedPeriod = periods.find((p: Period) => p.id === value);
                        setScheduleForm({
                          ...scheduleForm,
                          period_id: value === 'none' ? '' : value,
                          start_time: selectedPeriod ? selectedPeriod.start_time : '',
                          end_time: selectedPeriod ? selectedPeriod.end_time : ''
                        });
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.length > 0 ? periods.map((period: Period) => (
                          <SelectItem key={period.id} value={period.id}>
                            Period {period.period_number} ({formatTime(period.start_time)} – {formatTime(period.end_time)})
                          </SelectItem>
                        )) : (
                          <SelectItem value="none" disabled>No periods available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* What */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">What</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Subject <span className="text-red-400">*</span></Label>
                  <Input
                    id="subject"
                    list="subjects-list"
                    value={scheduleForm.subject}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, subject: e.target.value })}
                    placeholder="e.g., Mathematics"
                    autoComplete="off"
                    className="h-10"
                  />
                  <datalist id="subjects-list">
                    {uniqueSubjects.map(sub => <option key={sub} value={sub} />)}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Grade <span className="text-red-400">*</span></Label>
                    <Select value={scheduleForm.grade || ''} onValueChange={(value) => setScheduleForm({ ...scheduleForm, grade: value, class_id: '' })}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {(availableGrades.length > 0 ? availableGrades : AVAILABLE_GRADES).map((grade) => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {sectionsForGrade.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-gray-700">Section</Label>
                      <Select value={scheduleForm.class_id || ''} onValueChange={(val) => setScheduleForm({ ...scheduleForm, class_id: val === 'none' ? '' : val })}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Section" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectionsForGrade.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Who & Where */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Who & Where</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Teacher</Label>
                  <Select value={scheduleForm.teacher_id || ''} onValueChange={(value) => setScheduleForm({ ...scheduleForm, teacher_id: value === 'none' ? '' : value })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select teacher (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {displayTeachers.length > 0 ? displayTeachers.map((teacher: Teacher) => {
                        const isMatch = (scheduleForm.subject && scheduleForm.grade) ? isTeacherAssigned(teacher, scheduleForm.subject, scheduleForm.grade) : true;
                        return (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            <div className="flex justify-between items-center w-full min-w-[150px]">
                              <div className="flex items-center gap-2">
                                <span>{teacher.full_name}</span>
                                {!isMatch && <Badge variant="outline" className="text-[8px] h-4 py-0 opacity-70">No Match</Badge>}
                              </div>
                              <span className="text-gray-400 text-xs ml-2 tabular-nums">{getTeacherLoad(teacher.id).toFixed(1)}h/wk</span>
                            </div>
                          </SelectItem>
                        );
                      }) : (
                        <SelectItem value="none" disabled>No teachers available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {suggestedTeacher && scheduleForm.teacher_id !== suggestedTeacher.id && (
                    <div className="mt-2 p-2.5 border border-green-200 bg-green-50 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-green-800 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        <span>Suggested: {suggestedTeacher.full_name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] px-2 border-green-300 text-green-700 hover:bg-green-100 whitespace-nowrap"
                        onClick={() => setScheduleForm({...scheduleForm, teacher_id: suggestedTeacher.id})}
                      >
                        Use
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Room</Label>
                  <Select value={scheduleForm.room_id || ''} onValueChange={(value) => setScheduleForm({ ...scheduleForm, room_id: value === 'none' ? '' : value })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select room (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.length > 0 ? rooms.map((room: Room) => {
                        const available = isRoomAvailable(room.id, scheduleForm.day_of_week, scheduleForm.period_id || '');
                        return (
                          <SelectItem key={room.id} value={room.id} disabled={!available}>
                            <div className="flex items-center justify-between w-full min-w-[200px]">
                              <span>{room.room_number}{room.room_name ? ` – ${room.room_name}` : ''}{room.capacity ? ` (${room.capacity})` : ''}</span>
                              <span className={`ml-2 text-[10px] font-medium ${available ? 'text-green-600' : 'text-red-400'}`}>
                                {available ? '✓ Free' : '✗ Taken'}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      }) : (
                        <SelectItem value="none" disabled>No rooms available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                id="notes"
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                placeholder="Any additional information..."
                className="h-10"
              />
            </div>

            {conflictWarning && (
              <div className="p-3.5 border border-red-200 bg-red-50 text-red-800 text-sm flex gap-3 items-start rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                <div>
                  <span className="font-semibold block text-xs mb-0.5 text-red-700">Schedule Conflict Detected</span>
                  <span className="text-xs text-red-600">{conflictWarning}</span>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
            <Button variant="outline" className="h-9" onClick={() => { setScheduleDialogOpen(false); resetScheduleForm(); }}>
              Cancel
            </Button>
            <Button className="h-9 bg-blue-600 hover:bg-blue-700" onClick={editingSchedule ? handleUpdateSchedule : handleCreateSchedule} disabled={!!conflictWarning}>
              {editingSchedule ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Period Dialog */}
      <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogTitle className="sr-only">Manage Periods</DialogTitle>
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Manage Periods</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Define time slots and breaks for your school day</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 font-medium">Templates:</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleUseTemplate('standard')}>8×45m</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleUseTemplate('extended')}>6×60m</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleUseTemplate('halfday')}>5×40m</Button>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Existing Periods */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Current Periods</p>
              {periods.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-center">
                  <Clock className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-500">No periods yet</p>
                  <p className="text-xs text-gray-400 mt-1">Use a template or add a period below</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                  {(() => {
                    const sorted = [...periods].sort((a, b) => a.period_number - b.period_number);
                    const rows = [];
                    for (let i = 0; i < sorted.length; i++) {
                      if (i > 0) {
                        const prevEnd = new Date(`2000-01-01T${sorted[i-1].end_time}`);
                        const currStart = new Date(`2000-01-01T${sorted[i].start_time}`);
                        if (currStart.getTime() > prevEnd.getTime()) {
                          const diffMin = (currStart.getTime() - prevEnd.getTime()) / 60000;
                          rows.push(
                            <div key={`break-${i}`} className="flex items-center justify-between px-4 py-2 bg-amber-50/60">
                              <div className="flex items-center gap-2 text-amber-700">
                                <Coffee className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Break · {diffMin} min</span>
                              </div>
                              <span className="text-xs font-mono text-amber-600">
                                {formatTime(sorted[i-1].end_time)} – {formatTime(sorted[i].start_time)}
                              </span>
                            </div>
                          );
                        }
                      }
                      const period = sorted[i];
                      rows.push(
                        <div key={period.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-violet-600">{period.period_number}</span>
                            </div>
                            <span className="font-mono text-sm text-gray-700 tabular-nums">
                              {formatTime(period.start_time)} – {formatTime(period.end_time)}
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${period.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {period.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3 mr-1">
                              <Input
                                type="number"
                                placeholder="min"
                                className="w-14 h-7 text-xs text-center"
                                value={breakDuration[period.id] || ''}
                                onChange={(e) => setBreakDuration({...breakDuration, [period.id]: e.target.value})}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-2 text-amber-600 border-amber-200 hover:bg-amber-50 whitespace-nowrap"
                                onClick={() => handleInsertBreak(period.id, parseInt(breakDuration[period.id] || '0'))}
                                disabled={!breakDuration[period.id] || parseInt(breakDuration[period.id]) <= 0}
                              >
                                + Break
                              </Button>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleEditPeriod(period)} className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeletePeriod(period.id)} className="h-7 w-7 hover:bg-red-50 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    return rows;
                  })()}
                </div>
              )}
            </div>

            {/* Add / Edit Form */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
                {editingPeriod ? 'Edit Period' : 'Add Period'}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Period #</Label>
                  <Input
                    type="number"
                    value={periodForm.period_number}
                    onChange={(e) => setPeriodForm({ ...periodForm, period_number: parseInt(e.target.value) || 1 })}
                    disabled={periods.length > 0 && !editingPeriod}
                    className="h-10"
                  />
                  {periods.length > 0 && !editingPeriod && <p className="text-[10px] text-gray-400">Auto-assigned</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Start Time</Label>
                  <Input
                    type="time"
                    value={periodForm.start_time}
                    onChange={(e) => setPeriodForm({ ...periodForm, start_time: e.target.value })}
                    disabled={periods.length > 0 && !editingPeriod}
                    className="h-10"
                  />
                  {periods.length > 0 && !editingPeriod && <p className="text-[10px] text-gray-400">Chained from previous</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">End Time</Label>
                  <Input
                    type="time"
                    value={periodForm.end_time}
                    onChange={(e) => setPeriodForm({ ...periodForm, end_time: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>
              {periodError && (
                <p className="text-xs text-red-500 mt-3 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {periodError}
                </p>
              )}
              <div className="flex gap-2 mt-4">
                {editingPeriod && (
                  <Button variant="outline" onClick={resetPeriodForm} className="flex-1 h-9">
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={editingPeriod ? handleUpdatePeriod : handleCreatePeriod}
                  className={`h-9 bg-violet-600 hover:bg-violet-700 ${editingPeriod ? 'flex-1' : 'w-full'}`}
                  disabled={!!periodError}
                >
                  {editingPeriod ? 'Save Changes' : 'Add Period'}
                </Button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <Button className="h-9" onClick={() => setPeriodDialogOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogTitle className="sr-only">Manage Rooms</DialogTitle>
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <DoorOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Manage Rooms</h2>
                <p className="text-xs text-gray-500 mt-0.5">Add and manage classrooms, labs, and other facilities</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Existing Rooms */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Current Rooms <span className="normal-case font-normal text-gray-400">({rooms.length})</span>
              </p>
              {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-center">
                  <DoorOpen className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-500">No rooms yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add your first room below</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                  {rooms.map((room: Room) => {
                    const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                    const bookingsToday = schedules.filter(s => s.room_id === room.id && s.day_of_week === currentDayName).length;
                    return (
                      <div key={room.id} className="p-3.5 border border-gray-100 rounded-xl bg-white hover:shadow-sm transition-shadow flex flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {room.room_number}
                              {room.room_name && <span className="text-gray-400 font-normal ml-1.5 text-xs">({room.room_name})</span>}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {room.room_type || 'Classroom'} · {room.capacity ? `${room.capacity} seats` : 'No cap'} · {room.location || '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => handleEditRoom(room)} className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRoom(room.id)} className="h-7 w-7 hover:bg-red-50 hover:text-red-500">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                          <div className="flex flex-wrap gap-1">
                            {(room.facilities || []).slice(0, 3).map((f, i) => (
                              <span key={i} className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{f}</span>
                            ))}
                            {(room.facilities || []).length > 3 && (
                              <span className="text-[10px] text-gray-400">+{(room.facilities || []).length - 3}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {bookingsToday > 0 && (
                              <span className="text-[10px] text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 font-medium">{bookingsToday} today</span>
                            )}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${room.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {room.is_active ? 'Active' : 'Off'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add / Edit Form */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-gray-700">Room # <span className="text-red-400">*</span></Label>
                      <Input
                        value={roomForm.room_number}
                        onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
                        placeholder="R101"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-gray-700">Room Name</Label>
                      <Input
                        value={roomForm.room_name}
                        onChange={(e) => setRoomForm({ ...roomForm, room_name: e.target.value })}
                        placeholder="Science Lab"
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Room Type</Label>
                    <Select value={roomForm.room_type || 'Regular Classroom'} onValueChange={(val) => setRoomForm({ ...roomForm, room_type: val })}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['Regular Classroom', 'Science Lab', 'Computer Lab', 'Library', 'Gymnasium', 'Art Room', 'Music Room', 'Other'].map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-gray-700">Capacity</Label>
                      <Input
                        type="number"
                        value={roomForm.capacity}
                        onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                        placeholder="30"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-gray-700">Location</Label>
                      <Input
                        value={roomForm.location}
                        onChange={(e) => setRoomForm({ ...roomForm, location: e.target.value })}
                        placeholder="First Floor"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Facilities</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-gray-200 bg-white">
                    {['Projector', 'Air Conditioning', 'Whiteboard', 'Smart Board', 'Computer Terminals', 'Audio System'].map((facility) => {
                      const isSelected = roomForm.facilities?.includes(facility);
                      return (
                        <label key={facility} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-gray-50 text-gray-600'}`}>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            checked={isSelected}
                            onChange={(e) => {
                              const current = roomForm.facilities || [];
                              setRoomForm({ ...roomForm, facilities: e.target.checked ? [...current, facility] : current.filter((f: string) => f !== facility) });
                            }}
                          />
                          <span className="text-xs font-medium">{facility}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                {editingRoom && (
                  <Button variant="outline" onClick={resetRoomForm} className="flex-1 h-9">Cancel</Button>
                )}
                <Button
                  onClick={editingRoom ? handleUpdateRoom : handleCreateRoom}
                  className={`h-9 bg-emerald-600 hover:bg-emerald-700 ${editingRoom ? 'flex-1' : 'w-full'}`}
                >
                  {editingRoom ? 'Save Changes' : 'Add Room'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Individual Schedule Dialog */}
      <Dialog open={copyScheduleDialogOpen} onOpenChange={setCopyScheduleDialogOpen}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogTitle className="sr-only">Copy Schedule</DialogTitle>
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Copy className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Copy Schedule</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[260px]">Copying: <span className="font-medium text-gray-700">{scheduleToCopy?.subject}</span></p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Target Day</Label>
              <Select value={targetDay} onValueChange={setTargetDay}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Choose a day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.filter(d => d !== scheduleToCopy?.day_of_week).map(day => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 leading-relaxed">
              A new entry will be created for {targetDay || 'the selected day'} at the same period. Conflict detection applies.
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
            <Button variant="outline" className="h-9" onClick={() => setCopyScheduleDialogOpen(false)}>Cancel</Button>
            <Button className="h-9 bg-blue-600 hover:bg-blue-700" onClick={handleCopyToDay} disabled={!targetDay || isCopying}>
              {isCopying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Entire Day Dialog */}
      <Dialog open={copyDayDialogOpen} onOpenChange={setCopyDayDialogOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogTitle className="sr-only">Copy Entire Day</DialogTitle>
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <ClipboardCopy className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Copy Entire Day</h2>
                <p className="text-xs text-gray-500 mt-0.5">Clone all of <span className="font-medium text-gray-700">{sourceDayToCopy}</span>&apos;s schedules to other days</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Select Target Days</p>
            <div className="grid grid-cols-2 gap-2">
              {DAYS_OF_WEEK.filter(d => d !== sourceDayToCopy).map(day => {
                const selected = targetDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${selected ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                    onClick={() => setTargetDays(prev => selected ? prev.filter(d => d !== day) : [...prev, day])}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                      {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    {day}
                  </button>
                );
              })}
            </div>

            {copyResults ? (
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">{copyResults.success}</p>
                    <p className="text-[11px] text-green-600">Copied</p>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded-lg">
                    <p className="text-lg font-bold text-orange-600">{copyResults.skipped}</p>
                    <p className="text-[11px] text-orange-500">Skipped</p>
                  </div>
                </div>
                {copyResults.errors.length > 0 && (
                  <div className="text-xs text-red-600 max-h-24 overflow-y-auto border-t border-gray-200 pt-2">
                    <ul className="space-y-1 list-disc pl-4">
                      {copyResults.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setCopyResults(null)}>Dismiss</Button>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700 leading-relaxed">
                Existing schedules in target days will not be overwritten — overlapping slots will be skipped.
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
            <Button variant="outline" className="h-9" onClick={() => setCopyDayDialogOpen(false)}>Cancel</Button>
            <Button className="h-9 bg-indigo-600 hover:bg-indigo-700" onClick={handleCopyEntireDay} disabled={targetDays.length === 0 || isCopying}>
              {isCopying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardCopy className="h-4 w-4 mr-2" />}
              {copyResults ? 'Clone Again' : `Clone to ${targetDays.length || '?'} Day${targetDays.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Push to Teachers Modal */}
      <Dialog open={pushModalOpen} onOpenChange={setPushModalOpen}>
        <DialogContent className="max-w-3xl p-0 gap-0">
          <DialogTitle className="sr-only">Push Schedule to Teachers</DialogTitle>
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Push Schedule to Teachers</h2>
                <p className="text-xs text-gray-500 mt-0.5">Review and send weekly schedule notifications to your staff</p>
              </div>
            </div>
          </div>

          {pushSuccessSummary ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 px-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">Push Complete</h3>
                <p className="text-sm text-gray-500 mt-1">{pushSuccessSummary}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              <div className="px-5 py-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Select Teachers</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setSelectedTeachersToPush(teachersWithSchedules.map(t => t.id))}>All</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setSelectedTeachersToPush([])}>None</Button>
                  </div>
                </div>
                {lastPushTimestamp && (
                  <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Last pushed: {lastPushTimestamp}
                  </div>
                )}
                <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {teachersWithSchedules.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-400">No teachers with active schedules</div>
                  ) : teachersWithSchedules.map((teacher: Teacher) => {
                    const count = schedules.filter(s => s.teacher_id === teacher.id && s.is_active).length;
                    const selected = selectedTeachersToPush.includes(teacher.id);
                    return (
                      <div
                        key={teacher.id}
                        className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${selected ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
                        onClick={() => setSelectedTeachersToPush(prev => prev.includes(teacher.id) ? prev.filter(id => id !== teacher.id) : [...prev, teacher.id])}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                            {selected && <span className="text-white text-[9px] font-bold">✓</span>}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{teacher.full_name}</p>
                            <p className="text-[10px] text-gray-400">{teacher.email}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded px-2 py-0.5">{count} classes</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-5 py-5 space-y-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Notification Preview</p>
                <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-[11px] h-[280px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {selectedTeachersToPush.length > 0
                    ? generatePushPreview(selectedTeachersToPush[0])
                    : <span className="text-gray-500 italic">Select a teacher to preview their notification</span>}
                  {selectedTeachersToPush.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-gray-700 text-gray-600 italic text-[10px]">
                      + {selectedTeachersToPush.length - 1} more notification{selectedTeachersToPush.length > 2 ? 's' : ''}...
                    </div>
                  )}
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg text-[10px] text-amber-700 leading-relaxed">
                  Each selected teacher will receive a real-time in-app notification with their weekly schedule.
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
            <Button variant="outline" className="h-9" onClick={() => setPushModalOpen(false)}>
              {pushSuccessSummary ? 'Close' : 'Cancel'}
            </Button>
            {!pushSuccessSummary && (
              <Button
                className="h-9 bg-blue-600 hover:bg-blue-700"
                onClick={handlePushToSelectedTeachers}
                disabled={selectedTeachersToPush.length === 0 || isSyncing}
              >
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Push to {selectedTeachersToPush.length} Teacher{selectedTeachersToPush.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Results Modal */}
      <Dialog open={validationModalOpen} onOpenChange={setValidationModalOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogTitle className="sr-only">Timetable Validation</DialogTitle>
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Timetable Validation</h2>
                <p className="text-xs text-gray-500 mt-0.5">Analysis for Academic Year {selectedAcademicYear}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-2xl font-bold text-red-600">{validationResults?.errors.length || 0}</p>
                <p className="text-[11px] text-red-500 font-medium mt-0.5">Errors</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-orange-50 border border-orange-100">
                <p className="text-2xl font-bold text-orange-500">{validationResults?.warnings.length || 0}</p>
                <p className="text-[11px] text-orange-500 font-medium mt-0.5">Warnings</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-2xl font-bold text-blue-600">{validationResults?.info.length || 0}</p>
                <p className="text-[11px] text-blue-500 font-medium mt-0.5">Info</p>
              </div>
            </div>

            {/* Errors */}
            {(validationResults?.errors.length || 0) > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Errors
                </p>
                {validationResults?.errors.map((err, i) => (
                  <div key={i} className="px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start gap-2">
                    <span className="text-red-400 flex-shrink-0 mt-0.5">✗</span>
                    {err}
                  </div>
                ))}
              </div>
            )}
            {validationResults?.errors.length === 0 && (
              <div className="px-3.5 py-2.5 bg-green-50 border border-green-100 rounded-lg text-xs text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" /> No critical errors — well done!
              </div>
            )}

            {/* Warnings */}
            {(validationResults?.warnings.length || 0) > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Warnings
                </p>
                {validationResults?.warnings.map((warn, i) => (
                  <div key={i} className="px-3.5 py-2.5 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-700 flex items-start gap-2">
                    <span className="text-orange-400 flex-shrink-0 mt-0.5">!</span>
                    {warn}
                  </div>
                ))}
              </div>
            )}

            {/* Info */}
            {(validationResults?.info.length || 0) > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Info
                </p>
                {validationResults?.info.map((info, i) => (
                  <div key={i} className="px-3.5 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                    {info}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <Button className="h-9" onClick={() => setValidationModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teacher Workload Detail Panel */}
      <Dialog open={!!selectedTeacherWorkload} onOpenChange={() => setSelectedTeacherWorkload(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogTitle className="sr-only">{selectedTeacherWorkload?.full_name ?? 'Teacher Workload'}</DialogTitle>
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {selectedTeacherWorkload?.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{selectedTeacherWorkload?.full_name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Weekly Schedule · {selectedAcademicYear}</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-7 gap-2">
              {GRID_DAYS.map(day => (
                <div key={day} className="space-y-2">
                  <div className="text-center py-1.5 rounded-lg bg-gray-100 text-[10px] font-bold text-gray-600 uppercase tracking-wider">{day.slice(0,3)}</div>
                  <div className="space-y-1.5">
                    {[...periods].sort((a, b) => a.period_number - b.period_number).map(period => {
                      const schedule = schedules.find(s =>
                        s.teacher_id === selectedTeacherWorkload?.id &&
                        s.day_of_week === day &&
                        s.period_id === period.id &&
                        s.is_active &&
                        s.academic_year === selectedAcademicYear
                      );
                      if (!schedule) return (
                        <div key={period.id} className="h-14 rounded-lg border-2 border-dashed border-gray-100 bg-gray-50/30" />
                      );
                      const colorClasses = getColorClasses(getSubjectColor(schedule.subject));
                      return (
                        <div key={period.id} className={`h-14 rounded-lg border-l-[3px] px-2 py-1.5 flex flex-col justify-center shadow-sm ${colorClasses.border} ${colorClasses.bg}`}>
                          <p className={`text-[10px] font-bold truncate leading-tight ${colorClasses.text}`}>{schedule.subject}</p>
                          <p className="text-[9px] text-gray-600 font-medium">{schedule.grade}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">P{period.period_number}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <Button variant="outline" className="h-9" onClick={() => setSelectedTeacherWorkload(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Bell, ChevronDown, Clock, Download, FileSpreadsheet, FileText, Plus, Printer, ShieldCheck } from "lucide-react";
import { DEFAULT_OPERATING_DAYS } from "@/lib/weekday-utils";
import { requestClose, useDirtySnapshot } from "@/hooks/useUnsavedCloseGuard";
import { useSchoolAdmin } from "@/contexts/SchoolAdminContext";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import RowMenu from "@/components/portal/RowMenu";
import { ChipGroup } from "@/components/portal/notifications";
import type { Period, PeriodForm, Room, RoomForm, Schedule, ScheduleForm, Teacher } from "@/components/school-admin/schedule/types";
import {
  AVAILABLE_GRADES,
  CURRENT_ACADEMIC_YEAR,
  DAYS_OF_WEEK,
  DAY_NAME_TO_NUMBER,
  GRID_DAYS,
  NUMBER_TO_DAY_NAME,
  buildDayPreview,
  buildPeriodTimeline,
  formatTime,
  generateBulkRoomNumbers,
  getNextOperatingDay,
  gradeSectionLabel,
  naturalSort,
  type TemplateBreak,
  type TemplateBreakType,
} from "@/components/school-admin/schedule/utils";
import WeekRun from "@/components/school-admin/schedule/WeekRun";
import ScheduleGrid from "@/components/school-admin/schedule/ScheduleGrid";
import ScheduleList from "@/components/school-admin/schedule/ScheduleList";
import WorkloadList, { type WorkloadRow } from "@/components/school-admin/schedule/WorkloadList";
import ScheduleFormModal from "@/components/school-admin/schedule/ScheduleFormModal";
import PeriodsModal from "@/components/school-admin/schedule/PeriodsModal";
import RoomsModal from "@/components/school-admin/schedule/RoomsModal";
import { CopyClassModal, CopyDayModal } from "@/components/school-admin/schedule/CopyModals";
import { PushModal, TeacherWeekModal, ValidationModal } from "@/components/school-admin/schedule/TimetableModals";
import "@/components/school-admin/students.css";
import "@/components/school-admin/teachers.css";
import "@/components/school-admin/schedule/schedule.css";

export default function ClassSchedulingPage() {
  const { schoolInfo } = useSchoolAdmin();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolGrades, setSchoolGrades] = useState<string[]>([]);
  const [schoolGradesDetailed, setSchoolGradesDetailed] = useState<
    Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>
  >([]);
  /** Which weekdays the school holds classes — 0=Sun..6=Sat. Constrains the day-of-week picker below. */
  const [schoolOperatingDays, setSchoolOperatingDays] = useState<number[]>(DEFAULT_OPERATING_DAYS);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
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
  const [showCustomTemplate, setShowCustomTemplate] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('09:00');
  const [customPeriodCount, setCustomPeriodCount] = useState(8);
  const [customDurationMin, setCustomDurationMin] = useState(45);
  const [customBreaks, setCustomBreaks] = useState<TemplateBreak[]>([]);

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
    section: '',
    day_of_week: 'Monday',
    period_id: '',
    room_id: '',
    start_time: '',
    end_time: '',
    academic_year: CURRENT_ACADEMIC_YEAR,
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
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(initialScheduleForm);
  const [periodForm, setPeriodForm] = useState<PeriodForm>(initialPeriodForm);
  const [roomForm, setRoomForm] = useState<RoomForm>(initialRoomForm);
  const [bulkRoomMode, setBulkRoomMode] = useState(false);
  const [bulkRoomCount, setBulkRoomCount] = useState('5');

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
  const [tab, setTab] = useState<'grid' | 'list' | 'workload'>('grid');
  const [dayFocus, setDayFocus] = useState('all');
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [selectedTeachersToPush, setSelectedTeachersToPush] = useState<string[]>([]);
  const [lastPushTimestamp, setLastPushTimestamp] = useState<string | null>(null);
  const [pushSuccessSummary, setPushSuccessSummary] = useState<string | null>(null);

  // Section 9, 10 & 11 State
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationResults, setValidationResults] = useState<{ errors: string[]; warnings: string[]; info: string[] } | null>(null);
  const [selectedTeacherWorkload, setSelectedTeacherWorkload] = useState<Teacher | null>(null);

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

      // Fetch school info to get grades_offered, operating_days, and school_id
      try {
        const schoolResponse = await schoolAdminApi.school.get();
        const schoolData = schoolResponse.data ?? {};
        const school = (schoolData as {
          school?: {
            grades_offered?: string[];
            operating_days?: number[];
            grades?: Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>;
          };
        }).school;

        if (school?.grades_offered && Array.isArray(school.grades_offered)) {
          setSchoolGrades(school.grades_offered);
        } else {
          setSchoolGrades(AVAILABLE_GRADES);
        }
        setSchoolGradesDetailed(Array.isArray(school?.grades) ? school.grades : []);
        setSchoolOperatingDays(
          Array.isArray(school?.operating_days) && school.operating_days.length > 0
            ? school.operating_days
            : DEFAULT_OPERATING_DAYS,
        );
      } catch {
        setSchoolGrades(AVAILABLE_GRADES);
        setSchoolGradesDetailed([]);
        setSchoolOperatingDays(DEFAULT_OPERATING_DAYS);
      }

      // Load all data in parallel
      const [schedulesRes, periodsRes, roomsRes, teachersRes] = await Promise.all([
        schoolAdminApi.schedules.list(),
        schoolAdminApi.periods.list(),
        schoolAdminApi.rooms.list(),
        schoolAdminApi.teachers.list({ limit: 500 }),
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
          grade_sections_assigned?: Teacher['grade_sections_assigned'];
          teacher_schools?: NonNullable<Teacher['teacher_schools']>;
          teacher?: { full_name?: string; email?: string; phone?: string; profile_id?: string }; 
          profile?: { id?: string; fullName?: string; full_name?: string; email?: string; phone?: string } 
        };
        const transformedTeachers = (teacherSchools as TeacherSchoolRow[])
          .map((ts): Teacher | null => {
            const teacher = ts.teacher ?? {};
            const profile = ts.profile ?? {};
            // Prefer the backend's user id (`id`). Never use display codes like
            // `TCH-…` or Profile UUIDs — ClassSchedule.teacherId is User.id, and
            // Push-to-Teachers matches schedule.teacher_id === teacher.id.
            const userId = String(
              (ts as { id?: string | number }).id ??
                (teacher as { id?: string | number }).id ??
                '',
            ).trim();
            if (!userId || userId.startsWith('TCH-')) {
              return null;
            }

            const schoolRow: Partial<NonNullable<Teacher['teacher_schools']>[number]> = (ts.teacher_schools || [])[0] ?? {};
            const transformed: Teacher = {
              id: userId,
              full_name: ts.full_name ?? profile.full_name ?? profile.fullName ?? teacher.full_name ?? 'Unknown',
              email: ts.email ?? teacher.email ?? profile.email ?? '',
              phone: (ts.phone ?? teacher.phone ?? profile.phone ?? '') as string,
              subjects: ts.subjects?.length ? ts.subjects : (schoolRow.subjects || []),
              grades_assigned: ts.grades_assigned?.length
                ? ts.grades_assigned
                : (schoolRow.grades_assigned || []),
              grade_sections_assigned:
                ts.grade_sections_assigned ||
                schoolRow.grade_sections_assigned ||
                [],
              teacher_schools: ts.teacher_schools || []
            };

            // Keep teachers even without email — Teachers Management can show them
            // and schedules need the same roster. Only drop rows with no usable id/name.
            if (!transformed.id || transformed.full_name === 'Unknown') {
              return null;
            }
            return transformed;
          })
          .filter((t): t is Teacher => t !== null);
        setTeachers(transformedTeachers);
      } catch {
        setTeachers([]);
      }

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
    const matchesSection =
      selectedSection === 'all' ||
      (schedule.section ?? '') === selectedSection ||
      (!schedule.section && selectedSection === 'none');
    const matchesSearch = searchTerm === '' || 
      schedule.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.teacher?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.room?.room_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = !schedule.academic_year || schedule.academic_year === CURRENT_ACADEMIC_YEAR;
    
    return matchesGrade && matchesSection && matchesSearch && matchesYear && schedule.is_active;
  });

  // Section 5: Add Schedule Modal Derivatives
  const uniqueSubjects = [...new Set(schedules.map((s: Schedule) => s.subject))].filter(Boolean).sort();

  const sectionsForSelectedGrade = (() => {
    if (!scheduleForm.grade) return [] as string[];
    const g = schoolGradesDetailed.find((x) => x.name === scheduleForm.grade);
    if (!g) return [] as string[];
    return g.sections.map((s) => s.name).filter(Boolean);
  })();

  const filterSectionsForGrade = (() => {
    if (selectedGrade === 'all') {
      return [...new Set(schedules.map((s) => s.section).filter(Boolean) as string[])].sort();
    }
    const g = schoolGradesDetailed.find((x) => x.name === selectedGrade);
    if (g?.sections?.length) return g.sections.map((s) => s.name);
    return [...new Set(
      schedules.filter((s) => s.grade === selectedGrade).map((s) => s.section).filter(Boolean) as string[],
    )].sort();
  })();

  
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
  
  const isTeacherAssigned = (t: Teacher, sub: string, gr: string, sec?: string) => {
    if (!gr) return true;

    const normalizeGrade = (g: string) => g.toLowerCase().replace(/grade\s+/g, '').trim();
    const normalizeSection = (s: string) =>
      s.toLowerCase().replace(/^section\s+/i, '').trim();
    const normGr = normalizeGrade(gr);
    const normSub = sub.toLowerCase().trim();
    const normSec = normalizeSection(sec ?? '');

    const subjects = t.subjects || t.teacher_schools?.[0]?.subjects || [];
    // Subject list is often empty on TeacherSchool — don't block grade/section matches.
    // When the form subject is blank, skip the subject check entirely.
    if (normSub && subjects.length > 0) {
      const hasSubject = subjects.some((s: string) => s.toLowerCase().trim() === normSub);
      if (!hasSubject) return false;
    }

    const gsa =
      t.grade_sections_assigned ??
      t.teacher_schools?.[0]?.grade_sections_assigned ??
      [];

    if (gsa.length) {
      const row = gsa.find((g) => normalizeGrade(g.grade) === normGr);
      if (!row) return false;
      if (normSec && row.sections?.length) {
        return row.sections.some((s) => normalizeSection(s) === normSec);
      }
      return true;
    }

    const grades = t.grades_assigned || t.teacher_schools?.[0]?.grades_assigned || [];
    return grades.some((g: string) => normalizeGrade(g) === normGr);
  };

  // Client-side hints only — the backend (assertTeacherSchedulable in
  // school-admin-extra.controller.ts) is the real enforcement. These just
  // keep obviously-unschedulable teachers out of the dropdown so a save
  // isn't rejected after the fact.
  const isTeacherWorkingOnDay = (t: Teacher, day: string) => {
    if (!day) return true;
    const dayNum = DAY_NAME_TO_NUMBER[day];
    if (dayNum === undefined) return true;
    const workingDays = t.teacher_schools?.[0]?.working_days;
    if (!workingDays || workingDays.length === 0) return true;
    return workingDays.includes(dayNum);
  };

  const isTeacherCurrentlyAssigned = (t: Teacher) => {
    const schoolData = t.teacher_schools?.[0];
    if (!schoolData) return true;
    const today = new Date().toISOString().split('T')[0];
    if (schoolData.assigned_from && today < schoolData.assigned_from) return false;
    if (schoolData.assigned_until && today > schoolData.assigned_until) return false;
    return true;
  };

  const filteredTeachers = useMemo(
    () =>
      teachers
        .filter((t) =>
          scheduleForm.grade
            ? isTeacherAssigned(
                t,
                scheduleForm.subject,
                scheduleForm.grade,
                scheduleForm.section,
              )
            : true,
        )
        .filter((t) => isTeacherWorkingOnDay(t, scheduleForm.day_of_week))
        .filter((t) => isTeacherCurrentlyAssigned(t)),
    // isTeacherAssigned / day helpers are stable closures over scheduleForm + teachers
    [
      teachers,
      scheduleForm.grade,
      scheduleForm.subject,
      scheduleForm.section,
      scheduleForm.day_of_week,
    ],
  );

  // Prefer grade/section matches; if none, fall back to the full roster so the
  // admin is never stuck with an empty dropdown when teachers exist.
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
  if (scheduleForm.grade && scheduleForm.day_of_week && scheduleForm.period_id) {
    const availableFiltered = filteredTeachers.filter((t) =>
      isTeacherAvailable(t.id, scheduleForm.day_of_week, scheduleForm.period_id),
    );
    if (availableFiltered.length > 0) {
      suggestedTeacher = availableFiltered.sort(
        (a, b) => getTeacherLoad(a.id) - getTeacherLoad(b.id),
      )[0];
    }
  }

  // When exactly one teacher matches grade/section, pre-select them so Create isn't blocked.
  useEffect(() => {
    if (!scheduleDialogOpen || editingSchedule) return;
    if (!scheduleForm.grade) return;
    if (sectionsForSelectedGrade.length > 0 && !scheduleForm.section) return;
    if (filteredTeachers.length !== 1) return;
    const only = filteredTeachers[0];
    if (!only?.id) return;
    if (scheduleForm.teacher_id === only.id) return;
    if (
      scheduleForm.teacher_id &&
      filteredTeachers.some((t) => t.id === scheduleForm.teacher_id)
    ) {
      return;
    }
    setScheduleForm((prev) => ({ ...prev, teacher_id: only.id }));
  }, [
    scheduleDialogOpen,
    editingSchedule,
    scheduleForm.grade,
    scheduleForm.section,
    scheduleForm.teacher_id,
    filteredTeachers,
    sectionsForSelectedGrade.length,
  ]);
  
  let conflictWarning: string | null = null;
  if (scheduleForm.teacher_id && !isTeacherAvailable(scheduleForm.teacher_id, scheduleForm.day_of_week, scheduleForm.period_id)) {
    const conflict = schedules.find(s => s.teacher_id === scheduleForm.teacher_id && s.day_of_week === scheduleForm.day_of_week && s.period_id === scheduleForm.period_id && s.id !== editingSchedule?.id);
    if (conflict) {
      const t = teachers.find(t => t.id === scheduleForm.teacher_id);
      const p = periods.find(p => p.id === scheduleForm.period_id);
      conflictWarning = `${t?.full_name} is already assigned to ${conflict.subject} – ${gradeSectionLabel(conflict)} on ${conflict.day_of_week} Period ${p?.period_number}. Please choose a different teacher or period.`;
    }
  } else if (scheduleForm.room_id && !isRoomAvailable(scheduleForm.room_id, scheduleForm.day_of_week, scheduleForm.period_id)) {
    const conflict = schedules.find(s => s.room_id === scheduleForm.room_id && s.day_of_week === scheduleForm.day_of_week && s.period_id === scheduleForm.period_id && s.id !== editingSchedule?.id);
    if (conflict) {
      const r = rooms.find(r => r.id === scheduleForm.room_id);
      const p = periods.find(p => p.id === scheduleForm.period_id);
      conflictWarning = `Room ${r?.room_number} is already booked for ${conflict.subject} – ${gradeSectionLabel(conflict)} on ${conflict.day_of_week} Period ${p?.period_number}. Please choose a different room.`;
    }
  }

  // Handle schedule operations
  const handleCreateSchedule = async () => {
    if (!scheduleForm.subject.trim()) {
      toast.error('Please enter a subject before saving.');
      return;
    }
    if (sectionsForSelectedGrade.length > 0 && !scheduleForm.section.trim()) {
      toast.error('Please select a section for this grade.');
      return;
    }
    if (!scheduleForm.teacher_id) {
      if (teachers.length === 0) {
        toast.error(
          'No teachers found for this school. Add a teacher under Teachers Management first.',
        );
      } else if (displayTeachers.length === 0) {
        toast.error('No teachers available to assign. Check working days and assignments.');
      } else {
        toast.error('Select a teacher from the Teacher dropdown before saving.');
      }
      return;
    }
    // Prepare request body - convert empty strings to null for optional fields
    const requestBody = {
      ...scheduleForm,
      teacher_id: scheduleForm.teacher_id || null,
      period_id: scheduleForm.period_id || null,
      room_id: scheduleForm.room_id || null,
      class_id: scheduleForm.class_id || null,
      section: scheduleForm.section || null,
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
    if (!scheduleForm.subject.trim()) {
      toast.error('Please enter a subject before saving.');
      return;
    }
    if (sectionsForSelectedGrade.length > 0 && !scheduleForm.section.trim()) {
      toast.error('Please select a section for this grade.');
      return;
    }
    if (!scheduleForm.teacher_id) {
      if (teachers.length === 0) {
        toast.error(
          'No teachers found for this school. Add a teacher under Teachers Management first.',
        );
      } else {
        toast.error('Select a teacher from the Teacher dropdown before saving.');
      }
      return;
    }

    try {
      const requestBody = {
        ...scheduleForm,
        teacher_id: scheduleForm.teacher_id || null,
        period_id: scheduleForm.period_id || null,
        room_id: scheduleForm.room_id || null,
        class_id: scheduleForm.class_id || null,
        section: scheduleForm.section || null,
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
      section: schedule.section || '',
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
      section: '',
      day_of_week: 'Monday',
      period_id: '',
      room_id: '',
      start_time: '',
      end_time: '',
      academic_year: CURRENT_ACADEMIC_YEAR,
      notes: ''
    });
    setEditingSchedule(null);
    setLockedFields({});
  };

  // Baseline = form state at open (includes grid-prefilled day/period). Closing
  // without further edits must not prompt — only real user changes do.
  const scheduleFormDirty = useDirtySnapshot(scheduleDialogOpen, scheduleForm);

  const closeScheduleDialog = () => {
    void requestClose(scheduleFormDirty, () => {
      setScheduleDialogOpen(false);
      resetScheduleForm();
    });
  };

  const openBlankScheduleDialog = () => {
    resetScheduleForm();
    setScheduleDialogOpen(true);
  };

  const handleAddScheduleGrid = (day: string, periodId: string) => {
    if (!schoolOperatingDays.includes(DAY_NAME_TO_NUMBER[day])) return;
    const period = periods.find(p => p.id === periodId);
    setScheduleForm({
      class_id: '',
      teacher_id: '',
      subject: '',
      grade: selectedGrade !== 'all' ? selectedGrade : '',
      section: selectedSection !== 'all' ? selectedSection : '',
      day_of_week: day,
      period_id: periodId,
      room_id: '',
      start_time: period ? period.start_time : '',
      end_time: period ? period.end_time : '',
      academic_year: CURRENT_ACADEMIC_YEAR,
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

  const applyPeriodTemplate = async (opts: {
    startTime: string;
    count: number;
    durationMin: number;
    breaks?: Array<{ afterPeriod: number; durationMin: number }>;
    label?: string;
  }) => {
    const count = Math.min(12, Math.max(1, opts.count));
    const durationMin = Math.min(90, Math.max(20, opts.durationMin));
    if (!(await confirmDialog({
      title: opts.label ? `Apply ${opts.label}?` : 'Apply this template?',
      description: 'This will delete all existing periods and recreate the school day.',
      confirmText: 'Apply',
      variant: 'danger',
    }))) return;
    try {
      setLoading(true);
      await Promise.all(periods.map((p) => schoolAdminApi.periods.delete(p.id)));
      const config = buildPeriodTimeline({
        startTime: opts.startTime,
        count,
        durationMin,
        breaks: opts.breaks,
      });
      for (const p of config) {
        await schoolAdminApi.periods.create(p);
      }
      await loadData();
      toast.success(`Created ${config.length} periods`);
    } catch (err) {
      console.error(err);
      toast.error('Error applying template');
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async (template: 'standard' | 'extended' | 'halfday') => {
    if (template === 'extended') {
      await applyPeriodTemplate({
        startTime: '09:00',
        count: 6,
        durationMin: 60,
        label: '6×60m',
      });
    } else if (template === 'halfday') {
      await applyPeriodTemplate({
        startTime: '08:00',
        count: 5,
        durationMin: 40,
        label: '5×40m',
      });
    } else {
      await applyPeriodTemplate({
        startTime: '09:00',
        count: 8,
        durationMin: 45,
        label: '8×45m',
      });
    }
  };

  const handleApplyCustomTemplate = async () => {
    await applyPeriodTemplate({
      startTime: customStartTime || '09:00',
      count: customPeriodCount,
      durationMin: customDurationMin,
      breaks: customBreaks.map((b) => ({
        afterPeriod: b.afterPeriod,
        durationMin: b.durationMin,
      })),
      label: 'custom template',
    });
  };

  const customDayPreview = useMemo(
    () =>
      buildDayPreview({
        startTime: customStartTime || '09:00',
        count: Math.min(12, Math.max(1, customPeriodCount || 1)),
        durationMin: Math.min(90, Math.max(20, customDurationMin || 20)),
        breaks: customBreaks,
      }),
    [customStartTime, customPeriodCount, customDurationMin, customBreaks],
  );

  const addCustomBreak = (type: TemplateBreakType) => {
    const maxAfter = Math.max(1, Math.min(12, customPeriodCount) - 1);
    setCustomBreaks((prev) => [
      ...prev,
      {
        id: `brk-${Date.now()}-${prev.length}`,
        type,
        afterPeriod: Math.min(Math.max(1, Math.floor(customPeriodCount / 2)), maxAfter) || 1,
        durationMin: type === 'lunch' ? 30 : 10,
      },
    ]);
  };

  // Keep break "after period" values valid when period count shrinks.
  useEffect(() => {
    const maxAfter = Math.max(1, customPeriodCount - 1);
    setCustomBreaks((prev) => {
      if (customPeriodCount < 2) return [];
      const next = prev.map((b) =>
        b.afterPeriod > maxAfter ? { ...b, afterPeriod: maxAfter } : b,
      );
      return next.every((b, i) => b.afterPeriod === prev[i]?.afterPeriod) &&
        next.length === prev.length
        ? prev
        : next;
    });
  }, [customPeriodCount]);

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
    if (bulkRoomMode) {
      const count = parseInt(bulkRoomCount, 10) || 0;
      if (!roomForm.room_number.trim()) {
        toast.error('Enter a starting room number');
        return;
      }
      if (count < 2 || count > 100) {
        toast.error('Quantity must be between 2 and 100');
        return;
      }
      const roomNumbers = generateBulkRoomNumbers(roomForm.room_number, count);
      try {
        const res = await schoolAdminApi.rooms.bulkCreate({
          rooms: roomNumbers.map((room_number) => ({
            room_number,
            room_name: roomForm.room_name || undefined,
            capacity: roomForm.capacity ? parseInt(roomForm.capacity) : null,
            location: roomForm.location || undefined,
            facilities: roomForm.facilities,
            is_active: roomForm.is_active,
          })),
        });
        await loadData();
        // Dialog stays open — reset the form so the admin can immediately
        // add another room or batch, and see the new rooms in the list above.
        resetRoomForm();
        setBulkRoomMode(false);
        setBulkRoomCount('5');
        const created = (res?.data?.rooms as unknown[] | undefined)?.length ?? roomNumbers.length;
        toast.success(`Added ${created} rooms: ${roomNumbers[0]}–${roomNumbers[roomNumbers.length - 1]}`);
      } catch (error) {
        console.error('Error bulk-creating rooms:', error);
        const err = error as { response?: { data?: { error?: string; details?: string; message?: string } } };
        toast.error(err.response?.data?.error ?? err.response?.data?.details ?? err.response?.data?.message ?? 'Failed to create rooms');
      }
      return;
    }

    if (!roomForm.room_number.trim()) {
      toast.error('Room # is required');
      return;
    }

    try {
      await schoolAdminApi.rooms.create({
        ...roomForm,
        capacity: roomForm.capacity ? parseInt(roomForm.capacity) : null
      });
      await loadData();
      // Dialog stays open — reset the form so the admin can immediately add
      // the next room without having to reopen "Manage Rooms" every time.
      resetRoomForm();
      toast.success('Room added');
    } catch (error) {
      console.error('Error creating room:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      toast.error(err.response?.data?.error ?? err.response?.data?.details ?? 'Failed to create room');
    }
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom) return;
    if (!roomForm.room_number.trim()) {
      toast.error('Room # is required');
      return;
    }

    try {
      await schoolAdminApi.rooms.update(editingRoom.id, {
        ...roomForm,
        capacity: roomForm.capacity ? parseInt(roomForm.capacity) : null
      });
      await loadData();
      resetRoomForm();
      toast.success('Room updated');
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
        section: scheduleToCopy.section || null,
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
      toast.success(`Copied to ${targetDay}`);
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

    const otherDays = DAYS_OF_WEEK.filter(
      d => d !== schedule.day_of_week && schoolOperatingDays.includes(DAY_NAME_TO_NUMBER[d]),
    );

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
          section: schedule.section || null,
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
            section: schedule.section || null,
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
    setBulkRoomMode(false);
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

  const roomFormDirty = useDirtySnapshot(roomDialogOpen, {
    ...roomForm,
    bulkRoomMode,
    bulkRoomCount,
  });

  const closeRoomDialog = () => {
    void requestClose(roomFormDirty, () => {
      setRoomDialogOpen(false);
      resetRoomForm();
      setBulkRoomMode(false);
      setBulkRoomCount('5');
    });
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

  // Section 7 Logic: Completion Calculation
  const operatingGridDaysCount = GRID_DAYS.filter(d => schoolOperatingDays.includes(DAY_NAME_TO_NUMBER[d])).length;
  const totalPossibleSlots = (periods.length || 1) * (operatingGridDaysCount || 1);
  const uniqueGrades = [...new Set(schedules.map((s: Schedule) => s.grade))].filter(Boolean).sort();
  const uniqueAudiences = [
    ...new Map(
      schedules
        .filter((s: Schedule) => s.grade)
        .map((s: Schedule) => {
          const key = s.section ? `${s.grade}::${s.section}` : s.grade;
          return [key, { grade: s.grade, section: s.section ?? null, label: gradeSectionLabel(s) }];
        }),
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));
  const completionStats = uniqueAudiences.map(({ grade, section, label }) => {
    const filledSlots = new Set(
      schedules
        .filter((s: Schedule) =>
          s.grade === grade &&
          (section ? s.section === section : !s.section) &&
          s.is_active,
        )
        .map((s: Schedule) => `${s.day_of_week}-${s.period_id}`),
    ).size;

    return {
      grade,
      section,
      label,
      filled: filledSlots,
      total: totalPossibleSlots,
      percentage: Math.round((filledSlots / (totalPossibleSlots || 1)) * 100),
    };
  });

  // Section 8 Logic: Push to Teachers
  const teachersWithSchedules = teachers.filter(t => 
    schedules.some(s => s.teacher_id === t.id && s.is_active)
  );

  const unassignedActiveSchedules = schedules.filter(
    (s) =>
      s.is_active &&
      !s.teacher_id &&
      (!s.academic_year || s.academic_year === CURRENT_ACADEMIC_YEAR),
  );

  const pickTeacherForSlot = (s: {
    subject: string;
    grade: string;
    section?: string | null;
    day_of_week: string;
    period_id?: string;
    id?: string;
    /** Extra teacher ids already claimed in this auto-assign pass */
    reservedTeacherSlots?: Set<string>;
  }) => {
    if (!s.period_id) return null;
    const slotKey = (teacherId: string) =>
      `${s.day_of_week}|${s.period_id}|${teacherId}`;
    const available = teachers.filter((t) => {
      if (!isTeacherCurrentlyAssigned(t)) return false;
      if (!isTeacherWorkingOnDay(t, s.day_of_week)) return false;
      if (!isTeacherAvailable(t.id, s.day_of_week, s.period_id!)) return false;
      if (s.reservedTeacherSlots?.has(slotKey(t.id))) return false;
      return true;
    });
    const matched = available.filter((t) =>
      isTeacherAssigned(t, s.subject, s.grade, s.section ?? undefined),
    );
    const pool =
      matched.length > 0 ? matched : available.length === 1 ? available : [];
    if (pool.length === 0) return null;
    return pool.sort((a, b) => getTeacherLoad(a.id) - getTeacherLoad(b.id))[0];
  };

  const handleAutoAssignTeachers = async () => {
    if (unassignedActiveSchedules.length === 0) {
      toast.error('All active classes already have a teacher assigned.');
      return;
    }
    setIsAutoAssigning(true);
    let assigned = 0;
    let skipped = 0;
    const reserved = new Set<string>();
    const assignedTeacherIds = new Set<string>();
    try {
      for (const s of unassignedActiveSchedules) {
        const teacher = pickTeacherForSlot({
          ...s,
          reservedTeacherSlots: reserved,
        });
        if (!teacher || !s.period_id) {
          skipped += 1;
          continue;
        }
        try {
          await schoolAdminApi.schedules.update(s.id, {
            teacher_id: teacher.id,
            period_id: s.period_id,
            day_of_week: s.day_of_week,
            subject: s.subject,
            grade: s.grade,
            section: s.section ?? null,
            room_id: s.room_id ?? null,
            academic_year: s.academic_year,
            is_active: true,
          });
          reserved.add(`${s.day_of_week}|${s.period_id}|${teacher.id}`);
          assignedTeacherIds.add(teacher.id);
          assigned += 1;
        } catch {
          skipped += 1;
        }
      }
      await loadData();
      if (assigned > 0) {
        setSelectedTeachersToPush([...assignedTeacherIds]);
        toast.success(
          `Assigned teachers to ${assigned} class${assigned === 1 ? '' : 'es'}${skipped ? ` (${skipped} still need a manual pick)` : ''}.`,
        );
      } else {
        toast.error(
          'Could not auto-assign teachers. Edit each class and pick a teacher, then try Push again.',
        );
      }
    } finally {
      setIsAutoAssigning(false);
    }
  };

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
      text += `  • ${s.subject} - ${gradeSectionLabel(s)}, ${formatTime(s.start_time)} - ${formatTime(s.end_time)}\n`;
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

    const activeSchedules = schedules.filter(
      (s) => s.is_active && (!s.academic_year || s.academic_year === CURRENT_ACADEMIC_YEAR),
    );
    const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number);
    const operatingDayNames = GRID_DAYS.filter((d) =>
      schoolOperatingDays.includes(DAY_NAME_TO_NUMBER[d]),
    );

    // Errors: Teacher/Room double-booked
    const teacherUsage: Record<string, string[]> = {};
    const roomUsage: Record<string, string[]> = {};

    activeSchedules.forEach(s => {
      if (s.teacher_id) {
        const key = `${s.day_of_week}-${s.period_id}-${s.teacher_id}`;
        if (!teacherUsage[key]) teacherUsage[key] = [];
        teacherUsage[key].push(`${s.subject} (${gradeSectionLabel(s)})`);
        if (teacherUsage[key].length > 1) {
          const p = sortedPeriods.find(p => p.id === s.period_id);
          errors.push(`Teacher ${s.teacher?.full_name} is double-booked on ${s.day_of_week} Period ${p?.period_number}`);
        }
      }
      if (s.room_id) {
        const key = `${s.day_of_week}-${s.period_id}-${s.room_id}`;
        if (!roomUsage[key]) roomUsage[key] = [];
        roomUsage[key].push(`${s.subject} (${gradeSectionLabel(s)})`);
        if (roomUsage[key].length > 1) {
          const p = sortedPeriods.find(p => p.id === s.period_id);
          errors.push(`Room ${s.room?.room_number} is double-booked on ${s.day_of_week} Period ${p?.period_number}`);
        }
      }
    });

    // Errors: teacher not assigned to this school / not working that day /
    // outside their assigned date range. Re-derives assertTeacherSchedulable
    // (school-admin-extra.controller.ts) client-side from already-loaded data
    // — this is what gives retroactive visibility into schedules that were
    // created before this feature existed, or where an admin has since
    // narrowed a teacher's assignment window.
    const today = new Date().toISOString().split('T')[0];
    activeSchedules.forEach(s => {
      if (!s.teacher_id) return;
      const teacher = teachers.find(t => t.id === s.teacher_id);
      const schoolData = teacher?.teacher_schools?.[0];
      const teacherName = s.teacher?.full_name ?? teacher?.full_name ?? 'Unknown teacher';
      if (!schoolData) {
        errors.push(`${teacherName} is scheduled on ${s.day_of_week} but is not assigned to your school`);
        return;
      }
      if (schoolData.assigned_from && today < schoolData.assigned_from) {
        errors.push(`${teacherName} is scheduled on ${s.day_of_week} but their assignment doesn't start until ${schoolData.assigned_from}`);
      }
      if (schoolData.assigned_until && today > schoolData.assigned_until) {
        errors.push(`${teacherName} is scheduled on ${s.day_of_week} but their assignment ended on ${schoolData.assigned_until}`);
      }
      const dayNum = DAY_NAME_TO_NUMBER[s.day_of_week];
      const workingDays = schoolData.working_days;
      if (dayNum !== undefined && workingDays && workingDays.length > 0 && !workingDays.includes(dayNum)) {
        errors.push(`${teacherName} doesn't work at your school on ${s.day_of_week}s, but is scheduled for ${s.subject} (${gradeSectionLabel(s)})`);
      }
    });

    // Errors: schedule on a day the SCHOOL itself doesn't operate on — a
    // school-wide constraint, independent of which (if any) teacher is
    // assigned. Re-derives assertSchoolOperatesOnDay client-side.
    activeSchedules.forEach(s => {
      const dayNum = DAY_NAME_TO_NUMBER[s.day_of_week];
      if (dayNum !== undefined && !schoolOperatingDays.includes(dayNum)) {
        errors.push(`${s.subject} (${gradeSectionLabel(s)}) is scheduled on ${s.day_of_week}, but your school doesn't operate that day`);
      }
    });

    // Warnings: empty operating days per grade/section (no "Grade Grade" prefix)
    type Audience = { grade: string; section: string | null; label: string };
    const audiences: Audience[] = [];
    if (schoolGradesDetailed.length > 0) {
      for (const g of schoolGradesDetailed) {
        if (g.sections?.length) {
          for (const sec of g.sections) {
            audiences.push({ grade: g.name, section: sec.name, label: `${g.name}-${sec.name}` });
          }
        } else {
          audiences.push({ grade: g.name, section: null, label: g.name });
        }
      }
    } else {
      const seen = new Set<string>();
      for (const s of activeSchedules) {
        const label = s.section ? `${s.grade}-${s.section}` : s.grade;
        if (seen.has(label)) continue;
        seen.add(label);
        audiences.push({ grade: s.grade, section: s.section ?? null, label });
      }
      for (const grade of uniqueGrades) {
        if ([...seen].some((l) => l === grade || l.startsWith(`${grade}-`))) continue;
        audiences.push({ grade, section: null, label: grade });
      }
    }

    audiences.forEach(({ grade, section, label }) => {
      operatingDayNames.forEach((day) => {
        const hasClass = activeSchedules.some(
          (s) =>
            s.grade === grade &&
            s.day_of_week === day &&
            (section == null || s.section === section),
        );
        if (!hasClass) {
          warnings.push(`${label} has no classes scheduled on ${day}`);
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
      operatingDayNames.forEach(day => {
        const isUsed = activeSchedules.some(s => s.day_of_week === day && s.period_id === period.id);
        if (!isUsed) {
          warnings.push(`No classes scheduled for any grade on ${day} Period ${period.period_number}`);
        }
      });
    });

    // Info: Stats, Unused teachers/rooms
    info.push(`Total active schedules for ${CURRENT_ACADEMIC_YEAR}: ${activeSchedules.length}`);
    const unusedTeachers = teachers.filter(t => !activeSchedules.some(s => s.teacher_id === t.id));
    if (unusedTeachers.length > 0) info.push(`${unusedTeachers.length} ${unusedTeachers.length === 1 ? 'teacher has' : 'teachers have'} no classes this week.`);
    
    const unusedRooms = rooms.filter(r => !activeSchedules.some(s => s.room_id === r.id));
    if (unusedRooms.length > 0) info.push(`${unusedRooms.length} ${unusedRooms.length === 1 ? 'room is' : 'rooms are'} not used by any class.`);

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
      doc.text(`School Timetable - ${CURRENT_ACADEMIC_YEAR}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Grade: ${selectedGrade === 'all' ? 'All Grades' : selectedGrade}`, 14, 22);

      const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number);
      const head = [['Day \\ Period', ...sortedPeriods.map(p => `P${p.period_number}`)]];
      const body = GRID_DAYS.map(day => {
        const row = [day];
        sortedPeriods.forEach(period => {
          const cellSchedules = filteredSchedules.filter(s => s.day_of_week === day && s.period_id === period.id);
          row.push(cellSchedules.map(s => `${s.subject}\n(${s.section ? `${s.grade}-${s.section}` : s.grade})`).join('\n---\n'));
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

      doc.save(`timetable-${selectedGrade}-${CURRENT_ACADEMIC_YEAR}.pdf`);
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
        { header: 'Section', key: 'section', width: 12 },
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
          section: s.section || '',
          teacher: s.teacher?.full_name || 'N/A',
          room: s.room?.room_number || 'N/A'
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `schedule-${CURRENT_ACADEMIC_YEAR}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel Export Error:', error);
      toast.error('Failed to generate Excel file');
    }
  };

  // Which weekday the track and grid focus on. On a phone, start on one day instead of six cramped columns.
  const focusInit = useRef(false);
  useEffect(() => {
    if (loading || focusInit.current) return;
    focusInit.current = true;
    if (window.matchMedia("(max-width: 760px)").matches) {
      const open = GRID_DAYS.filter((d) => schoolOperatingDays.includes(DAY_NAME_TO_NUMBER[d]));
      const today = NUMBER_TO_DAY_NAME[new Date().getDay()];
      setDayFocus(open.includes(today) ? today : (open[0] ?? "all"));
    }
  }, [loading, schoolOperatingDays]);


  /* ───────── what the page shows ───────── */
  const activeSchedules = schedules.filter((s) => s.is_active && (!s.academic_year || s.academic_year === CURRENT_ACADEMIC_YEAR));
  const isOpenDay = (d: string) => schoolOperatingDays.includes(DAY_NAME_TO_NUMBER[d]);
  const todayName = NUMBER_TO_DAY_NAME[new Date().getDay()];
  const runDays = GRID_DAYS.map((name) => ({
    name,
    count: activeSchedules.filter((s) => s.day_of_week === name).length,
    open: isOpenDay(name),
    today: name === todayName,
  }));
  const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number);
  const dayRange = sortedPeriods.length ? `${formatTime(sortedPeriods[0].start_time)} to ${formatTime(sortedPeriods[sortedPeriods.length - 1].end_time)}` : "Not set up yet";
  const needTeacher = unassignedActiveSchedules.length;
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  const workloadRows: WorkloadRow[] = teachers.map((teacher) => {
    const mine = activeSchedules.filter((s) => s.teacher_id === teacher.id);
    return {
      teacher,
      classes: mine.length,
      hours: getTeacherLoad(teacher.id),
      subjects: [...new Set(mine.map((s) => s.subject))],
      grades: [...new Set(mine.map((s) => gradeSectionLabel(s)).filter(Boolean))],
    };
  });

  let status: React.ReactNode;
  if (periods.length === 0) status = "Set up your school day first. Then add classes into it.";
  else {
    status = (
      <>
        <strong>{plural(activeSchedules.length, "class", "classes")}</strong> a week across {plural(periods.length, "period")}.
        {needTeacher > 0 ? <> <strong>{needTeacher}</strong> still {needTeacher === 1 ? "needs" : "need"} a teacher.</> : null}
      </>
    );
  }

  const ledger = [
    { label: "Periods", value: periods.length, hint: dayRange, onClick: () => setPeriodDialogOpen(true), pressed: false },
    { label: "Rooms", value: rooms.length, hint: rooms.length ? `${rooms.filter((r) => r.is_active).length} in use` : "None yet", onClick: () => setRoomDialogOpen(true), pressed: false },
    { label: "Classes", value: activeSchedules.length, hint: needTeacher > 0 ? `${needTeacher} need a teacher` : "Every class has a teacher", onClick: () => setTab("list"), pressed: tab === "list" },
    { label: "Teachers", value: teachersWithSchedules.length, hint: `of ${teachers.length} teach this week`, onClick: () => setTab("workload"), pressed: tab === "workload" },
  ];

  const focusOptions: Array<readonly [string, string]> = [["all", "All days"], ...GRID_DAYS.filter(isOpenDay).map((d) => [d, d.slice(0, 3)] as const)];
  const gradeChoices = uniqueGradesFromSchedules.length ? [...uniqueGradesFromSchedules].sort(naturalSort) : [];

  const openCopyClass = (s: Schedule) => {
    setScheduleToCopy(s);
    setTargetDay("");
    setCopyScheduleDialogOpen(true);
  };
  const openCopyDay = (day: string) => {
    setSourceDayToCopy(day);
    const next = getNextOperatingDay(day, schoolOperatingDays);
    setTargetDays(next && next !== day ? [next] : []);
    setCopyResults(null);
    setCopyDayDialogOpen(true);
  };
  const openPush = () => {
    setSelectedTeachersToPush(teachersWithSchedules.map((t) => t.id));
    setPushSuccessSummary(null);
    setPushModalOpen(true);
  };

  if (loading) {
    return (
      <div className="sd-page">
        <section className="sd-hero mc-band" aria-label="Timetable">
          <div className="sd-hero-copy">
            <h1 className="mc-hero-title">Timetable</h1>
            <p className="sd-status">Loading your timetable…</p>
          </div>
        </section>
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      </div>
    );
  }

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ts-title">
        <div className="sd-hero-copy">
          <h1 id="ts-title" className="mc-hero-title">Timetable</h1>
          <p className="sd-where">{CURRENT_ACADEMIC_YEAR}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            {periods.length > 0 ? (
              <button className="sd-btn sd-btn--amber" onClick={openBlankScheduleDialog}><Plus aria-hidden="true" />Add class</button>
            ) : (
              <button className="sd-btn sd-btn--amber" onClick={() => setPeriodDialogOpen(true)}><Clock aria-hidden="true" />Set up periods</button>
            )}
            <button className="sd-btn sd-btn--ghost-dark" onClick={openPush}><Bell aria-hidden="true" />Send to teachers</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={runValidation}><ShieldCheck aria-hidden="true" />Check timetable</button>
            <RowMenu
              label="Export the timetable"
              buttonClassName="sd-btn sd-btn--ghost-dark"
              button={<><Download aria-hidden="true" />Export<ChevronDown aria-hidden="true" /></>}
              items={[
                { label: "Export as PDF", icon: FileText, onClick: handleExportPDF },
                { label: "Export as Excel", icon: FileSpreadsheet, onClick: handleExportExcel },
                { label: "Print this view", icon: Printer, onClick: () => window.print() },
              ]}
            />
          </div>
        </div>
        <WeekRun days={runDays} focus={dayFocus} onFocus={(d) => { setDayFocus(d); if (d !== "all") setTab("grid"); }} total={activeSchedules.length} />
      </section>

      {showWizard ? (
        <section className="sd-panel" aria-labelledby="ts-setup">
          <div className="sd-panel-head"><div><h2 id="ts-setup">Set up your timetable</h2><p>Two steps. The second one is optional, but it helps catch double bookings.</p></div></div>
          <ol className="sm-steps">
            <li>
              <b>Add school periods</b>
              <span>The time slots of your day, like period 1 from 9:00 to 9:45.</span>
              <button className={`sd-btn ${periods.length > 0 ? "sd-btn--line" : "sd-btn--amber"}`} onClick={() => setPeriodDialogOpen(true)}>{periods.length > 0 ? `Edit ${plural(periods.length, "period")}` : "Add periods"}</button>
            </li>
            <li>
              <b>Add classrooms</b>
              <span>The rooms where classes take place.</span>
              <button className="sd-btn sd-btn--line" onClick={() => setRoomDialogOpen(true)}>{rooms.length > 0 ? `Edit ${plural(rooms.length, "room")}` : "Add rooms"}</button>
            </li>
          </ol>
          <div style={{ marginTop: "1.25rem" }}>
            <button className="sd-btn sd-btn--amber sd-btn--lg" disabled={periods.length === 0} onClick={() => setShowWizard(false)}>Start building the timetable</button>
          </div>
        </section>
      ) : (
        <>
          <div className="sd-ledger" role="group" aria-label="Timetable setup and summary">
            {ledger.map((m) => (
              <button key={m.label} type="button" aria-pressed={m.pressed} onClick={m.onClick}>
                <span className="sd-l">{m.label}</span>
                <b className="sd-n">{m.value}</b>
                <small>{m.hint}</small>
              </button>
            ))}
          </div>

          <div className="mc-tabs" role="tablist" aria-label="Timetable views" style={{ justifySelf: "start" }}>
            {([["grid", "Week", filteredSchedules.length], ["list", "All classes", activeSchedules.length], ["workload", "Workload", teachers.length]] as const).map(([id, label, n]) => (
              <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<b>{n}</b></button>
            ))}
          </div>

          {tab !== "workload" && (
            <div className="nt-bar">
              <input type="search" className="sd-field" placeholder="Search subject, teacher or room" aria-label="Search classes" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              {gradeChoices.length > 0 && (
                <ChipGroup
                  label="Grade"
                  value={selectedGrade}
                  options={[["all", "All grades"] as const, ...gradeChoices.map((g) => [g, g] as const)]}
                  onChange={(g) => { setSelectedGrade(g); setSelectedSection("all"); }}
                />
              )}
              {filterSectionsForGrade.length > 0 && (
                <ChipGroup
                  label="Section"
                  value={selectedSection}
                  options={[["all", "All sections"] as const, ...filterSectionsForGrade.map((s) => [s, s] as const)]}
                  onChange={setSelectedSection}
                />
              )}
              {tab === "grid" && <ChipGroup label="Day" value={dayFocus} options={focusOptions} onChange={setDayFocus} />}
            </div>
          )}

          {tab === "grid" && (
            <>
              <section className="sd-panel ts-comp" aria-label="Completion by class">
                <button type="button" className="ts-comp-toggle" aria-expanded={showCompletionTracker} onClick={() => setShowCompletionTracker(!showCompletionTracker)}>
                  <b>How complete is each class?</b>
                  <span className="sm-chip">{plural(completionStats.length, "class", "classes")}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
                {showCompletionTracker && (
                  <div className="ts-comp-grid">
                    {completionStats.length === 0 ? (
                      <p className="sm-muted">Add a class and its progress will show here.</p>
                    ) : completionStats.map((stat) => (
                      <button key={stat.label} type="button" onClick={() => { setSelectedGrade(stat.grade); setSelectedSection(stat.section ?? "all"); }}>
                        <span><b>{stat.label}</b><i>{stat.percentage}%</i></span>
                        <i className="tm-bar" aria-hidden="true"><u style={{ width: `${stat.percentage}%` }} /></i>
                        <small>{stat.filled} of {stat.total} slots filled</small>
                      </button>
                    ))}
                  </div>
                )}
              </section>
              <ScheduleGrid
                periods={periods}
                schedules={filteredSchedules}
                operatingDays={schoolOperatingDays}
                focus={dayFocus}
                busy={isCopying}
                onAdd={handleAddScheduleGrid}
                onEdit={handleEditSchedule}
                onCopyClass={openCopyClass}
                onRepeat={(s) => void handleRepeatAcrossWeek(s)}
                onDelete={(id) => void handleDeleteSchedule(id)}
                onCopyDay={openCopyDay}
                onSetupPeriods={() => setPeriodDialogOpen(true)}
              />
            </>
          )}
          {tab === "list" && (
            <ScheduleList schedules={filteredSchedules} year={CURRENT_ACADEMIC_YEAR} onEdit={handleEditSchedule} onDelete={(id) => void handleDeleteSchedule(id)} onAdd={openBlankScheduleDialog} />
          )}
          {tab === "workload" && <WorkloadList rows={workloadRows} year={CURRENT_ACADEMIC_YEAR} onOpen={setSelectedTeacherWorkload} />}
        </>
      )}

      <ScheduleFormModal
        open={scheduleDialogOpen}
        editing={!!editingSchedule}
        form={scheduleForm}
        onChange={setScheduleForm}
        locked={lockedFields}
        operatingDays={schoolOperatingDays}
        periods={periods}
        rooms={rooms}
        grades={availableGrades.length > 0 ? availableGrades : AVAILABLE_GRADES}
        sections={sectionsForSelectedGrade}
        subjects={uniqueSubjects}
        teachers={displayTeachers}
        teacherCount={teachers.length}
        matchCount={filteredTeachers.length}
        isMatch={(t) => (scheduleForm.grade ? isTeacherAssigned(t, scheduleForm.subject, scheduleForm.grade, scheduleForm.section) : true)}
        loadOf={getTeacherLoad}
        roomFree={(id) => isRoomAvailable(id, scheduleForm.day_of_week, scheduleForm.period_id || "")}
        suggested={suggestedTeacher}
        conflict={conflictWarning}
        onClose={closeScheduleDialog}
        onSubmit={() => void (editingSchedule ? handleUpdateSchedule() : handleCreateSchedule())}
      />

      <PeriodsModal
        open={periodDialogOpen}
        periods={periods}
        form={periodForm}
        setForm={setPeriodForm}
        editing={editingPeriod}
        error={periodError}
        onClose={() => setPeriodDialogOpen(false)}
        onTemplate={(t) => void handleUseTemplate(t)}
        showCustom={showCustomTemplate}
        setShowCustom={setShowCustomTemplate}
        customStart={customStartTime}
        setCustomStart={setCustomStartTime}
        customCount={customPeriodCount}
        setCustomCount={setCustomPeriodCount}
        customDuration={customDurationMin}
        setCustomDuration={setCustomDurationMin}
        customBreaks={customBreaks}
        setCustomBreaks={setCustomBreaks}
        addCustomBreak={addCustomBreak}
        preview={customDayPreview}
        onApplyCustom={() => void handleApplyCustomTemplate()}
        onInsertBreak={(id, min) => void handleInsertBreak(id, min)}
        onEdit={handleEditPeriod}
        onDelete={(id) => void handleDeletePeriod(id)}
        onCreate={() => void handleCreatePeriod()}
        onUpdate={() => void handleUpdatePeriod()}
        onResetForm={resetPeriodForm}
      />

      <RoomsModal
        open={roomDialogOpen}
        rooms={rooms}
        schedules={schedules}
        form={roomForm}
        setForm={setRoomForm}
        bulk={bulkRoomMode}
        setBulk={setBulkRoomMode}
        bulkCount={bulkRoomCount}
        setBulkCount={setBulkRoomCount}
        editing={editingRoom}
        onClose={closeRoomDialog}
        onCreate={() => void handleCreateRoom()}
        onUpdate={() => void handleUpdateRoom()}
        onEdit={handleEditRoom}
        onDelete={(id) => void handleDeleteRoom(id)}
        onCancelEdit={resetRoomForm}
      />

      <CopyClassModal
        schedule={copyScheduleDialogOpen ? scheduleToCopy : null}
        targetDay={targetDay}
        setTargetDay={setTargetDay}
        operatingDays={schoolOperatingDays}
        busy={isCopying}
        onClose={() => setCopyScheduleDialogOpen(false)}
        onCopy={() => void handleCopyToDay()}
      />

      <CopyDayModal
        source={copyDayDialogOpen ? sourceDayToCopy : null}
        count={schedules.filter((s) => s.day_of_week === sourceDayToCopy && s.is_active).length}
        targets={targetDays}
        setTargets={setTargetDays}
        operatingDays={schoolOperatingDays}
        results={copyResults}
        clearResults={() => setCopyResults(null)}
        busy={isCopying}
        onClose={() => setCopyDayDialogOpen(false)}
        onCopy={() => void handleCopyEntireDay()}
      />

      <PushModal
        open={pushModalOpen}
        teachers={teachersWithSchedules}
        schedules={schedules}
        selected={selectedTeachersToPush}
        setSelected={setSelectedTeachersToPush}
        lastPushed={lastPushTimestamp}
        success={pushSuccessSummary}
        unassigned={unassignedActiveSchedules.length}
        canAutoAssign={teachers.length > 0}
        autoAssigning={isAutoAssigning}
        onAutoAssign={() => void handleAutoAssignTeachers()}
        preview={generatePushPreview}
        busy={isSyncing}
        onClose={() => setPushModalOpen(false)}
        onPush={() => void handlePushToSelectedTeachers()}
      />

      <ValidationModal open={validationModalOpen} year={CURRENT_ACADEMIC_YEAR} results={validationResults} onClose={() => setValidationModalOpen(false)} />

      <TeacherWeekModal teacher={selectedTeacherWorkload} periods={periods} schedules={schedules} year={CURRENT_ACADEMIC_YEAR} onClose={() => setSelectedTeacherWorkload(null)} />
    </div>
  );
}

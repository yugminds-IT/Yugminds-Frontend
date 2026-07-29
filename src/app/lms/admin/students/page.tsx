"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "@/lib/form-persistence";
import ViewStudentDialog from "@/components/admin/ViewStudentDialog";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { StudentManagementTable } from "@/components/ui/table-edit";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff, 
  Upload, 
  Download,
  Users,
  School,
  BookOpen,
  GraduationCap,
  FileSpreadsheet,
  X,
  Loader2,
  RefreshCw,
  Copy,
  Shield
} from "lucide-react";

interface StudentSchool {
  id?: string;
  student_id?: string;
  school_id?: string;
  /** Flattened from API (`toStudentDetail`); prefer this for display */
  school_name?: string | null;
  grade?: string;
  section?: string;
  is_active?: boolean;
  schools?: {
    name?: string;
  };
}

interface Course {
  id: string;
  name: string;
}

interface StudentCourse {
  id: string;
  student_id: string;
  course_id: string;
  progress_percentage?: number;
  courses?: { course_name?: string };
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  parent_name?: string;
  parent_phone?: string;
  /** Plaintext initial password — present only until the student changes it. */
  initial_password?: string | null;
  student_schools?: Array<StudentSchool & {
    schools?: {
      name?: string;
    };
  }>;
  courses?: Course[];
  student_courses?: StudentCourse[];
  progress?: number;
}

/** Flat display fields for DataTable columns */
type StudentTableRow = Student & {
  schoolDisplay: string;
  gradeDisplay: string;
  sectionDisplay: string;
  coursesDisplay: string;
};

function mapStudentToTableRow(student: Student): StudentTableRow {
  const schools = student.student_schools ?? [];
  const schoolDisplay =
    schools.length === 0
      ? "-"
      : schools
          .map((a) => a.school_name || a.schools?.name || "-")
          .join(", ");

  const gradeDisplay =
    schools.length === 0
      ? "-"
      : schools
          .map((assignment) => {
            const gradeValue = assignment.grade || "-";
            if (gradeValue === "-") return "-";
            const g = gradeValue.toString().trim();
            return g.toLowerCase().startsWith("grade") ? g : `Grade ${g}`;
          })
          .join(", ");

  const sectionDisplay =
    schools.length === 0
      ? "-"
      : schools
          .map((a) => {
            if (!a.section) return "-";
            const raw = a.section.trim();
            return raw.toLowerCase().startsWith("section ")
              ? raw.slice(8).trim()
              : raw;
          })
          .join(", ");

  const courseList = student.student_courses ?? [];
  let coursesDisplay = "-";
  if (courseList.length > 0) {
    coursesDisplay = courseList
      .map((c) => String(c.courses?.course_name ?? c.course_id ?? ""))
      .filter(Boolean)
      .join(", ");
  }

  return {
    ...student,
    schoolDisplay,
    gradeDisplay,
    sectionDisplay,
    coursesDisplay,
  };
}

interface SchoolSection {
  id: string;
  name: string;
}

interface SchoolGrade {
  id: string;
  name: string;
  sections: SchoolSection[];
}

interface School {
  id: string;
  name: string;
  number_of_sections?: number;
  grades?: SchoolGrade[];
  gradesOffered?: string[];
}

interface BulkImportData {
  id?: string; // Temporary ID for tracking
  student_name: string;
  father_name?: string;
  phone_number?: string;
  grade: string;
  section: string; // Required field
  school_id?: string; // Will be populated after school selection
  school_name?: string; // For display
  email?: string; // To be assigned
  password?: string; // To be assigned
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

export default function StudentsManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const { schools: rawSchools } = useAdminSchools();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schools = (rawSchools ?? []) as School[];
  const [studentProgressSummary, setStudentProgressSummary] = useState<{
    average_system_progress: number;
    students_completed: number;
  }>({ average_system_progress: 0, students_completed: 0 });
  const [isStudentsLoading, setIsStudentsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students');
  const [isSyncingEnrollments, setIsSyncingEnrollments] = useState(false);
  const [isEnrollingStudent, setIsEnrollingStudent] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isDeleteStudentDialogOpen, setIsDeleteStudentDialogOpen] = useState(false);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [bulkDeleteStudents, setBulkDeleteStudents] = useState<StudentTableRow[] | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeletingStudents, setIsBulkDeletingStudents] = useState(false);
  const [bulkSelectionResetKey, setBulkSelectionResetKey] = useState(0);
  // Bulk move-to-section / bulk enroll (server-side bulk endpoint)
  const [bulkMoveRows, setBulkMoveRows] = useState<StudentTableRow[] | null>(null);
  const [bulkMoveSchoolId, setBulkMoveSchoolId] = useState("");
  const [bulkMoveGrade, setBulkMoveGrade] = useState("");
  const [bulkMoveSection, setBulkMoveSection] = useState("");
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [isBulkEnrolling, setIsBulkEnrolling] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);
  const [updateStudentError, setUpdateStudentError] = useState<string | null>(null);
  const [exportSelectedSchools, setExportSelectedSchools] = useState<string[]>([]);
  const [exportSelectedGrades, setExportSelectedGrades] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [resetPasswordsOnExport, setResetPasswordsOnExport] = useState(false);
  
  // Load saved form data (excluding password for security)
  const savedFormData = typeof window !== 'undefined'
    ? loadFormData<{
        full_name: string;
        email: string;
        school_id: string;
        grade: string;
        section: string;
        parent_name: string;
        parent_phone: string;
      }>('admin-students-form')
    : null;

  const [formData, setFormData] = useState({
    full_name: savedFormData?.full_name || "",
    email: savedFormData?.email || "",
    password: "", // Never save password
    school_id: savedFormData?.school_id || "",
    grade: savedFormData?.grade || "",
    section: savedFormData?.section || "",
    parent_name: savedFormData?.parent_name || "",
    parent_phone: savedFormData?.parent_phone || ""
  });

  // Auto-save student form (excluding password)
  const { isDirty: isFormDirty, clearSavedData } = useAutoSaveForm({
    formId: 'admin-students-form',
    formData: {
      full_name: formData.full_name,
      email: formData.email,
      school_id: formData.school_id,
      grade: formData.grade,
      section: formData.section,
      parent_name: formData.parent_name,
      parent_phone: formData.parent_phone,
      // Intentionally exclude password
    },
    autoSave: true,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: false,
    onLoad: (data) => {
      if (data && !savedFormData) {
        setFormData(prev => ({
          ...prev,
          full_name: data.full_name || prev.full_name,
          email: data.email || prev.email,
          school_id: data.school_id || prev.school_id,
          grade: data.grade || prev.grade,
          section: data.section || prev.section,
          parent_name: data.parent_name || prev.parent_name,
          parent_phone: data.parent_phone || prev.parent_phone,
        }));
      }
    },
    markDirty: true,
  });
  const [bulkData, setBulkData] = useState<BulkImportData[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [bulkImportResults, setBulkImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [bulkImportCredentials, setBulkImportCredentials] = useState<Array<{ name: string; email: string; password: string; grade: string; section: string; school: string }> | null>(null);
  const [credentialsGradeFilter, setCredentialsGradeFilter] = useState<string>('all');
  const [credentialsSectionFilter, setCredentialsSectionFilter] = useState<string>('all');
  const [showStudentPasswords, setShowStudentPasswords] = useState<Record<string, boolean>>({});
  const [selectedSchoolForImport, setSelectedSchoolForImport] = useState<string>('');
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sectionInputMode, setSectionInputMode] = useState<'predefined' | 'custom'>('predefined');
  const [customSection, setCustomSection] = useState("");

  // Standard available grades from Pre-K to Grade 12
  const availableGrades = [
    'Pre-K', 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
    'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
  ];

  // Grades/sections configured for the currently selected school
  const [selectedSchoolGrades, setSelectedSchoolGrades] = useState<SchoolGrade[]>([]);

  // Grades to show in dropdown: school-specific list, or all grades as fallback
  const availableGradesForSchool = useMemo(() => {
    if (selectedSchoolGrades.length > 0) {
      return selectedSchoolGrades.map((g) => g.name);
    }
    return availableGrades;
  }, [selectedSchoolGrades]);

  // Group Step-3 review rows by grade, then by section within each grade,
  // for easier scanning; rows missing a required field or carrying a grade
  // the school doesn't recognize are pulled into a "Needs Review" bucket
  // pinned at the end regardless of their grade/section, so problems can't
  // hide inside a grade or section group. Section filter dropdown (below)
  // narrows the grade groups down to a single section across all grades.
  const REVIEW_GROUP_KEY = "__needs_review__";
  type BulkRow = { student: BulkImportData; index: number };
  const [bulkSectionFilter, setBulkSectionFilter] = useState<string>("all");

  // Every distinct, non-empty section value present in the parsed data —
  // drives the filter dropdown regardless of what the school's own section
  // list looks like (imported data may use section names outside it).
  const availableBulkSections = useMemo(() => {
    const set = new Set<string>();
    bulkData.forEach((s) => {
      const v = s.section?.trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [bulkData]);

  const groupedBulkRows = useMemo(() => {
    const groups = new Map<string, BulkRow[]>();
    bulkData.forEach((student, index) => {
      const trimmedGrade = student.grade?.trim() ?? "";
      const trimmedSection = student.section?.trim() ?? "";
      const missingRequired =
        !student.student_name?.trim() ||
        !trimmedGrade ||
        !trimmedSection ||
        !student.email?.trim();
      const gradeUnknown = !!trimmedGrade && !availableGradesForSchool.includes(trimmedGrade);
      const key = missingRequired || gradeUnknown ? REVIEW_GROUP_KEY : trimmedGrade;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ student, index });
    });

    const bySectionFilter = (rows: BulkRow[]) =>
      bulkSectionFilter === "all"
        ? rows
        : rows.filter((r) => r.student.section?.trim() === bulkSectionFilter);

    const ordered: {
      key: string;
      label: string;
      rows: BulkRow[];
      subgroups?: { section: string; rows: BulkRow[] }[];
    }[] = [];

    availableGradesForSchool.forEach((grade) => {
      const rows = bySectionFilter(groups.get(grade) ?? []);
      if (!rows.length) return;

      const bySection = new Map<string, BulkRow[]>();
      rows.forEach((row) => {
        const section = row.student.section!.trim();
        if (!bySection.has(section)) bySection.set(section, []);
        bySection.get(section)!.push(row);
      });
      const subgroups = Array.from(bySection.entries())
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([section, sectionRows]) => ({ section, rows: sectionRows }));

      ordered.push({ key: grade, label: grade, rows, subgroups });
    });

    // Any grade value present in the data but not in the school's list
    // never accumulates here since it's routed into REVIEW_GROUP_KEY above —
    // this loop only covers grades the school actually recognizes. The
    // review bucket stays flat (no section filter applied) so nothing with
    // missing data can be hidden by the section filter.
    const reviewRows = groups.get(REVIEW_GROUP_KEY);
    if (reviewRows?.length) {
      ordered.push({
        key: REVIEW_GROUP_KEY,
        label: "Needs Review — Missing or Unrecognized Data",
        rows: reviewRows,
      });
    }
    return ordered;
  }, [bulkData, availableGradesForSchool, bulkSectionFilter]);

  // Sections to show in dropdown: grade-specific list, or A-L as fallback
  const availableSectionsForGrade = useMemo(() => {
    if (selectedSchoolGrades.length > 0 && formData.grade) {
      const gradeObj = selectedSchoolGrades.find((g) => g.name === formData.grade);
      if (gradeObj && gradeObj.sections.length > 0) {
        return gradeObj.sections.map((s) => s.name);
      }
    }
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  }, [selectedSchoolGrades, formData.grade]);

  useEffect(() => {
    loadData();
  }, []);

  // When a school is selected for bulk import, reflect it in preview rows
  useEffect(() => {
    if (!selectedSchoolForImport) return;
    if (!bulkData || bulkData.length === 0) return;
    const selectedSchool = schools.find((s: School) => s.id === selectedSchoolForImport);
    const schoolName = selectedSchool?.name || '';
    
    // Update school_id and school_name in bulk data
    setBulkData((prev) =>
      prev.map((item: BulkImportData) => ({
        ...item,
        school_id: selectedSchoolForImport,
        school_name: item.school_name && String(item.school_name).trim() !== '' ? item.school_name : schoolName,
      }))
    );
    
    // Update grade/section options when school changes for bulk import
    setSelectedSchoolGrades(selectedSchool?.grades ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bulkData excluded to avoid update loops
  }, [selectedSchoolForImport, schools]);

  // Removed automatic test student creation to prevent continuous loading
  // Students should be added manually through the "Add Student" button or bulk import

  const loadData = async () => {
    setIsStudentsLoading(true);
    try {
      try {
        // Paged loading: pages are fetched in parallel and merged. Replaces the
        // old single limit:5000 fetch that silently truncated larger datasets.
        const PAGE_SIZE = 500;
        const parsePage = (responseData: unknown) => {
          const root = responseData as Record<string, unknown> | undefined;
          const payload =
            root?.data != null &&
            typeof root.data === 'object' &&
            !Array.isArray(root.data)
              ? (root.data as Record<string, unknown>)
              : root;
          const list = payload?.students;
          return {
            students: Array.isArray(list) ? (list as Student[]) : [],
            total:
              typeof payload?.total === 'number' ? (payload.total as number)
              : typeof root?.total === 'number' ? (root.total as number)
              : null,
            totalPages:
              typeof payload?.totalPages === 'number' ? (payload.totalPages as number) : 1,
          };
        };

        const firstRes = await adminApi.students.list({ page: 1, limit: PAGE_SIZE });
        const first = parsePage(firstRes.data);
        let loadedStudents: Student[] = first.students;
        const apiTotal: number | null = first.total;
        setTotalStudentsCount(apiTotal ?? loadedStudents.length);

        // Fetch remaining pages (bounded) so exports/filters still see everything.
        const remaining = Math.min(first.totalPages, 40) - 1;
        if (remaining > 0) {
          const pages = await Promise.all(
            Array.from({ length: remaining }, (_, i) =>
              adminApi.students.list({ page: i + 2, limit: PAGE_SIZE }).then((r) => parsePage(r.data).students).catch(() => [] as Student[]),
            ),
          );
          loadedStudents = loadedStudents.concat(...pages);
        }

        type ProgressRow = {
          student_id?: string;
          average_progress?: number;
          courses?: Array<{
            course_id: string;
            course_name?: string;
            progress_percentage?: number;
          }>;
        };

        const progressById = new Map<
          string,
          { average_progress: number; courses: ProgressRow['courses'] }
        >();
        let summary: {
          average_system_progress?: number;
          students_completed?: number;
        } = {};

        try {
          const progRes = await adminApi.studentProgress.list({
            limit: 5000,
            offset: 0,
          });
          const raw = progRes.data as Record<string, unknown>;
          const payload =
            raw?.data && typeof raw.data === 'object'
              ? (raw.data as Record<string, unknown>)
              : raw;
          const list = (payload?.students as ProgressRow[]) ?? [];
          summary = (payload?.summary as typeof summary) ?? {};
          for (const p of list) {
            if (p?.student_id == null) continue;
            progressById.set(String(p.student_id), {
              average_progress: Number(p.average_progress ?? 0),
              courses: p.courses ?? [],
            });
          }
        } catch (e) {
          console.error('Error loading student progress:', e);
        }

        setStudentProgressSummary({
          average_system_progress: Number(
            summary.average_system_progress ?? 0,
          ),
          students_completed: Number(summary.students_completed ?? 0),
        });

        const transformedStudents = loadedStudents.map((student: Student) => {
          const pr = progressById.get(String(student.id));
          const student_courses = (pr?.courses ?? []).map(
            (c, idx: number) => ({
              id: `${student.id}-${c.course_id}-${idx}`,
              student_id: String(student.id),
              course_id: c.course_id,
              progress_percentage: c.progress_percentage,
              courses: { course_name: c.course_name ?? '' },
            }),
          );
          return {
            ...student,
            student_schools: student.student_schools || [],
            student_courses,
            progress: pr?.average_progress ?? 0,
          };
        });

        setStudents(transformedStudents);
      } catch (apiError: unknown) {
        console.error('Error loading students via API:', apiError);
        const status = (apiError as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          toast.error('Authentication required. Please log in again.');
        }
        setStudents([]);
        setStudentProgressSummary({
          average_system_progress: 0,
          students_completed: 0,
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setStudents([]);
    } finally {
      setIsStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (formData.school_id && schools.length) {
      const selectedSchool = schools.find((s: School) => s.id === formData.school_id);
      setSelectedSchoolGrades(selectedSchool?.grades ?? []);
    } else if (!formData.school_id) {
      setSelectedSchoolGrades([]);
    }
  }, [formData.school_id, schools]);

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: loadData,
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
    hasUnsavedData: () => {
      // Check if any dialog is open (indicating unsaved changes)
      // Also check if form has unsaved data via Zustand store
      return isDialogOpen || isEditDialogOpen || isFormDirty;
    },
  });

  const handleAddStudent = async () => {
    // Validate required fields
    if (!formData.full_name || !formData.email || !formData.password) {
      setAddStudentError('Please fill in all required fields (Name, Email, Password)');
      return;
    }

    if (!formData.school_id) {
      setAddStudentError('Please select a school');
      return;
    }

    if (!formData.section) {
      setAddStudentError('Please select or enter a section');
      return;
    }

    setIsAddingStudent(true);
    setAddStudentError(null);

    try {
      await adminApi.students.create({
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        school_id: formData.school_id,
        grade: formData.grade || 'Not Specified',
        section: formData.section,
        parent_name: formData.parent_name || null,
        parent_phone: formData.parent_phone || null,
      });

      // Clear saved form data after successful submission
      clearFormData('admin-students-form');
      clearSavedData();

      // Success - reset form and close dialog
      setIsDialogOpen(false);
      setFormData({ full_name: "", email: "", password: "", school_id: "", grade: "", section: "", parent_name: "", parent_phone: "" });
      setSectionInputMode('predefined');
      setCustomSection("");
      setAddStudentError(null);
      
      // Reload students list
      await loadData();
      toast.success('Student created successfully.');
    } catch (error: unknown) {
      console.error('Error adding student:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create student. Please try again.';
      setAddStudentError(errorMessage);
      if (errorMessage.toLowerCase().includes('email already exists')) {
        console.warn('Email conflict detected. User should check if student already exists.');
      }
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleViewStudent = (student: StudentTableRow) => {
    setViewingStudent(student);
    setIsViewDialogOpen(true);
  };

  const handleEnrollStudent = async (student: StudentTableRow) => {
    if (isEnrollingStudent) return;
    setIsEnrollingStudent(student.id);
    try {
      const { data } = await adminApi.students.enroll(student.id);
      const result = data as { new_enrollments?: number } | undefined;
      const count = result?.new_enrollments ?? 0;
      if (count > 0) {
        toast.success(`Enrolled ${student.full_name} in ${count} new course${count !== 1 ? 's' : ''}.`);
        await loadData();
      } else {
        toast.success(`${student.full_name} is already enrolled in all applicable courses.`);
      }
    } catch (error) {
      toast.error(`Failed to enroll ${student.full_name}. Please try again.`);
      console.error('Enroll student error:', error);
    } finally {
      setIsEnrollingStudent(null);
    }
  };

  const handleSyncEnrollments = async () => {
    if (isSyncingEnrollments) return;
    setIsSyncingEnrollments(true);
    try {
      const { data } = await adminApi.students.syncEnrollments();
      const result = data as { students_processed?: number; students_updated?: number; new_enrollments?: number } | undefined;
      const updated = result?.students_updated ?? 0;
      const enrolled = result?.new_enrollments ?? 0;
      if (enrolled > 0) {
        toast.success(`Sync complete — enrolled ${enrolled} course${enrolled !== 1 ? 's' : ''} across ${updated} student${updated !== 1 ? 's' : ''}.`);
        await loadData();
      } else {
        toast.success('Sync complete — all students are already up to date.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Enrollment sync failed.';
      if (message.toLowerCase().includes('timeout')) {
        toast.error(
          'Sync is still running on the server or took too long. Refresh the page in a moment — enrollments may already be updated.',
        );
      } else {
        toast.error('Enrollment sync failed. Please try again.');
      }
      console.error('Sync enrollments error:', error);
    } finally {
      setIsSyncingEnrollments(false);
    }
  };

  const handleEditStudent = (student: StudentTableRow) => {
    setEditingStudent(student);
    const schoolAssignment = student.student_schools?.[0];
    const schoolId = schoolAssignment?.school_id || "";
    const sectionValue = schoolAssignment?.section || "";

    // Load the school's grades so the dropdowns are filtered correctly
    const editSchool = schools.find((s: School) => s.id === schoolId);
    setSelectedSchoolGrades(editSchool?.grades ?? []);

    const editGrade = schoolAssignment?.grade || "";
    const gradeSections: string[] = (() => {
      const gradeObj = (editSchool?.grades ?? []).find((g) => g.name === editGrade);
      return gradeObj && gradeObj.sections.length > 0
        ? gradeObj.sections.map((s) => s.name)
        : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    })();
    const isPredefined = gradeSections.includes(sectionValue);

    setFormData({
      full_name: student.full_name || "",
      email: student.email || "",
      password: "",
      school_id: schoolId,
      grade: editGrade,
      section: sectionValue,
      parent_name: student.parent_name || "",
      parent_phone: student.parent_phone || ""
    });
    setSectionInputMode(isPredefined ? 'predefined' : 'custom');
    setCustomSection(isPredefined ? "" : sectionValue);
    setNewPassword("");
    setShowNewPassword(false);
    setIsEditDialogOpen(true);
  };

  const requestDeleteStudent = (student: StudentTableRow) => {
    setDeletingStudent(student);
    setIsDeleteStudentDialogOpen(true);
  };

  const requestBulkDeleteStudents = (rows: StudentTableRow[]) => {
    if (rows.length === 0) return;
    setBulkDeleteStudents(rows);
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDeleteStudents = async () => {
    if (!bulkDeleteStudents?.length || isBulkDeletingStudents) return;
    setIsBulkDeletingStudents(true);
    try {
      const targets = bulkDeleteStudents;
      const results = await Promise.allSettled(
        targets.map((s) => adminApi.students.delete(s.id)),
      );
      const succeededIds: string[] = [];
      const failedLabels: string[] = [];
      results.forEach((result, i) => {
        const row = targets[i];
        if (result.status === "fulfilled") {
          succeededIds.push(row.id);
        } else {
          failedLabels.push(row.full_name || row.email || row.id);
        }
      });
      if (succeededIds.length > 0) {
        setStudents((prev) => prev.filter((s) => !succeededIds.includes(s.id)));
        setTotalStudentsCount((prev) => Math.max(0, prev - succeededIds.length));
        toast.success(
          `Deleted ${succeededIds.length} student${succeededIds.length !== 1 ? "s" : ""}.`,
        );
        setBulkSelectionResetKey((k) => k + 1);
      }
      if (failedLabels.length > 0) {
        const preview = failedLabels.slice(0, 5).join(", ");
        toast.error(
          `Could not delete ${failedLabels.length} student${failedLabels.length !== 1 ? "s" : ""}${failedLabels.length > 5 ? " (showing first 5)" : ""}: ${preview}`,
        );
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Bulk delete failed unexpectedly.");
    } finally {
      setIsBulkDeletingStudents(false);
      setIsBulkDeleteDialogOpen(false);
      setBulkDeleteStudents(null);
    }
  };

  const requestBulkMoveStudents = (rows: StudentTableRow[]) => {
    if (rows.length === 0) return;
    setBulkMoveRows(rows);
    setBulkMoveSchoolId("");
    setBulkMoveGrade("");
    setBulkMoveSection("");
  };

  const confirmBulkMoveStudents = async () => {
    if (!bulkMoveRows?.length || !bulkMoveSchoolId || !bulkMoveGrade || isBulkMoving) return;
    setIsBulkMoving(true);
    try {
      const { data } = await adminApi.students.bulk({
        action: "move",
        student_ids: bulkMoveRows.map((r) => r.id),
        school_id: bulkMoveSchoolId,
        grade: bulkMoveGrade,
        ...(bulkMoveSection ? { section: bulkMoveSection } : {}),
      });
      const updated = (data as { updated?: number })?.updated ?? 0;
      toast.success(
        `Moved ${updated} student${updated !== 1 ? "s" : ""} to ${bulkMoveGrade}${bulkMoveSection ? ` · Section ${bulkMoveSection}` : ""}.`,
      );
      if (updated < bulkMoveRows.length) {
        toast.error(
          `${bulkMoveRows.length - updated} selected student${bulkMoveRows.length - updated !== 1 ? "s are" : " is"} not enrolled in that school and ${bulkMoveRows.length - updated !== 1 ? "were" : "was"} skipped.`,
        );
      }
      setBulkMoveRows(null);
      setBulkSelectionResetKey((k) => k + 1);
      await loadData();
    } catch (error) {
      console.error("Bulk move error:", error);
      toast.error("Failed to move selected students.");
    } finally {
      setIsBulkMoving(false);
    }
  };

  const handleBulkEnrollStudents = async (rows: StudentTableRow[]) => {
    if (rows.length === 0 || isBulkEnrolling) return;
    setIsBulkEnrolling(true);
    try {
      const { data } = await adminApi.students.bulk({
        action: "enroll",
        student_ids: rows.map((r) => r.id),
      });
      const res = data as { enrolled?: number; errors?: string[] };
      toast.success(
        `Synced course enrollments for ${res.enrolled ?? 0} student${(res.enrolled ?? 0) !== 1 ? "s" : ""}.`,
      );
      if (res.errors?.length) {
        toast.error(`${res.errors.length} student${res.errors.length !== 1 ? "s" : ""} could not be enrolled.`);
      }
      setBulkSelectionResetKey((k) => k + 1);
    } catch (error) {
      console.error("Bulk enroll error:", error);
      toast.error("Failed to enroll selected students.");
    } finally {
      setIsBulkEnrolling(false);
    }
  };

  const confirmDeleteStudent = async () => {
    if (!deletingStudent || isDeletingStudent) return;
    const student = deletingStudent;
    setIsDeletingStudent(true);
    try {
      await adminApi.students.delete(student.id);
      setStudents((prev) => prev.filter((s: Student) => s.id !== student.id));
      setTotalStudentsCount((prev) => Math.max(0, prev - 1));
      setIsDeleteStudentDialogOpen(false);
      setDeletingStudent(null);
      toast.success(`Student "${student.full_name}" deleted successfully.`);
    } catch (error) {
      console.error('Error deleting student:', error);
      const err = error as { message?: string };
      toast.error(`Failed to delete student. ${err.message ?? 'Please try again.'}`);
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleChangePassword = async () => {
    if (!editingStudent) return;

    if (!newPassword) {
      toast.warning('Please enter a new password.');
      return;
    }
    
    // Validate password strength (8+ chars, uppercase, lowercase, number)
    const { validatePasswordClient } = await import('@/lib/password-validation');
    const passwordError = validatePasswordClient(newPassword);
    if (passwordError) {
      toast.warning(passwordError);
      return;
    }

    setActionLoading('change-password');
    setUpdateStudentError(null);

    try {
      await adminApi.students.update(editingStudent.id, {
        password: newPassword,
        change_password: true,
      });

      toast.success(`Password updated for ${editingStudent.full_name}.`);

      // Reset password field (copy before saving if you need to retain it elsewhere)
      setNewPassword("");
      
      // Refresh the student list to get updated data
      await loadData();
     
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      setUpdateStudentError(error instanceof Error ? error.message : 'Failed to change password. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const generateNewPassword = () => {
    // Generate password that meets requirements: 8+ chars, uppercase, lowercase, number
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;
    
    let password = '';
    // Ensure at least one of each required type
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    
    // Fill the rest randomly (minimum 8 chars total, generate 12 for better security)
    for (let i = password.length; i < 12; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    setNewPassword(password);
  };

  const copyNewPassword = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success('Password copied to clipboard.');
    } catch (err) {
      console.error('Failed to copy password:', err);
      toast.error('Failed to copy password to clipboard.');
    }
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;

    // Validate required fields
    if (!formData.full_name || !formData.email || !formData.section) {
      setUpdateStudentError('Please fill in all required fields (Name, Email, Section)');
      return;
    }

    if (!formData.school_id) {
      setUpdateStudentError('Please select a school');
      return;
    }

    // Validate school_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(formData.school_id)) {
      console.error('Invalid school_id format:', formData.school_id);
      setUpdateStudentError(`Invalid school selected. Please select a valid school. (ID: ${formData.school_id})`);
      return;
    }

    // Verify selected school exists in schools list
    const selectedSchool = schools.find((s: School) => s.id === formData.school_id);
    if (!selectedSchool) {
      console.error('Selected school not found in schools list:', formData.school_id);
      setUpdateStudentError('Selected school not found. Please select a valid school.');
      return;
    }

    setIsUpdatingStudent(true);
    setUpdateStudentError(null);

    try {
      await adminApi.students.update(editingStudent.id, {
        full_name: formData.full_name,
        email: formData.email,
        school_id: formData.school_id,
        grade: formData.grade || 'Not Specified',
        section: formData.section,
        parent_name: formData.parent_name || null,
        parent_phone: formData.parent_phone || null,
      });

      // Success - reset form and close dialog
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      setFormData({ full_name: "", email: "", password: "", school_id: "", grade: "", section: "", parent_name: "", parent_phone: "" });
      setSectionInputMode('predefined');
      setCustomSection("");
      setNewPassword(""); // Reset new password
      setShowNewPassword(false); // Reset new password visibility
      setUpdateStudentError(null);
      
      // Reload students list
      await loadData();
      toast.success('Student updated successfully.');
    } catch (error: unknown) {
      console.error('Error updating student:', error);
      setUpdateStudentError(error instanceof Error ? error.message : 'Failed to update student. Please try again.');
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const handleBulkImport = async () => {
    if (bulkData.length === 0) {
      setBulkImportError('No data to import. Please upload a file first.');
      return;
    }

    if (!selectedSchoolForImport) {
      setBulkImportError('Please select a school for all students.');
      return;
    }

    // Validate required fields. Password is intentionally not required here —
    // the backend auto-generates one per student when left blank.
    const invalidRows = bulkData
      .map((item: BulkImportData, index: number) => ({ item, index }))
      .filter(({ item }) => {
        const hasName = item.student_name && item.student_name.trim() !== '';
        const hasGrade = item.grade && item.grade.trim() !== '';
        const hasSection = item.section && item.section.trim() !== '';
        const hasEmail = item.email && item.email.trim() !== '';
        return !hasName || !hasGrade || !hasSection || !hasEmail;
      });

    if (invalidRows.length > 0) {
      const missingFields = invalidRows.map(({ item, index }) => {
        const missing: string[] = [];
        if (!item.student_name?.trim()) missing.push('Name');
        if (!item.grade?.trim()) missing.push('Grade');
        if (!item.section?.trim()) missing.push('Section');
        if (!item.email?.trim()) missing.push('Email');
        return `Row ${index + 1}: ${missing.join(', ')}`;
      }).slice(0, 5); // Show first 5 errors

      setBulkImportError(
        `${invalidRows.length} row(s) are missing required fields:\n${missingFields.join('\n')}${invalidRows.length > 5 ? `\n... and ${invalidRows.length - 5} more` : ''}`
      );
      return;
    }

    // Catch in-file duplicate emails (e.g. two students sharing a last name
    // whose emails were never de-duped, or a manual typo) before any
    // network request — the server's dry-run can't be trusted to catch
    // these on its own since it never writes rows to compare against.
    const emailCounts = new Map<string, number[]>();
    bulkData.forEach((item, index) => {
      const email = item.email?.trim().toLowerCase();
      if (!email) return;
      emailCounts.set(email, [...(emailCounts.get(email) ?? []), index]);
    });
    const duplicateGroups = [...emailCounts.entries()].filter(([, indexes]) => indexes.length > 1);
    if (duplicateGroups.length > 0) {
      const lines = duplicateGroups.slice(0, 5).map(
        ([email, indexes]) => `${email}: rows ${indexes.map((i) => i + 1).join(', ')}`
      );
      setBulkImportError(
        `${duplicateGroups.length} email(s) are used by more than one row:\n${lines.join('\n')}${duplicateGroups.length > 5 ? `\n... and ${duplicateGroups.length - 5} more` : ''}`
      );
      return;
    }

    setIsBulkImporting(true);
    setBulkImportError(null);
    setBulkImportResults(null);
    setBulkImportCredentials(null);

    // The backend caps bulk-import requests at 500 rows, so a large file is
    // split into sequential chunks — this is what makes "large data" work
    // without needing a background job or file-upload infra.
    const CHUNK_SIZE = 500;
    const chunks: BulkImportData[][] = [];
    for (let i = 0; i < bulkData.length; i += CHUNK_SIZE) {
      chunks.push(bulkData.slice(i, i + CHUNK_SIZE));
    }

    const toRow = (student: BulkImportData) => ({
      full_name: student.student_name.trim(),
      email: student.email?.trim() || '',
      password: student.password?.trim() || undefined,
      grade: student.grade.trim(),
      section: student.section.trim().toUpperCase(),
      parent_name: student.father_name?.trim() || null,
      parent_phone: student.phone_number?.trim() || null,
    });

    type RowResult = { index: number; email: string | null; success: boolean; error?: string; generated_password?: string };

    try {
      // Dry-run pass: validate every row (duplicate emails, weak supplied
      // passwords, etc.) against the server without writing anything, so a
      // large import can be checked end-to-end before committing.
      const dryRunErrors: string[] = [];
      for (const chunk of chunks) {
        const res = await adminApi.students.bulkImport({
          school_id: selectedSchoolForImport,
          students: chunk.map(toRow),
          dry_run: true,
        });
        const rowResults = (res.data as { results: RowResult[] }).results;
        rowResults.forEach((r, i) => {
          if (!r.success) {
            dryRunErrors.push(`${chunk[i].student_name} (${r.email ?? 'no email'}): ${r.error}`);
          }
        });
      }

      if (dryRunErrors.length > 0) {
        setBulkImportError(
          `${dryRunErrors.length} row(s) failed validation — nothing was imported yet. Fix these and try again:\n${dryRunErrors.slice(0, 10).join('\n')}${dryRunErrors.length > 10 ? `\n... and ${dryRunErrors.length - 10} more` : ''}`
        );
        return;
      }

      // Commit pass: everything validated clean, so create for real.
      const results = { success: 0, failed: 0, errors: [] as string[] };
      const credentials: Array<{ name: string; email: string; password: string; grade: string; section: string; school: string }> = [];
      const importSchoolName = schools.find((s: School) => s.id === selectedSchoolForImport)?.name ?? '';

      for (const chunk of chunks) {
        const res = await adminApi.students.bulkImport({
          school_id: selectedSchoolForImport,
          students: chunk.map(toRow),
          dry_run: false,
        });
        const rowResults = (res.data as { results: RowResult[] }).results;
        rowResults.forEach((r, i) => {
          const student = chunk[i];
          if (r.success) {
            results.success++;
            if (r.generated_password) {
              credentials.push({
                name: student.student_name,
                email: r.email ?? student.email ?? '',
                password: r.generated_password,
                grade: student.grade.trim(),
                section: student.section.trim().toUpperCase(),
                school: importSchoolName,
              });
            }
          } else {
            results.failed++;
            results.errors.push(`${student.student_name}: ${r.error}`);
          }
        });
      }

      // Sort by grade — using the school's own configured grade order (same
      // as the Step 3 review table's grouping) rather than a generic numeric
      // guess, so e.g. "Kindergarten" before "Grade 1" sorts the same way
      // here as it does on screen — then by section, so the credentials
      // read like a class roster: 1A, 1B, 2A, 2B, ...
      const gradeSortKey = (grade: string) => {
        const i = availableGradesForSchool.indexOf(grade);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      credentials.sort((a, b) => {
        const gradeDiff = gradeSortKey(a.grade) - gradeSortKey(b.grade);
        if (gradeDiff !== 0) return gradeDiff;
        if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
        return a.section.localeCompare(b.section, undefined, { numeric: true });
      });

      setBulkImportResults(results);
      setBulkImportCredentials(credentials.length > 0 ? credentials : null);
      setCredentialsGradeFilter('all');
      setCredentialsSectionFilter('all');

      if (results.success > 0) {
        await loadData();
        toast.success(
          `Imported ${results.success} student(s).${results.failed > 0 ? ` ${results.failed} failed.` : ''}`,
        );
        if (results.failed > 0 && results.errors.length > 0) {
          toast.warning(results.errors.slice(0, 5).join(' · '));
        }
      } else {
        toast.error(
          `Failed to import students.${results.errors.length > 0 ? ` ${results.errors.slice(0, 3).join(' · ')}` : ''}`,
        );
      }
    } catch (error: unknown) {
      console.error('Error bulk importing students:', error);
      setBulkImportError(`Bulk import error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBulkImporting(false);
    }
  };

  /** Builds a CSV from `rows` (first row treated as header) and triggers a browser download. */
  const downloadCsv = (filename: string, rows: (string | number)[][]) => {
    const csvContent = rows
      .map((row) => row.map((cell) => {
        const cellStr = String(cell ?? '');
        return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
          ? `"${cellStr.replace(/"/g, '""')}"`
          : cellStr;
      }).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const todayStamp = () => new Date().toISOString().slice(0, 10);

  /** Renders `htmlContent` in a hidden iframe and triggers the browser's print-to-PDF dialog. */
  const printHtmlAsPdf = (htmlContent: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Wait for content to load, then print/save as PDF
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  /** Applies the grade/section filter dropdowns to the just-imported credentials list. */
  const getFilteredBulkImportCredentials = () => {
    if (!bulkImportCredentials) return [];
    return bulkImportCredentials.filter((c) => {
      if (credentialsGradeFilter !== 'all' && c.grade !== credentialsGradeFilter) return false;
      if (credentialsSectionFilter !== 'all' && c.section !== credentialsSectionFilter) return false;
      return true;
    });
  };

  const downloadBulkImportCredentials = (format: 'csv' | 'pdf') => {
    const filtered = getFilteredBulkImportCredentials();
    if (filtered.length === 0) return;

    if (format === 'csv') {
      downloadCsv('student_import_credentials.csv', [
        ['Name', 'Email', 'Password', 'School', 'Grade', 'Section'],
        ...filtered.map((c) => [c.name, c.email, c.password, c.school, c.grade, c.section]),
      ]);
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #2563eb; color: white; padding: 12px; text-align: left; border: 1px solid #1e40af; }
          td { padding: 10px; border: 1px solid #e5e7eb; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .summary { margin-top: 20px; padding: 15px; background-color: #eff6ff; border-left: 4px solid #2563eb; }
        </style>
      </head>
      <body>
        <h1>Student Import Credentials</h1>
        <div class="summary">
          <p><strong>Total Students:</strong> ${filtered.length}</p>
          <p><strong>Grade:</strong> ${credentialsGradeFilter === 'all' ? 'All grades' : credentialsGradeFilter}</p>
          <p><strong>Section:</strong> ${credentialsSectionFilter === 'all' ? 'All sections' : credentialsSectionFilter}</p>
          <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Note:</strong> These are newly generated passwords from this import — save this file securely.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Password</th>
              <th>School</th>
              <th>Grade</th>
              <th>Section</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((c, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td>${c.password}</td>
                <td>${c.school}</td>
                <td>${c.grade}</td>
                <td>${c.section}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    printHtmlAsPdf(htmlContent);
  };

  /** Flattens a student's (possibly multi-school) enrollments into comma-joined display strings. */
  const flattenStudentSchools = (student: Student) => {
    const schools = student.student_schools ?? [];
    if (schools.length === 0) return { schoolNames: '-', grades: '-', sections: '-' };
    return {
      schoolNames: schools.map((a) => a.school_name || a.schools?.name || '-').join(', '),
      grades: schools.map((a) => a.grade || '-').join(', '),
      sections: schools.map((a) => a.section || '-').join(', '),
    };
  };

  const downloadEnrollmentReport = () => {
    if (students.length === 0) {
      toast.error('No student data to export.');
      return;
    }
    const rows: (string | number)[][] = [
      ['Student Name', 'Email', 'School', 'Grade', 'Section', 'Status', 'Parent Name', 'Parent Phone', 'Enrolled On'],
    ];
    students.forEach((student) => {
      const schools = student.student_schools ?? [];
      const enrolledOn = student.created_at ? new Date(student.created_at).toLocaleDateString() : '-';
      if (schools.length === 0) {
        rows.push([student.full_name, student.email, '-', '-', '-', '-', student.parent_name || '-', student.parent_phone || '-', enrolledOn]);
      } else {
        schools.forEach((a) => {
          rows.push([
            student.full_name,
            student.email,
            a.school_name || a.schools?.name || '-',
            a.grade || '-',
            a.section || '-',
            a.is_active === false ? 'Inactive' : 'Active',
            student.parent_name || '-',
            student.parent_phone || '-',
            enrolledOn,
          ]);
        });
      }
    });
    downloadCsv(`enrollment_report_${todayStamp()}.csv`, rows);
  };

  const downloadProgressReport = () => {
    if (students.length === 0) {
      toast.error('No student data to export.');
      return;
    }
    const rows: (string | number)[][] = [
      ['Student Name', 'Email', 'School(s)', 'Grade(s)', 'Section(s)', 'Courses Enrolled', 'Average Progress %', 'Completed Courses'],
    ];
    students.forEach((student) => {
      const { schoolNames, grades, sections } = flattenStudentSchools(student);
      const courses = student.student_courses ?? [];
      const completed = courses.filter((c) => (c.progress_percentage ?? 0) >= 100).length;
      rows.push([
        student.full_name,
        student.email,
        schoolNames,
        grades,
        sections,
        courses.length,
        Math.round(student.progress ?? 0),
        completed,
      ]);
    });
    downloadCsv(`progress_report_${todayStamp()}.csv`, rows);
  };

  const downloadGradeWiseReport = () => {
    if (students.length === 0) {
      toast.error('No student data to export.');
      return;
    }
    const buckets = new Map<string, { total: number; active: number; progressSum: number }>();
    students.forEach((student) => {
      const schools = student.student_schools ?? [];
      schools.forEach((a) => {
        const grade = a.grade || 'Unspecified';
        const bucket = buckets.get(grade) ?? { total: 0, active: 0, progressSum: 0 };
        bucket.total += 1;
        if (a.is_active !== false) bucket.active += 1;
        bucket.progressSum += student.progress ?? 0;
        buckets.set(grade, bucket);
      });
    });
    const rows: (string | number)[][] = [['Grade', 'Total Students', 'Active Students', 'Average Progress %']];
    [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([grade, b]) => {
        rows.push([grade, b.total, b.active, b.total > 0 ? Math.round(b.progressSum / b.total) : 0]);
      });
    downloadCsv(`grade_wise_report_${todayStamp()}.csv`, rows);
  };

  const downloadSchoolWiseReport = () => {
    if (students.length === 0) {
      toast.error('No student data to export.');
      return;
    }
    const buckets = new Map<string, { total: number; active: number; progressSum: number; grades: Set<string> }>();
    students.forEach((student) => {
      const schools = student.student_schools ?? [];
      schools.forEach((a) => {
        const school = a.school_name || a.schools?.name || 'Unspecified';
        const bucket = buckets.get(school) ?? { total: 0, active: 0, progressSum: 0, grades: new Set<string>() };
        bucket.total += 1;
        if (a.is_active !== false) bucket.active += 1;
        bucket.progressSum += student.progress ?? 0;
        if (a.grade) bucket.grades.add(a.grade);
        buckets.set(school, bucket);
      });
    });
    const rows: (string | number)[][] = [['School', 'Total Students', 'Grades Offered', 'Active Students', 'Average Progress %']];
    [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([school, b]) => {
        rows.push([school, b.total, b.grades.size, b.active, b.total > 0 ? Math.round(b.progressSum / b.total) : 0]);
      });
    downloadCsv(`school_wise_report_${todayStamp()}.csv`, rows);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    // Validate file type by MIME type AND extension before parsing
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', // some OS report CSV as text/plain
      'application/octet-stream', // fallback for some Excel files
    ];
    const allowedExtensions = ['csv', 'xlsx', 'xls'];

    if (!allowedExtensions.includes(fileExtension ?? '')) {
      setBulkImportError(`Unsupported file type ".${fileExtension}". Please upload a CSV or Excel (.xlsx, .xls) file.`);
      event.target.value = '';
      return;
    }

    if (file.type && !allowedMimeTypes.includes(file.type)) {
      setBulkImportError(`Invalid file format (MIME type: ${file.type}). Please upload a valid CSV or Excel file.`);
      event.target.value = '';
      return;
    }

    // 10MB max size guard
    if (file.size > 10 * 1024 * 1024) {
      setBulkImportError('File too large. Maximum allowed size is 10MB.');
      event.target.value = '';
      return;
    }

    setUploadFile(file);
    setBulkImportError(null);
    setBulkImportResults(null);
    setIsParsingFile(true);

    try {
      let parsedData: BulkImportData[] = [];

      if (fileExtension === 'csv') {
        const normalizeKey = (k: string) => String(k || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
        const getValue = (row: Record<string, unknown>, candidates: string[]) => {
          const byNormalized: Record<string, unknown> = {};
          Object.keys(row || {}).forEach((key) => {
            byNormalized[normalizeKey(key)] = row[key];
          });
          for (const c of candidates) {
            const v = byNormalized[normalizeKey(c)];
            if (v !== undefined && v !== null) return String(v).trim();
          }
          return '';
        };

        // Parse CSV using PapaParse (loaded on demand)
        const Papa = (await import('papaparse')).default;
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results: { data?: Array<Record<string, unknown>>; meta?: { fields?: string[] } }) => {
            try {
              const rows = (results?.data || []) as Array<Record<string, unknown>>;

              parsedData = rows.map((row: Record<string, unknown>, index: number) => {
                // Flexible column mapping (case-insensitive, ignores spaces/underscores/dashes)
                const studentName = getValue(row, ['Student Name', 'student_name', 'StudentName', 'Name', 'Full Name', 'full_name']);
                const fatherName = getValue(row, ['Father Name', 'father_name', 'Father', 'Parent Name', 'parent_name']);
                const phoneNumber = getValue(row, ['Phone Number', 'phone_number', 'Phone', 'phone', 'Contact', 'contact']);
                const grade = getValue(row, ['Grade', 'grade', 'Class', 'class', 'Level', 'level']);
                const section = getValue(row, ['Section', 'section', 'Class Section', 'class_section', 'Section Name', 'section_name']);
                const schoolName = getValue(row, ['School', 'school', 'School Name', 'school_name', 'SchoolName']);
                const selectedSchoolName = selectedSchoolForImport
                  ? (schools.find((s: School) => s.id === selectedSchoolForImport)?.name || '')
                  : '';

                return {
                  id: `temp-${index}`,
                  student_name: studentName,
                  father_name: fatherName,
                  phone_number: phoneNumber,
                  grade: grade,
                  section: section,
                  school_name: schoolName || selectedSchoolName,
                  status: 'pending'
                } as BulkImportData;
              });

              // Normalize grade format (handle "Grade 4", "4", "grade 4", etc.)
              const normalizeGrade = (grade: string): string => {
                if (!grade || !grade.trim()) return '';
                const trimmed = grade.trim();
                // If it already starts with "Grade ", return as is
                if (trimmed.match(/^grade\s+\d+/i)) {
                  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
                }
                // If it's just a number, add "Grade " prefix
                if (trimmed.match(/^\d+$/)) {
                  return `Grade ${trimmed}`;
                }
                // Otherwise return as is (might be custom format)
                return trimmed;
              };

              const validData = parsedData
                .map((item: BulkImportData) => ({
                  ...item,
                  grade: normalizeGrade(item.grade || ''),
                  section: (item.section || '').trim().toUpperCase(), // Normalize section to uppercase
                  school_id: selectedSchoolForImport || undefined, // Set school_id from selection
                }))
                .filter((item: BulkImportData) =>
                  Boolean(
                    item.student_name && 
                    item.student_name.trim() !== '' && 
                    item.grade && 
                    item.grade.trim() !== '' &&
                    item.section && 
                    item.section.trim() !== '' // Require section
                  )
                );

              if (validData.length === 0) {
                const headerFields = Array.isArray(results?.meta?.fields) ? results.meta.fields : [];
                setBulkData([]);
                setBulkImportError(
                  `No valid rows found in CSV. Ensure it has columns: "Student Name", "Grade", and "Section" with at least one row with values.\nDetected headers: ${headerFields.join(', ') || '(none)'}`
                );
              } else {
                setBulkData(validData);
                setBulkImportError(null);
                if (selectedSchoolForImport) autoFillEmails(selectedSchoolForImport);
              }
            } finally {
              setIsParsingFile(false);
              // Allow re-selecting the same file again
              event.target.value = '';
            }
          },
          error: (error: { message?: string }) => {
            setBulkImportError(`Error parsing CSV: ${error.message || 'Unknown error'}`);
            setIsParsingFile(false);
            // Allow re-selecting the same file again
            event.target.value = '';
          }
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Parse Excel using ExcelJS (secure alternative to xlsx)
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
              setBulkImportError('Failed to read Excel file.');
              setIsParsingFile(false);
              return;
            }
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            
            if (!workbook.worksheets || workbook.worksheets.length === 0) {
              setBulkImportError('Excel file appears to be empty or invalid. Please check the file and try again.');
              setIsParsingFile(false);
              return;
            }
            
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
              setBulkImportError('Could not read worksheet from Excel file. Please check the file format.');
              setIsParsingFile(false);
              return;
            }
            
            const jsonData: Array<Record<string, string>> = [];
            const columnNames: string[] = [];
            
            const stringifyCell = (v: unknown): string => {
              if (v == null) return '';
              if (typeof v === 'object' && v !== null && 'text' in v) return String((v as { text?: string }).text ?? '');
              return String(v);
            };
            
            const headerRow = worksheet.getRow(1);
            if (headerRow && headerRow.cellCount > 0) {
              headerRow.eachCell({ includeEmpty: false }, (cell, _colNumber) => {
                const headerValue = stringifyCell(cell.value).trim();
                if (headerValue) columnNames.push(headerValue);
              });
            }
            
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              if (rowNumber === 1) return;
              const rowData: Record<string, string> = {};
              row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                const headerName = columnNames[colNumber - 1] || `Column${colNumber}`;
                rowData[headerName] = stringifyCell(cell.value);
              });
              if (Object.keys(rowData).length > 0) jsonData.push(rowData);
            });
            
            if (!jsonData || jsonData.length === 0) {
              setBulkImportError('No data found in Excel file. Please ensure the file contains student data with headers.');
              const sheetNames = workbook.worksheets.map((ws) => (ws as { name?: string }).name);
              console.log('Excel file parsed but no data found. Sheet names:', sheetNames);
              setIsParsingFile(false);
              return;
            }

            console.log('Excel data parsed:', jsonData.slice(0, 3)); // Log first 3 rows for debugging
            console.log('Detected columns:', columnNames);

             
            parsedData = jsonData.map((row: Record<string, string>, index: number) => {
              // Flexible column mapping for Excel - try multiple variations
              const studentName = row['Student Name'] || row['student_name'] || row['StudentName'] || row['Name'] || row['name'] || row['Full Name'] || row['full_name'] || '';
              const fatherName = row['Father Name'] || row['father_name'] || row['FatherName'] || row['Father'] || row['father'] || row['Parent Name'] || row['parent_name'] || '';
              const phoneNumber = row['Phone Number'] || row['phone_number'] || row['PhoneNumber'] || row['Phone'] || row['phone'] || row['Contact'] || row['contact'] || '';
              const grade = row['Grade'] || row['grade'] || row['Class'] || row['class'] || row['Level'] || row['level'] || '';
              const section = row['Section'] || row['section'] || row['Class Section'] || row['class_section'] || row['Section Name'] || row['section_name'] || '';
              const schoolName = row['School'] || row['school'] || row['School Name'] || row['school_name'] || row['SchoolName'] || '';
              const selectedSchoolName = selectedSchoolForImport
                ? (schools.find((s: School) => s.id === selectedSchoolForImport)?.name || '')
                : '';
              
              return {
                id: `temp-${index}`,
                student_name: studentName,
                father_name: fatherName,
                phone_number: phoneNumber,
                grade: grade,
                section: section,
                school_name: schoolName || selectedSchoolName,
                status: 'pending'
              } as BulkImportData;
            });

            // Normalize grade format (handle "Grade 4", "4", "grade 4", etc.)
            const normalizeGrade = (grade: string): string => {
              if (!grade || !grade.trim()) return '';
              const trimmed = grade.trim();
              // If it already starts with "Grade ", return as is (normalized)
              if (trimmed.match(/^grade\s+\d+/i)) {
                return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
              }
              // If it's just a number, add "Grade " prefix
              if (trimmed.match(/^\d+$/)) {
                return `Grade ${trimmed}`;
              }
              // Otherwise return as is (might be custom format)
              return trimmed;
            };

            // Filter out rows where required fields are missing and normalize data
            const validData = parsedData
              .map((item: BulkImportData) => ({
                ...item,
                grade: normalizeGrade(item.grade || ''),
                section: (item.section || '').trim().toUpperCase(), // Normalize section to uppercase
                school_id: selectedSchoolForImport || undefined, // Set school_id from selection
              }))
              .filter((item: BulkImportData) => {
                const isValid = 
                  item.student_name && 
                  item.student_name.trim() !== '' && 
                  item.grade && 
                  item.grade.trim() !== '' &&
                  item.section && 
                  item.section.trim() !== ''; // Require section
                if (!isValid) {
                  console.log('Filtered out row:', item);
                }
                return isValid;
              });

            if (validData.length === 0) {
              setBulkImportError(`No valid rows found in Excel file. Please ensure the file contains columns: "Student Name" (or "Name"), "Grade", and "Section". Found columns: ${columnNames.join(', ')}`);
              console.error('All rows were filtered out. Original data length:', parsedData.length);
              setIsParsingFile(false);
              return;
            }

            console.log(`Successfully parsed ${validData.length} student(s) from ${parsedData.length} row(s)`);
            setBulkData(validData);
            setBulkImportError(null); // Clear any previous errors
            if (selectedSchoolForImport) autoFillEmails(selectedSchoolForImport);
            setIsParsingFile(false);
           
          } catch (error: unknown) {
            console.error('Error parsing Excel file:', error);
            const errMsg = error instanceof Error ? error.message : 'Unknown error occurred. Please check the file format and try again.';
            setBulkImportError(`Error parsing Excel file: ${errMsg}`);
            setIsParsingFile(false);
          }
        };
        
        reader.onerror = () => {
          setBulkImportError('Failed to read Excel file. Please try again or use a different file.');
          setIsParsingFile(false);
        };
        
        reader.readAsArrayBuffer(file);
      } else if (fileExtension === 'pdf') {
        // PDF parsing - For now, show message that PDF parsing is not fully supported
        setBulkImportError('PDF parsing is not fully supported. Please use CSV or Excel (.xlsx/.xls) format.');
        return;
      } else {
        setBulkImportError(`Unsupported file format: ${fileExtension}. Please use CSV, XLSX, or XLS.`);
        return;
      }
     
    } catch (error: unknown) {
      console.error('Error uploading file:', error);
      setBulkImportError(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleEditBulkData = (id: string, field: keyof BulkImportData, value: string) => {
    setBulkData(prevData => 
      prevData.map((item: BulkImportData) => 
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleDeleteBulkDataRow = (id: string) => {
    setBulkData(prevData => prevData.filter((item: BulkImportData) => item.id !== id));
  };

  /**
   * Fills any blank `email` fields as `{last_name}@{school-domain}.edu`,
   * derived from the given school's name. Never overwrites an email the
   * admin already typed/edited. Students sharing a last name (e.g. two
   * "Smith"s) would otherwise collide on the same email, so a numeric
   * suffix (smith2@, smith3@, ...) is appended whenever the base email is
   * already taken — by an existing row's email or one just generated in
   * this same pass. Passwords are intentionally left untouched here — they
   * stay blank so the backend auto-generates a unique one per student
   * (surfaced afterward via bulkImportCredentials).
   */
  const autoFillEmails = (schoolId: string) => {
    const schoolName = schools.find((s: School) => s.id === schoolId)?.name?.toLowerCase().replace(/\s+/g, '') || 'school';
    const domain = `@${schoolName}.edu`;

    setBulkData(prev => {
      const taken = new Set(
        prev.filter((item) => item.email).map((item) => item.email!.trim().toLowerCase())
      );

      return prev.map((item) => {
        if (item.email) return item;
        const nameParts = item.student_name.trim().toLowerCase().split(/\s+/);
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

        let email = `${lastName}${domain}`;
        let suffix = 2;
        while (taken.has(email)) {
          email = `${lastName}${suffix}${domain}`;
          suffix++;
        }
        taken.add(email);

        return { ...item, email };
      });
    });
  };

  const downloadSampleCSV = () => {
    // Sample CSV data with headers + 15 example rows (template)
    // Includes different grades and sections to demonstrate the format
    const sampleData = [
      ['Student Name', 'Father Name', 'Phone Number', 'Grade', 'Section'],
      ['Aarav Sharma', 'Rohit Sharma', '+919876543210', 'Grade 4', 'A'],
      ['Anaya Patel', 'Vivek Patel', '+919876543211', 'Grade 4', 'B'],
      ['Vihaan Reddy', 'Suresh Reddy', '+919876543212', 'Grade 4', 'C'],
      ['Diya Gupta', 'Amit Gupta', '+919876543213', 'Grade 5', 'A'],
      ['Arjun Singh', 'Raj Singh', '+919876543214', 'Grade 5', 'B'],
      ['Ishita Nair', 'Manoj Nair', '+919876543215', 'Grade 5', 'C'],
      ['Reyansh Iyer', 'Kiran Iyer', '+919876543216', 'Grade 6', 'A'],
      ['Meera Das', 'Sanjay Das', '+919876543217', 'Grade 6', 'B'],
      ['Kabir Khan', 'Imran Khan', '+919876543218', 'Grade 7', 'A'],
      ['Saanvi Joshi', 'Nitin Joshi', '+919876543219', 'Grade 7', 'B'],
      ['Aditya Verma', 'Ramesh Verma', '+919876543220', 'Grade 8', 'A'],
      ['Priya Mehta', 'Sunil Mehta', '+919876543221', 'Grade 8', 'C'],
      ['Rohan Kapoor', 'Vikram Kapoor', '+919876543222', 'Grade 9', 'A'],
      ['Sneha Agarwal', 'Anil Agarwal', '+919876543223', 'Grade 9', 'B'],
      ['Karan Malhotra', 'Deepak Malhotra', '+919876543224', 'Grade 10', 'A'],
    ];

    downloadCsv('student_import_sample.csv', sampleData);
  };


  const generateLoginCredentials = async () => {
    setIsExporting(true);
    try {
      // Filter students based on selected schools and grades
      interface StudentWithSchools extends Student {
        student_schools?: Array<StudentSchool>;
      }
      
      const filteredStudentsForExport = students.filter((student: StudentWithSchools) => {
        // School filter
        const matchesSchool = exportSelectedSchools.length === 0 || 
          student.student_schools?.some((ss: { school_id?: string }) => exportSelectedSchools.includes(ss.school_id || ''));
        
        // Grade filter
        const matchesGrade = exportSelectedGrades.length === 0 ||
          student.student_schools?.some((ss: { grade?: string }) => exportSelectedGrades.includes(ss.grade || ''));
        
        return matchesSchool && matchesGrade;
      });

      if (filteredStudentsForExport.length === 0) {
        toast.warning('No students found matching the selected criteria.');
        setIsExportDialogOpen(false);
        setIsExporting(false);
        return;
      }

      // Only when explicitly opted in: issue every matched student a brand
      // new password (invalidating their old one) so this export can
      // include a real, working Password column. Chunked at 1000 ids/request
      // to match the backend's cap on the bulk endpoint.
      const passwordMap = new Map<string, string>();
      if (resetPasswordsOnExport) {
        const ids = filteredStudentsForExport.map((s) => s.id);
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const chunk = ids.slice(i, i + CHUNK_SIZE);
          const res = await adminApi.students.bulk({ action: 'reset_password', student_ids: chunk });
          const results = (res.data as { results: Array<{ id: number; new_password: string }> }).results;
          results.forEach((r) => passwordMap.set(String(r.id), r.new_password));
        }
      }

      // Generate student info with school and grade info. Passwords are
      // only ever included when resetPasswordsOnExport was checked — real
      // passwords are bcrypt-hashed and can't otherwise be retrieved.
      // A real password shows up whenever we just reset it, OR the student
      // already has a stored initial password (hasn't changed it yet) —
      // whichever applies, per row. No password shows for students who've
      // already changed theirs and weren't part of a reset.
      const credentials = filteredStudentsForExport.map((student: StudentWithSchools) => {
        const schoolAssignment = student.student_schools?.[0];
        const password = resetPasswordsOnExport
          ? (passwordMap.get(String(student.id)) ?? '')
          : (student.initial_password ?? '');
        return {
          name: student.full_name,
          email: student.email,
          password: password || undefined,
          school:
            schoolAssignment?.school_name ||
            schoolAssignment?.schools?.name ||
            'N/A',
          grade: schoolAssignment?.grade || 'N/A',
          section: schoolAssignment?.section || 'N/A'
        };
      });
      const showPasswordColumn = resetPasswordsOnExport || credentials.some((c) => c.password);

      // Generate filename based on filters
      let filename = resetPasswordsOnExport ? 'student_info_with_new_passwords' : 'student_info';
      if (exportSelectedSchools.length > 0) {
        const schoolNames = exportSelectedSchools
          .map((id: string) => schools.find((s: School) => s.id === id)?.name || id)
          .join('_');
        filename += `_${schoolNames.replace(/\s+/g, '_')}`;
      }
      if (exportSelectedGrades.length > 0) {
        filename += `_${exportSelectedGrades.join('_').replace(/\s+/g, '_')}`;
      }

      if (exportFormat === 'csv') {
        // Create CSV content
        type ExportCredential = { name?: string; email?: string; password?: string; school?: string; grade?: string; section?: string };
        const csvContent = [
          showPasswordColumn ? 'Name,Email,Password,School,Grade,Section' : 'Name,Email,School,Grade,Section',
          ...(credentials as ExportCredential[]).map((c) => showPasswordColumn
            ? `"${c.name ?? ''}","${c.email ?? ''}","${c.password ?? ''}","${c.school ?? ''}","${c.grade ?? ''}","${c.section ?? ''}"`
            : `"${c.name ?? ''}","${c.email ?? ''}","${c.school ?? ''}","${c.grade ?? ''}","${c.section ?? ''}"`)
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (exportFormat === 'pdf') {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 20px;
              }
              h1 {
                color: #2563eb;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 10px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
              }
              th {
                background-color: #2563eb;
                color: white;
                padding: 12px;
                text-align: left;
                border: 1px solid #1e40af;
              }
              td {
                padding: 10px;
                border: 1px solid #e5e7eb;
              }
              tr:nth-child(even) {
                background-color: #f9fafb;
              }
              .summary {
                margin-top: 20px;
                padding: 15px;
                background-color: #eff6ff;
                border-left: 4px solid #2563eb;
              }
            </style>
          </head>
          <body>
            <h1>Student Info Export</h1>
            <div class="summary">
              <p><strong>Total Students:</strong> ${credentials.length}</p>
              <p><strong>Schools:</strong> ${exportSelectedSchools.length === 0 ? 'All Schools' : exportSelectedSchools.map((id: string) => schools.find((s: School) => s.id === id)?.name).filter(Boolean).join(', ')}</p>
              <p><strong>Grades:</strong> ${exportSelectedGrades.length === 0 ? 'All Grades' : exportSelectedGrades.join(', ')}</p>
              <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
              ${resetPasswordsOnExport
                ? '<p><strong>Note:</strong> Every password below is brand new, generated for this export. Previous passwords no longer work.</p>'
                : showPasswordColumn
                  ? '<p><strong>Note:</strong> Passwords shown are the original ones issued at account creation, for students who haven\'t changed them yet. Blank means they\'ve already set their own.</p>'
                  : '<p><strong>Note:</strong> Passwords are not included — they cannot be retrieved once set. Use "Reset Password" on a student\'s profile to issue a new one.</p>'}
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  ${showPasswordColumn ? '<th>Password</th>' : ''}
                  <th>School</th>
                  <th>Grade</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                ${credentials.map((c, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${c.name}</td>
                    <td>${c.email}</td>
                    ${showPasswordColumn ? `<td>${c.password ?? ''}</td>` : ''}
                    <td>${c.school}</td>
                    <td>${c.grade}</td>
                    <td>${c.section}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
          </html>
        `;

        printHtmlAsPdf(htmlContent);
      }

      // Close dialog and reset filters
      setIsExportDialogOpen(false);
      setExportSelectedSchools([]);
      setExportSelectedGrades([]);
      setExportFormat('csv');
      setResetPasswordsOnExport(false);

      toast.success(
        resetPasswordsOnExport
          ? `Exported ${credentials.length} student(s) as ${exportFormat.toUpperCase()} with newly reset passwords. Their previous passwords no longer work.`
          : showPasswordColumn
            ? `Exported ${credentials.length} student(s) as ${exportFormat.toUpperCase()} with their original passwords (only shown for students who haven't changed them yet).`
            : `Exported ${credentials.length} student row(s) as ${exportFormat.toUpperCase()}. Passwords aren't included — use Reset Password for a working one.`,
      );
    } catch (error) {
      console.error('Error generating credentials:', error);
      toast.error('Failed to export credentials. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenExportDialog = () => {
    // If no filters are set, show dialog; otherwise export directly
    if (exportSelectedSchools.length === 0 && exportSelectedGrades.length === 0) {
      setIsExportDialogOpen(true);
    } else {
      generateLoginCredentials();
    }
  };

  const handleSchoolToggle = (schoolId: string) => {
    setExportSelectedSchools(prev => {
      if (prev.includes(schoolId)) {
        return prev.filter((id: string) => id !== schoolId);
      } else {
        return [...prev, schoolId];
      }
    });
  };

  const handleGradeToggle = (grade: string) => {
    setExportSelectedGrades(prev => {
      if (prev.includes(grade)) {
        return prev.filter((g: string) => g !== grade);
      } else {
        return [...prev, grade];
      }
    });
  };

  // Get all unique grades from students
  const getAllGrades = () => {
    const grades = new Set<string>();
    students.forEach(student => {
       
      interface StudentSchool {
        school_id?: string;
        grade?: string;
        section?: string;
        schools?: {
          name?: string;
        };
      }
      
      student.student_schools?.forEach((ss: StudentSchool) => {
        if (ss.grade) grades.add(ss.grade);
      });
    });
    return Array.from(grades).sort((a: string, b: string) => {
      // Sort grades naturally (Grade 1, Grade 2, etc.)
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  };

  // Get all unique sections from students
  const _getAllSections = () => {
    const sections = new Set<string>();
    students.forEach((student: Student) => {
      interface StudentSchool {
        school_id?: string;
        grade?: string;
        section?: string;
        schools?: {
          name?: string;
        };
      }
      
      student.student_schools?.forEach((ss: StudentSchool) => {
        if (ss.section) sections.add(ss.section);
      });
    });
    return Array.from(sections).sort();
  };

  const studentTableRows = useMemo(
    () => students.map(mapStudentToTableRow),
    [students],
  );

  // Real-time derived stats (no dummy values)
  // Count schools that have at least 1 student using the school list's studentCount field.
  // Deriving this from the loaded students array is wrong when students are paginated/limited.
  const activeSchoolsWithStudents = schools.filter(
    (s) => (s as { studentCount?: number }).studentCount != null
      ? ((s as { studentCount?: number }).studentCount ?? 0) > 0
      : true // if studentCount not available, assume active
  ).length;

  return (
    <div className="p-8 bg-white">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
            <p className="text-gray-600 mt-2">Manage student accounts, enrollment, and progress</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStudentsCount || students.length}</div>
                <p className="text-xs text-muted-foreground">Enrolled students</p>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Schools</CardTitle>
                <School className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeSchoolsWithStudents}</div>
                <p className="text-xs text-muted-foreground">
                  {activeSchoolsWithStudents === schools.length
                    ? `All ${schools.length} schools active`
                    : `of ${schools.length} schools have students`}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentProgressSummary.average_system_progress}%</div>
                <p className="text-xs text-muted-foreground">Average course progress</p>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Graduated</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentProgressSummary.students_completed}</div>
                <p className="text-xs text-muted-foreground">Completed all courses</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="import">Bulk Import</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            {/* Students Tab */}
            <TabsContent value="students" className="space-y-6">
              {/* Actions Bar */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex space-x-2 shrink-0">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          onClick={() => {
                            setEditingStudent(null);
                            setFormData({ full_name: "", email: "", password: "", school_id: "", grade: "", section: "", parent_name: "", parent_phone: "" });
                            setSectionInputMode('predefined');
                            setCustomSection("");
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Student
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] bg-white max-h-[90vh] flex flex-col">
                      <DialogHeader className="flex-shrink-0">
                        <DialogTitle>Add New Student</DialogTitle>
                        <DialogDescription>
                          Create a new student account and assign to school
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                        <div className="grid gap-2">
                          <Label htmlFor="full_name">Full Name</Label>
                          <Input
                            id="full_name"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder="Enter full name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="Enter email"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="password">Temporary Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Enter temporary password"
                          />
                          <p className="text-xs text-gray-500">Min 8 chars, uppercase, lowercase &amp; number required.</p>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="school_id">School <span className="text-red-500">*</span></Label>
                          {schools.length === 0 ? (
                            <div className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading schools...
                            </div>
                          ) : (
                            <Select
                              value={formData.school_id || undefined}
                              onValueChange={(value) => {
                                const selectedSchool = schools.find((s: School) => s.id === value);
                                setSelectedSchoolGrades(selectedSchool?.grades ?? []);
                                setFormData({ ...formData, school_id: value, grade: "", section: "" });
                              }}
                            >
                              <SelectTrigger id="school_id" className="w-full">
                                <SelectValue placeholder="Select school" />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
                                {schools.map((school) => (
                                  <SelectItem key={school.id} value={school.id}>
                                    {school.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {schools.length === 0 && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                              <School className="h-3 w-3" />
                              No schools available. Please add schools first.
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="grade">Grade</Label>
                          <Select
                            value={formData.grade || undefined}
                            onValueChange={(value) => {
                              setFormData({ ...formData, grade: value, section: "" });
                              setSectionInputMode('predefined');
                              setCustomSection("");
                            }}
                            disabled={!formData.school_id}
                          >
                            <SelectTrigger id="grade" className="w-full">
                              <SelectValue placeholder={formData.school_id ? "Select grade" : "Select school first"} />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              {availableGradesForSchool.map((grade) => (
                                <SelectItem key={grade} value={grade}>
                                  {grade}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="section">Section <span className="text-red-500">*</span></Label>
                          <Select
                            value={sectionInputMode === 'predefined' ? formData.section || undefined : 'custom'}
                            onValueChange={(value) => {
                              if (value === 'custom') {
                                setSectionInputMode('custom');
                                setFormData({ ...formData, section: customSection });
                              } else {
                                setSectionInputMode('predefined');
                                setFormData({ ...formData, section: value });
                              }
                            }}
                            disabled={!formData.school_id}
                          >
                            <SelectTrigger id="section" className="w-full">
                              <SelectValue placeholder={formData.school_id ? "Select section" : "Select school first"} />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              {availableSectionsForGrade.map((section) => (
                                <SelectItem key={section} value={section}>
                                  {section}
                                </SelectItem>
                              ))}
                              <SelectItem value="custom">Custom...</SelectItem>
                            </SelectContent>
                          </Select>
                          {sectionInputMode === 'custom' && (
                            <Input
                              id="custom_section"
                              value={customSection}
                              onChange={(e) => {
                                setCustomSection(e.target.value);
                                setFormData({ ...formData, section: e.target.value });
                              }}
                              placeholder="Enter custom section (e.g., Alpha, Beta)"
                              className="mt-2"
                            />
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="parent_name">Parent&apos;s Name</Label>
                          <Input
                            id="parent_name"
                            value={formData.parent_name}
                            onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                            placeholder="Enter parent's name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="parent_phone">Parent&apos;s Phone Number</Label>
                          <Input
                            id="parent_phone"
                            type="tel"
                            value={formData.parent_phone}
                            onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                            placeholder="Enter parent's phone number"
                          />
                        </div>
                        {addStudentError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{addStudentError}</p>
                          </div>
                        )}
                      </div>
                      <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setIsDialogOpen(false);
                            setAddStudentError(null);
                            setFormData({ full_name: "", email: "", password: "", school_id: "", grade: "", section: "", parent_name: "", parent_phone: "" });
                            setSectionInputMode('predefined');
                            setCustomSection("");
                          }}
                          disabled={isAddingStudent}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddStudent}
                          disabled={isAddingStudent || !formData.full_name || !formData.email || !formData.password || !formData.school_id || !formData.section}
                          className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAddingStudent ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            'Add Student'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button
                    onClick={handleOpenExportDialog}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Student Info
                  </Button>

                  <Button
                    onClick={handleSyncEnrollments}
                    disabled={isSyncingEnrollments}
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-50"
                  >
                    {isSyncingEnrollments ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync Enrollments
                      </>
                    )}
                  </Button>
                  </div>
                </div>
              </div>


              {/* Students Table */}
              <Card className="bg-white">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Students ({totalStudentsCount || students.length})</CardTitle>
                      <CardDescription>
                        Manage all student accounts — use the table search and column filters to narrow the list.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {students.length === 0 && !isStudentsLoading ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Found</h3>
                      <p className="text-gray-600 mb-4">
                        No students enrolled yet. Add students to get started.
                      </p>
                    </div>
                  ) : (
                    <StudentManagementTable<StudentTableRow>
                      rows={studentTableRows}
                      loading={isStudentsLoading}
                      onView={handleViewStudent}
                      onEdit={handleEditStudent}
                      onDelete={requestDeleteStudent}
                      onEnroll={handleEnrollStudent}
                      onBulkDeleteSelected={requestBulkDeleteStudents}
                      bulkActions={[
                        {
                          id: "move",
                          label: "Move to grade/section",
                          onClick: requestBulkMoveStudents,
                        },
                        {
                          id: "enroll",
                          label: isBulkEnrolling ? "Enrolling…" : "Enroll in courses",
                          onClick: handleBulkEnrollStudents,
                        },
                      ]}
                      resetSelectionKey={bulkSelectionResetKey}
                      searchPlaceholder="Search students by name, email, school, grade..."
                      itemsPerPage={25}
                      emptyMessage="No students match your filters or search."
                      className="shadow-sm"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Delete student confirmation */}
            <Dialog
              open={isDeleteStudentDialogOpen}
              onOpenChange={(open) => {
                setIsDeleteStudentDialogOpen(open);
                if (!open) setDeletingStudent(null);
              }}
            >
              <DialogContent className="bg-white max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete student</DialogTitle>
                  <DialogDescription>
                    This cannot be undone. The student's account, enrollment, and progress will be permanently removed, and their email will be free to reuse.
                  </DialogDescription>
                </DialogHeader>
                {deletingStudent && (
                  <p className="text-sm text-gray-700 py-2">
                    Delete <span className="font-semibold">{deletingStudent.full_name}</span> ({deletingStudent.email})?
                  </p>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDeleteStudentDialogOpen(false);
                      setDeletingStudent(null);
                    }}
                    disabled={isDeletingStudent}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeletingStudent || !deletingStudent}
                    onClick={() => void confirmDeleteStudent()}
                  >
                    {isDeletingStudent ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete student
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Bulk delete confirmation */}
            <Dialog
              open={isBulkDeleteDialogOpen}
              onOpenChange={(open) => {
                setIsBulkDeleteDialogOpen(open);
                if (!open) setBulkDeleteStudents(null);
              }}
            >
              <DialogContent className="bg-white max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete selected students</DialogTitle>
                  <DialogDescription>
                    This cannot be undone. Their accounts, enrollment, and progress will be permanently removed, and their emails will be free to reuse.
                  </DialogDescription>
                </DialogHeader>
                {bulkDeleteStudents && bulkDeleteStudents.length > 0 && (
                  <div className="space-y-2 py-2">
                    <p className="text-sm text-gray-700">
                      Delete{" "}
                      <span className="font-semibold">{bulkDeleteStudents.length}</span>{" "}
                      student{bulkDeleteStudents.length !== 1 ? "s" : ""}?
                    </p>
                    <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-muted-foreground">
                      {bulkDeleteStudents.slice(0, 20).map((s) => (
                        <li key={s.id}>
                          {s.full_name} ({s.email})
                        </li>
                      ))}
                      {bulkDeleteStudents.length > 20 && (
                        <li className="list-none pl-0 text-muted-foreground/80">
                          …and {bulkDeleteStudents.length - 20} more
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
                      setBulkDeleteStudents(null);
                    }}
                    disabled={isBulkDeletingStudents}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isBulkDeletingStudents || !bulkDeleteStudents?.length}
                    onClick={() => void confirmBulkDeleteStudents()}
                  >
                    {isBulkDeletingStudents ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete {bulkDeleteStudents?.length ?? 0} student
                        {(bulkDeleteStudents?.length ?? 0) !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Bulk move to grade/section */}
            <Dialog
              open={!!bulkMoveRows}
              onOpenChange={(open) => {
                if (!open) setBulkMoveRows(null);
              }}
            >
              <DialogContent className="bg-white max-w-md">
                <DialogHeader>
                  <DialogTitle>Move selected students</DialogTitle>
                  <DialogDescription>
                    Updates the grade/section for {bulkMoveRows?.length ?? 0} selected student
                    {(bulkMoveRows?.length ?? 0) !== 1 ? "s" : ""} within the chosen school.
                    Students not enrolled in that school are skipped.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>School</Label>
                    <Select value={bulkMoveSchoolId} onValueChange={(v) => { setBulkMoveSchoolId(v); setBulkMoveGrade(""); setBulkMoveSection(""); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select school" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((s: School) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Grade</Label>
                    <Select value={bulkMoveGrade} onValueChange={(v) => { setBulkMoveGrade(v); setBulkMoveSection(""); }} disabled={!bulkMoveSchoolId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const school = schools.find((s: School) => s.id === bulkMoveSchoolId);
                          const names = (school?.grades ?? []).map((g) => g.name);
                          return (names.length > 0 ? names : availableGrades).map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Section (optional)</Label>
                    <Select value={bulkMoveSection} onValueChange={setBulkMoveSection} disabled={!bulkMoveGrade}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Keep current section" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const school = schools.find((s: School) => s.id === bulkMoveSchoolId);
                          const gradeObj = (school?.grades ?? []).find((g) => g.name === bulkMoveGrade);
                          const names = (gradeObj?.sections ?? []).map((s) => s.name);
                          return (names.length > 0
                            ? names
                            : ["A", "B", "C", "D", "E", "F", "G", "H"]
                          ).map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBulkMoveRows(null)}
                    disabled={isBulkMoving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isBulkMoving || !bulkMoveSchoolId || !bulkMoveGrade}
                    onClick={() => void confirmBulkMoveStudents()}
                  >
                    {isBulkMoving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Moving…
                      </>
                    ) : (
                      <>Move {bulkMoveRows?.length ?? 0} student{(bulkMoveRows?.length ?? 0) !== 1 ? "s" : ""}</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* View Student Dialog — extracted to components/admin/ViewStudentDialog.tsx */}
            <ViewStudentDialog
              open={isViewDialogOpen}
              onOpenChange={setIsViewDialogOpen}
              student={viewingStudent}
            />

            {/* Edit Student Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) {
                setEditingStudent(null);
                setFormData({ full_name: "", email: "", password: "", school_id: "", grade: "", section: "", parent_name: "", parent_phone: "" });
                setSectionInputMode('predefined');
                setCustomSection("");
                setNewPassword(""); // Reset new password
                setShowNewPassword(false); // Reset new password visibility
                setUpdateStudentError(null);
              }
            }}>
              <DialogContent className="sm:max-w-[425px] bg-white max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Edit Student</DialogTitle>
                  <DialogDescription>
                    Update student information and enrollment details
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                  <div className="grid gap-2">
                    <Label htmlFor="edit_full_name">Full Name</Label>
                    <Input
                      id="edit_full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit_email">Email</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <Label>Change Current Password</Label>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">
                        Use this to reset the password if the student has forgotten it. A new password will be generated and assigned.
                      </p>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="new_password"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min 8 chars, uppercase, lowercase, number)"
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
                  <div className="grid gap-2">
                    <Label htmlFor="edit_school_id">School <span className="text-red-500">*</span></Label>
                    {schools.length === 0 ? (
                      <div className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading schools...
                      </div>
                    ) : (
                      <Select
                        value={formData.school_id || undefined}
                        onValueChange={(value) => {
                          const sel = schools.find((s: School) => s.id === value);
                          setSelectedSchoolGrades(sel?.grades ?? []);
                          setFormData({ ...formData, school_id: value, grade: "", section: "" });
                          setSectionInputMode('predefined');
                          setCustomSection("");
                        }}
                      >
                        <SelectTrigger id="edit_school_id" className="w-full">
                          <SelectValue placeholder="Select school" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {schools.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                              {school.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit_grade">Grade</Label>
                    <Select
                      value={formData.grade || undefined}
                      onValueChange={(value) => {
                        setFormData({ ...formData, grade: value, section: "" });
                        setSectionInputMode('predefined');
                        setCustomSection("");
                      }}
                      disabled={!formData.school_id}
                    >
                      <SelectTrigger id="edit_grade" className="w-full">
                        <SelectValue placeholder={formData.school_id ? "Select grade" : "Select school first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {availableGradesForSchool.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit_section">Section <span className="text-red-500">*</span></Label>
                    <Select
                      value={sectionInputMode === 'predefined' ? formData.section || undefined : 'custom'}
                      onValueChange={(value) => {
                        if (value === 'custom') {
                          setSectionInputMode('custom');
                          setFormData({ ...formData, section: customSection });
                        } else {
                          setSectionInputMode('predefined');
                          setFormData({ ...formData, section: value });
                        }
                      }}
                      disabled={!formData.school_id}
                    >
                      <SelectTrigger id="edit_section" className="w-full">
                        <SelectValue placeholder={formData.school_id ? "Select section" : "Select school first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {availableSectionsForGrade.map((section) => (
                          <SelectItem key={section} value={section}>
                            {section}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom...</SelectItem>
                      </SelectContent>
                    </Select>
                    {sectionInputMode === 'custom' && (
                      <Input
                        id="edit_custom_section"
                        value={customSection}
                        onChange={(e) => {
                          setCustomSection(e.target.value);
                          setFormData({ ...formData, section: e.target.value });
                        }}
                        placeholder="Enter custom section (e.g., Alpha, Beta)"
                        className="mt-2"
                      />
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit_parent_name">Parent&apos;s Name</Label>
                    <Input
                      id="edit_parent_name"
                      value={formData.parent_name}
                      onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                      placeholder="Enter parent's name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit_parent_phone">Parent&apos;s Phone Number</Label>
                    <Input
                      id="edit_parent_phone"
                      type="tel"
                      value={formData.parent_phone}
                      onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                      placeholder="Enter parent's phone number"
                    />
                  </div>
                  {updateStudentError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{updateStudentError}</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingStudent(null);
                      setFormData({ full_name: "", email: "", password: "", school_id: "", grade: "", section: "", parent_name: "", parent_phone: "" });
                      setUpdateStudentError(null);
                    }}
                    disabled={isUpdatingStudent}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateStudent}
                    disabled={isUpdatingStudent || !formData.full_name || !formData.email || !formData.school_id || !formData.section}
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingStudent ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Student'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Export Credentials Dialog */}
            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                <DialogHeader>
                  <DialogTitle>Export Student Info</DialogTitle>
                  <DialogDescription>
                    Select schools and/or grades to export student details for specific students. Leave all unchecked to export all students.
                    Passwords can&apos;t be included here — they&apos;re hashed and unrecoverable once set. To get a real working password for a
                    student, use &quot;Reset Password&quot; on their profile, or download credentials right after a Bulk Import (those are real, freshly generated ones).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* School Selection */}
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">Select Schools</CardTitle>
                      <CardDescription>
                        Select one or more schools. Leave unchecked to include all schools.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <Checkbox
                            id="export-all-schools"
                            checked={exportSelectedSchools.length === 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setExportSelectedSchools([]); // Empty means all
                              } else {
                                setExportSelectedSchools([]);
                              }
                            }}
                          />
                          <Label htmlFor="export-all-schools" className="font-medium cursor-pointer">
                            All Schools
                          </Label>
                        </div>
                        {schools.map((school) => (
                          <div key={school.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <Checkbox
                              id={`export-school-${school.id}`}
                              checked={exportSelectedSchools.includes(school.id)}
                              onCheckedChange={() => handleSchoolToggle(school.id)}
                            />
                            <Label htmlFor={`export-school-${school.id}`} className="cursor-pointer">
                              {school.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {exportSelectedSchools.length > 0 && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            Selected: {exportSelectedSchools.map((id: string) => schools.find((s: School) => s.id === id)?.name).filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Grade Selection */}
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">Select Grades</CardTitle>
                      <CardDescription>
                        Select one or more grades. Leave unchecked to include all grades.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <Checkbox
                            id="export-all-grades"
                            checked={exportSelectedGrades.length === 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setExportSelectedGrades([]); // Empty means all
                              } else {
                                setExportSelectedGrades([]);
                              }
                            }}
                          />
                          <Label htmlFor="export-all-grades" className="font-medium cursor-pointer">
                            All Grades
                          </Label>
                        </div>
                        {getAllGrades().map((grade) => (
                          <div key={grade} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <Checkbox
                              id={`export-grade-${grade}`}
                              checked={exportSelectedGrades.includes(grade)}
                              onCheckedChange={() => handleGradeToggle(grade)}
                            />
                            <Label htmlFor={`export-grade-${grade}`} className="cursor-pointer">
                              {grade}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {exportSelectedGrades.length > 0 && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            Selected: {exportSelectedGrades.join(', ')}
                          </p>
                        </div>
                      )}
                      {getAllGrades().length === 0 && (
                        <p className="text-sm text-gray-500">No grades found in the database.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Export Format Selection */}
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">Export Format</CardTitle>
                      <CardDescription>
                        Choose the file format for the exported student info
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col space-y-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="format-csv"
                            name="exportFormat"
                            value="csv"
                            checked={exportFormat === 'csv'}
                            onChange={(e) => setExportFormat(e.target.value as 'csv' | 'pdf')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor="format-csv" className="cursor-pointer font-medium">
                            CSV (Comma Separated Values)
                          </Label>
                        </div>
                        <p className="text-xs text-gray-500 ml-6">
                          Best for spreadsheet applications like Excel or Google Sheets
                        </p>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="format-pdf"
                            name="exportFormat"
                            value="pdf"
                            checked={exportFormat === 'pdf'}
                            onChange={(e) => setExportFormat(e.target.value as 'csv' | 'pdf')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor="format-pdf" className="cursor-pointer font-medium">
                            PDF (Portable Document Format)
                          </Label>
                        </div>
                        <p className="text-xs text-gray-500 ml-6">
                          Best for printing or sharing documents. Uses browser&apos;s print dialog to save as PDF
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Password Reset Option */}
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">Passwords</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-start space-x-2">
                        <input
                          type="checkbox"
                          id="reset-passwords-on-export"
                          checked={resetPasswordsOnExport}
                          onChange={(e) => setResetPasswordsOnExport(e.target.checked)}
                          className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="reset-passwords-on-export" className="cursor-pointer font-medium">
                          Reset passwords and include them in this export
                        </Label>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Students who haven&apos;t changed their password yet already show it automatically, no need to check this. Check it to also force a fresh password for students who&apos;ve already changed theirs (or to reissue everyone&apos;s regardless).
                      </p>
                      {resetPasswordsOnExport && (
                        <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                          ⚠ Every selected student&apos;s current password will stop working immediately. This file will contain their only copy of the new one — save it securely.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Export Summary */}
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">Export Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          <strong>Schools:</strong> {exportSelectedSchools.length === 0 ? 'All Schools' : `${exportSelectedSchools.length} selected`}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Grades:</strong> {exportSelectedGrades.length === 0 ? 'All Grades' : `${exportSelectedGrades.length} selected`}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>File Format:</strong> {exportFormat.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Columns:</strong> {resetPasswordsOnExport ? 'Name, Email, Password, School, Grade, Section' : 'Name, Email, School, Grade, Section (+ Password, for students who still have their original one)'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsExportDialogOpen(false);
                      setExportSelectedSchools([]);
                      setExportSelectedGrades([]);
                      setExportFormat('csv');
                      setResetPasswordsOnExport(false);
                    }}
                    disabled={isExporting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={generateLoginCredentials}
                    disabled={isExporting}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export Student Info
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Bulk Import Tab */}
            <TabsContent value="import" className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle>Bulk Import Students</CardTitle>
                  <CardDescription>Select a school, then upload a filled-in template to create students in bulk.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Step 1: Select School */}
                  <div>
                    <Label className="font-medium">Step 1: Select School <span className="text-red-500">*</span></Label>
                    <p className="text-sm text-gray-500 mb-2">All students in this import will be assigned to the selected school.</p>
                    {schools.length === 0 ? (
                      <div className="w-full max-w-md p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading schools...
                      </div>
                    ) : (
                      <Select
                        value={selectedSchoolForImport}
                        onValueChange={(value) => {
                          const selectedSchool = schools.find((s: School) => s.id === value);
                          setSelectedSchoolGrades(selectedSchool?.grades ?? []);
                          setSelectedSchoolForImport(value);
                        }}
                      >
                        <SelectTrigger className="w-full max-w-md">
                          <SelectValue placeholder="Select school for all students" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {schools.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                              {school.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Step 2: Upload */}
                  <div>
                    <Label className="font-medium">Step 2: Upload File</Label>
                    <p className="text-sm text-gray-500 mb-2">
                      CSV or Excel (.xlsx, .xls). Columns: Student Name, Father Name, Phone Number, Grade, Section.
                    </p>
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center ${!selectedSchoolForImport ? 'border-gray-200' : 'border-gray-300'}`}>
                      <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2">Upload File</h3>
                      <p className="text-gray-600 mb-4 text-sm">
                        {selectedSchoolForImport
                          ? 'Upload a CSV or Excel file with your students.'
                          : 'Select a school above first.'}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="bulk-file-upload-tab"
                          disabled={!selectedSchoolForImport}
                        />
                        <label
                          htmlFor="bulk-file-upload-tab"
                          className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white ${
                            selectedSchoolForImport ? 'text-gray-700 hover:bg-gray-50 cursor-pointer' : 'text-gray-400 cursor-not-allowed pointer-events-none'
                          }`}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Choose File
                        </label>
                        <Button type="button" variant="outline" onClick={downloadSampleCSV}>
                          <Download className="mr-2 h-4 w-4" />
                          Download Template
                        </Button>
                      </div>
                      {uploadFile && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-blue-600 font-medium">
                            ✓ Selected: {uploadFile.name}
                          </p>
                          {isParsingFile && (
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Parsing file...</span>
                            </div>
                          )}
                          {!isParsingFile && bulkData.length > 0 && (
                            <p className="text-sm text-green-600 font-medium">
                              ✓ Successfully parsed {bulkData.length} student(s) — emails auto-filled from the school name
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {bulkImportError && (
                    <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                      <div className="flex items-start gap-3">
                        <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800 mb-1">Import Error</p>
                          <p className="text-sm text-red-600 whitespace-pre-line">{bulkImportError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {bulkData.length > 0 && (
                    <>
                      {/* Step 3: Review & Edit */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <Label className="font-medium">Step 3: Review & Edit ({bulkData.length} students)</Label>
                            <p className="text-sm text-gray-500">
                              Emails are auto-filled from the school name. Passwords are left blank so each student gets a unique auto-generated one — type one only to override.
                            </p>
                          </div>
                          <Button
                            onClick={handleBulkImport}
                            disabled={isBulkImporting || !selectedSchoolForImport || bulkData.some((item: BulkImportData) => !item.student_name || !item.grade || !item.section || !item.email)}
                            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 shrink-0"
                          >
                            {isBulkImporting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing Students...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Import {bulkData.length} Student{bulkData.length !== 1 ? 's' : ''}
                              </>
                            )}
                          </Button>
                        </div>
                        {(() => {
                          const missingPhone = bulkData.filter((s) => !s.phone_number?.trim()).length;
                          const missingFather = bulkData.filter((s) => !s.father_name?.trim()).length;
                          const unknownGrade = bulkData.filter(
                            (s) => s.grade?.trim() && !availableGradesForSchool.includes(s.grade.trim())
                          ).length;
                          const notes: string[] = [];
                          if (missingPhone > 0) notes.push(`${missingPhone} missing phone number`);
                          if (missingFather > 0) notes.push(`${missingFather} missing father's name`);
                          if (unknownGrade > 0) notes.push(`${unknownGrade} grade not in this school's list`);
                          if (notes.length === 0) return null;
                          return (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 mb-2">
                              ⚠ {notes.join(' · ')} — these won't block the import, just double-check them below.
                            </p>
                          );
                        })()}
                        {availableBulkSections.length > 1 && (
                          <div className="flex items-center gap-2 mb-2">
                            <Label className="text-xs text-gray-500 font-normal">Filter by section:</Label>
                            <Select value={bulkSectionFilter} onValueChange={setBulkSectionFilter}>
                              <SelectTrigger className="h-8 text-sm w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
                                <SelectItem value="all">All sections</SelectItem>
                                {availableBulkSections.map((section) => (
                                  <SelectItem key={section} value={section}>
                                    Section {section}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {bulkSectionFilter !== "all" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-gray-500"
                                onClick={() => setBulkSectionFilter("all")}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        )}
                        <div className="max-h-96 overflow-y-auto border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Father Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Grade</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Password</TableHead>
                                <TableHead className="w-16">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            {groupedBulkRows.map((group) => (
                            <TableBody key={group.key}>
                              <TableRow className={group.key === REVIEW_GROUP_KEY ? "bg-amber-50 hover:bg-amber-50" : "bg-gray-50 hover:bg-gray-50"}>
                                <TableCell colSpan={9} className="py-2">
                                  <span className={`text-xs font-semibold uppercase tracking-wide ${group.key === REVIEW_GROUP_KEY ? "text-amber-700" : "text-gray-500"}`}>
                                    {group.label} · {group.rows.length} student{group.rows.length !== 1 ? "s" : ""}
                                  </span>
                                </TableCell>
                              </TableRow>
                              {(group.subgroups ?? [{ section: null, rows: group.rows }]).map((subgroup, sgIdx) => (
                                <Fragment key={subgroup.section ?? `${group.key}-flat-${sgIdx}`}>
                                  {subgroup.section && (group.subgroups?.length ?? 0) > 1 && (
                                    <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                                      <TableCell colSpan={9} className="py-1.5 pl-8">
                                        <span className="text-[11px] font-medium text-gray-400">
                                          Section {subgroup.section} · {subgroup.rows.length} student{subgroup.rows.length !== 1 ? "s" : ""}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {subgroup.rows.map(({ student, index }) => {
                                const gradeUnknown = !!student.grade?.trim() && !availableGradesForSchool.includes(student.grade.trim());
                                return (
                                <TableRow key={student.id || index}>
                                  <TableCell className="font-medium">{index + 1}</TableCell>
                                  <TableCell>
                                    <Input
                                      value={student.student_name}
                                      onChange={(e) => handleEditBulkData(student.id || `temp-${index}`, 'student_name', e.target.value)}
                                      className={`h-8 text-sm ${!student.student_name?.trim() ? 'border-red-300' : ''}`}
                                      placeholder="Required"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={student.father_name || ''}
                                      onChange={(e) => handleEditBulkData(student.id || `temp-${index}`, 'father_name', e.target.value)}
                                      className={`h-8 text-sm ${!student.father_name?.trim() ? 'border-amber-300' : ''}`}
                                      placeholder="Optional"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={student.phone_number || ''}
                                      onChange={(e) => handleEditBulkData(student.id || `temp-${index}`, 'phone_number', e.target.value)}
                                      className={`h-8 text-sm ${!student.phone_number?.trim() ? 'border-amber-300' : ''}`}
                                      placeholder="Optional"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={student.grade || ''}
                                      onValueChange={(value) => handleEditBulkData(student.id || `temp-${index}`, 'grade', value)}
                                    >
                                      <SelectTrigger className={`h-8 text-sm w-full ${!student.grade?.trim() ? 'border-red-300' : gradeUnknown ? 'border-amber-300' : ''}`}>
                                        <SelectValue placeholder="Select Grade" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white max-h-60">
                                        {availableGradesForSchool.map((grade) => (
                                          <SelectItem key={grade} value={grade}>
                                            {grade}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {gradeUnknown && (
                                      <p className="text-xs text-amber-600 mt-1">Not in this school's grade list — will still be saved as entered</p>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={student.section || ''}
                                      onChange={(e) => handleEditBulkData(student.id || `temp-${index}`, 'section', e.target.value)}
                                      className={`h-8 text-sm ${!student.section?.trim() ? 'border-red-300' : ''}`}
                                      placeholder="Required (e.g., A, B, C)"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="email"
                                      value={student.email || ''}
                                      onChange={(e) => handleEditBulkData(student.id || `temp-${index}`, 'email', e.target.value)}
                                      className={`h-8 text-sm ${!student.email?.trim() ? 'border-red-300' : ''}`}
                                      placeholder="Required"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="relative">
                                      <Input
                                        type={showStudentPasswords[student.id || `temp-${index}`] ? "text" : "password"}
                                        value={student.password || ''}
                                        onChange={(e) => handleEditBulkData(student.id || `temp-${index}`, 'password', e.target.value)}
                                        className="h-8 text-sm pr-10"
                                        placeholder="Optional — auto-generated if blank"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-2 py-1 hover:bg-transparent"
                                        onClick={() => {
                                          const studentId = student.id || `temp-${index}`;
                                          setShowStudentPasswords({ ...showStudentPasswords, [studentId]: !showStudentPasswords[studentId] });
                                        }}
                                        title={showStudentPasswords[student.id || `temp-${index}`] ? "Hide password" : "Show password"}
                                      >
                                        {showStudentPasswords[student.id || `temp-${index}`] ? (
                                          <EyeOff className="h-3 w-3 text-gray-500" />
                                        ) : (
                                          <Eye className="h-3 w-3 text-gray-400" />
                                        )}
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteBulkDataRow(student.id || `temp-${index}`)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                      title="Remove student"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                                );
                                  })}
                                </Fragment>
                              ))}
                            </TableBody>
                            ))}
                          </Table>
                        </div>
                      </div>

                      {/* Import Results */}
                      {bulkImportResults && (
                        <Card className="bg-white">
                          <CardHeader>
                            <CardTitle className="text-lg">Import Results</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex items-center space-x-4">
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <p className="text-lg font-bold text-green-600">{bulkImportResults.success}</p>
                                  <p className="text-xs text-green-600">Success</p>
                                </div>
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <p className="text-lg font-bold text-red-600">{bulkImportResults.failed}</p>
                                  <p className="text-xs text-red-600">Failed</p>
                                </div>
                              </div>
                              {bulkImportResults.errors.length > 0 && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                                  <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                                    {bulkImportResults.errors.map((error, idx) => (
                                      <li key={idx}>• {error}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {bulkImportCredentials && bulkImportCredentials.length > 0 && (() => {
                                const gradesPresent = Array.from(new Set(bulkImportCredentials.map((c) => c.grade)))
                                  .sort((a, b) => {
                                    const ai = availableGradesForSchool.indexOf(a);
                                    const bi = availableGradesForSchool.indexOf(b);
                                    return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
                                  });
                                const sectionsPresent = Array.from(new Set(
                                  bulkImportCredentials
                                    .filter((c) => credentialsGradeFilter === 'all' || c.grade === credentialsGradeFilter)
                                    .map((c) => c.section)
                                )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                                const filteredCount = getFilteredBulkImportCredentials().length;
                                return (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                                  <p className="text-sm text-blue-800">
                                    {bulkImportCredentials.length} student{bulkImportCredentials.length !== 1 ? 's' : ''} got an auto-generated password — download these to share with the school.
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Label className="text-xs text-blue-800 font-normal">Grade:</Label>
                                    <Select
                                      value={credentialsGradeFilter}
                                      onValueChange={(value) => {
                                        setCredentialsGradeFilter(value);
                                        setCredentialsSectionFilter('all');
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-sm w-36 bg-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white">
                                        <SelectItem value="all">All grades</SelectItem>
                                        {gradesPresent.map((grade) => (
                                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Label className="text-xs text-blue-800 font-normal">Section:</Label>
                                    <Select value={credentialsSectionFilter} onValueChange={setCredentialsSectionFilter}>
                                      <SelectTrigger className="h-8 text-sm w-36 bg-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white">
                                        <SelectItem value="all">All sections</SelectItem>
                                        {sectionsPresent.map((section) => (
                                          <SelectItem key={section} value={section}>Section {section}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <span className="text-xs text-blue-700">{filteredCount} student{filteredCount !== 1 ? 's' : ''} match</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button type="button" size="sm" variant="outline" className="bg-white" disabled={filteredCount === 0} onClick={() => downloadBulkImportCredentials('csv')}>
                                      <Download className="mr-2 h-4 w-4" />
                                      CSV
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" className="bg-white" disabled={filteredCount === 0} onClick={() => downloadBulkImportCredentials('pdf')}>
                                      <Download className="mr-2 h-4 w-4" />
                                      PDF
                                    </Button>
                                  </div>
                                </div>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle>Student Reports</CardTitle>
                  <CardDescription>Generate and download student reports</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" className="h-20 flex flex-col" onClick={downloadEnrollmentReport}>
                      <Download className="h-6 w-6 mb-2" />
                      <span>Enrollment Report</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col" onClick={downloadProgressReport}>
                      <Download className="h-6 w-6 mb-2" />
                      <span>Progress Report</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col" onClick={downloadGradeWiseReport}>
                      <Download className="h-6 w-6 mb-2" />
                      <span>Grade-wise Report</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col" onClick={downloadSchoolWiseReport}>
                      <Download className="h-6 w-6 mb-2" />
                      <span>School-wise Report</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
    </div>
  );
}

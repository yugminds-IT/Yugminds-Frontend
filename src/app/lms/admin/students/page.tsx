"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "@/lib/form-persistence";
import ViewStudentDialog from "@/components/admin/ViewStudentDialog";
import BulkDeleteStudentsButton from "@/components/admin/BulkDeleteStudentsButton";
import { requestClose, useDirtySnapshot } from "@/hooks/useUnsavedCloseGuard";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { escapeHtml } from "@/lib/escape-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Copy,
  Shield,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  MoveRight,
} from "lucide-react";
import Modal from "@/components/portal/Modal";
import ConfirmModal from "@/components/portal/ConfirmModal";
import ProgressRun from "@/components/admin/students/ProgressRun";
import StudentsTab from "@/components/admin/students/StudentsTab";
import ReportsTab, { type ReportId } from "@/components/admin/students/ReportsTab";
import { bandOf, plural, type Band } from "@/components/admin/students/utils";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/students/students.css";
import { uniqueStudentEmail } from "@/lib/student-email";
import { exportClassOptions, matchingEnrollment, type ExportClassOption } from "@/lib/student-export";

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
  emailAuto?: boolean; // Generated by autoFillEmails, so safe to renumber on conflict
  password?: string; // To be assigned
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

/** Same rule the backend enforces on `email_domain` (e.g. "snt.edu.in"). */
const EMAIL_DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Standard grades from Pre-K to Grade 12, used when a school has not set up its own. */
const availableGrades = [
  'Pre-K', 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

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
  const [studentsFailed, setStudentsFailed] = useState(false);
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
  const [bandFilter, setBandFilter] = useState<Band | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [bulkDeleteStudents, setBulkDeleteStudents] = useState<StudentTableRow[] | null>(null);
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
  // Keys from classKey(grade, section); empty = every grade and section.
  const [exportSelectedClasses, setExportSelectedClasses] = useState<string[]>([]);
  const [exportExpandedGrades, setExportExpandedGrades] = useState<string[]>([]);
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
  // Optional override for the part after @ in auto-generated emails (blank = derive from school name).
  const [bulkEmailDomain, setBulkEmailDomain] = useState('');
  const normalizedBulkEmailDomain = bulkEmailDomain.trim().toLowerCase().replace(/^@/, '');
  const bulkEmailDomainInvalid = normalizedBulkEmailDomain !== '' && !EMAIL_DOMAIN_RE.test(normalizedBulkEmailDomain);
  const bulkImportDone = !!bulkImportResults && bulkImportResults.success > 0;
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sectionInputMode, setSectionInputMode] = useState<'predefined' | 'custom'>('predefined');
  const [customSection, setCustomSection] = useState("");

  const emptyStudentForm = {
    full_name: "",
    email: "",
    password: "",
    school_id: "",
    grade: "",
    section: "",
    parent_name: "",
    parent_phone: "",
  };

  const isAddStudentDirty =
    formData.full_name.trim() !== "" ||
    formData.email.trim() !== "" ||
    formData.password.trim() !== "" ||
    formData.school_id !== "" ||
    formData.grade !== "" ||
    formData.section !== "" ||
    formData.parent_name.trim() !== "" ||
    formData.parent_phone.trim() !== "";

  const isEditStudentDirty = useDirtySnapshot(isEditDialogOpen, {
    full_name: formData.full_name,
    email: formData.email,
    school_id: formData.school_id,
    grade: formData.grade,
    section: formData.section,
    parent_name: formData.parent_name,
    parent_phone: formData.parent_phone,
    newPassword,
  });

  const discardAddStudentDialog = () => {
    setIsDialogOpen(false);
    setAddStudentError(null);
    setFormData(emptyStudentForm);
    setSectionInputMode("predefined");
    setCustomSection("");
  };

  const discardEditStudentDialog = () => {
    setIsEditDialogOpen(false);
    setEditingStudent(null);
    setFormData(emptyStudentForm);
    setSectionInputMode("predefined");
    setCustomSection("");
    setNewPassword("");
    setShowNewPassword(false);
    setUpdateStudentError(null);
  };

  const requestCloseAddStudent = () => {
    void requestClose(isAddStudentDirty, discardAddStudentDialog);
  };

  const requestCloseEditStudent = () => {
    void requestClose(isEditStudentDirty, discardEditStudentDialog);
  };

  // Grades/sections configured for the currently selected school
  const [selectedSchoolGrades, setSelectedSchoolGrades] = useState<SchoolGrade[]>([]);

  // Grades to show in dropdown: school-specific list, or all grades as fallback
  const availableGradesForSchool = useMemo(() => {
    if (selectedSchoolGrades.length > 0) {
      return selectedSchoolGrades.map((g) => g.name);
    }
    return availableGrades;
  }, [selectedSchoolGrades]);

  // Export dialog: grades/sections that really exist in the chosen schools.
  const exportOptions = useMemo(
    () => exportClassOptions(students, exportSelectedSchools),
    [students, exportSelectedSchools],
  );
  const exportClassesLabel = useMemo(() => {
    if (exportSelectedClasses.length === 0) return 'All Grades';
    return exportOptions
      .map((o) => {
        const picked = o.sections.filter((s) => exportSelectedClasses.includes(s.key));
        if (picked.length === 0) return null;
        if (picked.length === o.sections.length) return o.grade;
        return `${o.grade} (${picked.map((s) => s.section || 'No section').join(', ')})`;
      })
      .filter(Boolean)
      .join(', ');
  }, [exportOptions, exportSelectedClasses]);
  const exportMatchCount = useMemo(
    () =>
      isExportDialogOpen
        ? students.filter((s) => matchingEnrollment(s, exportSelectedSchools, exportSelectedClasses)).length
        : 0,
    [isExportDialogOpen, students, exportSelectedSchools, exportSelectedClasses],
  );

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
    setStudentsFailed(false);
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
        // Keep what is on screen from an earlier load; the page says so when there is nothing to show.
        setStudentsFailed(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setStudentsFailed(true);
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
  };

  const requestBulkDeleteStudents = (rows: StudentTableRow[]) => {
    if (rows.length === 0) return;
    setBulkDeleteStudents(rows);
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
      setDeletingStudent(null);
      toast.success(`${student.full_name} was deleted.`);
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

    if (bulkEmailDomainInvalid) {
      setBulkImportError(`"${normalizedBulkEmailDomain}" is not a valid email domain (e.g. school.edu.in). Fix it or leave it blank.`);
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
    const working = bulkData.map((s) => ({ ...s }));
    const chunks: BulkImportData[][] = [];
    for (let i = 0; i < working.length; i += CHUNK_SIZE) {
      chunks.push(working.slice(i, i + CHUNK_SIZE));
    }
    const takenEmails = new Set(
      working.map((s) => s.email?.trim().toLowerCase()).filter((e): e is string => !!e)
    );
    const nextFreeEmail = (email: string) => {
      const [local, domain] = email.trim().toLowerCase().split('@');
      if (!domain) return email;
      const base = local.replace(/\d+$/, '');
      let n = 2;
      while (takenEmails.has(`${base}${n}@${domain}`)) n++;
      const next = `${base}${n}@${domain}`;
      takenEmails.add(next);
      return next;
    };

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
      // Auto-generated emails that collide with an existing account (another
      // student with the same surname) are renumbered and re-checked.
      let dryRunErrors: string[] = [];
      let renumbered = false;
      for (let round = 0; round < 10; round++) {
        dryRunErrors = [];
        let bumped = false;
        for (const chunk of chunks) {
          const res = await adminApi.students.bulkImport({
            school_id: selectedSchoolForImport,
            students: chunk.map(toRow),
            dry_run: true,
            email_domain: normalizedBulkEmailDomain || undefined,
          });
          const rowResults = (res.data as { results: RowResult[] }).results;
          rowResults.forEach((r, i) => {
            if (r.success) return;
            const student = chunk[i];
            if (student.emailAuto && student.email && r.error === 'Email already exists') {
              student.email = nextFreeEmail(student.email);
              bumped = true;
              return;
            }
            dryRunErrors.push(`${student.student_name} (${r.email ?? 'no email'}): ${r.error}`);
          });
        }
        renumbered ||= bumped;
        if (!bumped) break;
      }
      if (renumbered) setBulkData(working);

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
          email_domain: normalizedBulkEmailDomain || undefined,
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

  /** Resets all bulk import state to allow starting a new bulk import cleanly. */
  const resetBulkImportState = () => {
    setBulkData([]);
    setUploadFile(null);
    setBulkImportError(null);
    setBulkImportResults(null);
    setBulkImportCredentials(null);
    setCredentialsGradeFilter('all');
    setCredentialsSectionFilter('all');
    setShowStudentPasswords({});
    setBulkEmailDomain('');
    const fileInput = document.getElementById('bulk-file-upload-tab') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  };

  /** Clears the current completed bulk import and scrolls to top to upload a new file. */
  const handleResetAndNewImport = () => {
    resetBulkImportState();
    toast.info("Ready for the next import.");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Refreshes student data and navigates to the main Students list tab. */
  const handleGoToStudentsList = async () => {
    await loadData();
    resetBulkImportState();
    setActiveTab('students');
    toast.success("Switched to Students list with updated data.");
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
          <p><strong>Grade:</strong> ${escapeHtml(credentialsGradeFilter === 'all' ? 'All grades' : credentialsGradeFilter)}</p>
          <p><strong>Section:</strong> ${escapeHtml(credentialsSectionFilter === 'all' ? 'All sections' : credentialsSectionFilter)}</p>
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
                <td>${escapeHtml(c.name)}</td>
                <td>${escapeHtml(c.email)}</td>
                <td>${escapeHtml(c.password)}</td>
                <td>${escapeHtml(c.school)}</td>
                <td>${escapeHtml(c.grade)}</td>
                <td>${escapeHtml(c.section)}</td>
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
        item.id === id
          ? { ...item, [field]: value, ...(field === 'email' ? { emailAuto: false } : {}) }
          : item
      )
    );
  };

  const handleDeleteBulkDataRow = (id: string) => {
    setBulkData(prevData => prevData.filter((item: BulkImportData) => item.id !== id));
  };

  /**
   * Fills blank or previously auto-generated `email` fields as
   * `{last_name}@{domain}` — the custom domain if one is entered, otherwise
   * `{schoolname}.edu`. Never overwrites an email the admin typed/edited.
   * Students sharing a last name (e.g. two
   * "Smith"s) would otherwise collide on the same email, so a numeric
   * suffix (smith2@, smith3@, ...) is appended whenever the base email is
   * already taken — by an existing row's email or one just generated in
   * this same pass. Passwords are intentionally left untouched here — they
   * stay blank so the backend auto-generates a unique one per student
   * (surfaced afterward via bulkImportCredentials).
   */
  const autoFillEmails = (schoolId: string) => {
    if (bulkEmailDomainInvalid) return;
    const schoolName = schools.find((s: School) => s.id === schoolId)?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'school';
    const domain = `@${normalizedBulkEmailDomain || `${schoolName}.edu`}`;

    setBulkData(prev => {
      const isManual = (item: BulkImportData) => !!item.email && !item.emailAuto;
      const taken = new Set([
        ...students.map((st) => st.email?.trim().toLowerCase()).filter((e): e is string => !!e),
        ...prev.filter(isManual).map((item) => item.email!.trim().toLowerCase()),
      ]);

      return prev.map((item) => {
        if (isManual(item)) return item;
        // Keep an already-assigned auto local part (incl. any number added on a
        // clash) so changing the domain never reshuffles who gets which email.
        const keptLocal = item.emailAuto ? item.email?.split('@')[0] : undefined;
        const kept = keptLocal ? `${keptLocal}${domain}` : '';
        const email = kept && !taken.has(kept)
          ? (taken.add(kept), kept)
          : uniqueStudentEmail(item.student_name, domain.slice(1), taken);
        return { ...item, email, emailAuto: true };
      });
    });
  };

  // Re-derive auto-generated emails when the school or custom domain changes.
  useEffect(() => {
    if (selectedSchoolForImport && bulkData.length > 0) autoFillEmails(selectedSchoolForImport);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on school/domain changes, not on every row edit
  }, [selectedSchoolForImport, normalizedBulkEmailDomain]);

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
      
      const matches = students
        .map((student: StudentWithSchools) => ({
          student,
          enrollment: matchingEnrollment(student, exportSelectedSchools, exportSelectedClasses),
        }))
        .filter((m) => m.enrollment !== null);
      const filteredStudentsForExport = matches.map((m) => m.student);
      const enrollmentFor = new Map(matches.map((m) => [m.student.id, m.enrollment]));

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
        const schoolAssignment = enrollmentFor.get(student.id);
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
      if (exportSelectedClasses.length > 0) {
        filename += `_${exportClassesLabel.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '')}`;
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
              <p><strong>Schools:</strong> ${escapeHtml(exportSelectedSchools.length === 0 ? 'All Schools' : exportSelectedSchools.map((id: string) => schools.find((s: School) => s.id === id)?.name).filter(Boolean).join(', '))}</p>
              <p><strong>Grades:</strong> ${escapeHtml(exportClassesLabel)}</p>
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
                    <td>${escapeHtml(c.name)}</td>
                    <td>${escapeHtml(c.email)}</td>
                    ${showPasswordColumn ? `<td>${escapeHtml(c.password)}</td>` : ''}
                    <td>${escapeHtml(c.school)}</td>
                    <td>${escapeHtml(c.grade)}</td>
                    <td>${escapeHtml(c.section)}</td>
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
      setExportSelectedClasses([]);
      setExportExpandedGrades([]);
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
    if (exportSelectedSchools.length === 0 && exportSelectedClasses.length === 0) {
      setIsExportDialogOpen(true);
    } else {
      generateLoginCredentials();
    }
  };

  // Changing schools drops grade/section picks that the new schools don't have.
  const setExportSchools = (next: string[]) => {
    setExportSelectedSchools(next);
    const available = new Set(
      exportClassOptions(students, next).flatMap((o) => o.sections.map((s) => s.key)),
    );
    setExportSelectedClasses((prev) => prev.filter((k) => available.has(k)));
  };

  const handleSchoolToggle = (schoolId: string) => {
    setExportSchools(
      exportSelectedSchools.includes(schoolId)
        ? exportSelectedSchools.filter((id) => id !== schoolId)
        : [...exportSelectedSchools, schoolId],
    );
  };

  const handleExportGradeToggle = (option: ExportClassOption) => {
    const keys = option.sections.map((s) => s.key);
    setExportSelectedClasses((prev) =>
      keys.every((k) => prev.includes(k))
        ? prev.filter((k) => !keys.includes(k))
        : [...new Set([...prev, ...keys])],
    );
  };

  const handleExportSectionToggle = (key: string) => {
    setExportSelectedClasses((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
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

  const downloadReport = (id: ReportId) => {
    ({ enrollment: downloadEnrollmentReport, progress: downloadProgressReport, grade: downloadGradeWiseReport, school: downloadSchoolWiseReport })[id]();
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

  const findStudent = (id: string) => studentTableRows.find((r) => r.id === id);
  const bands: Record<Band, number> = { new: 0, going: 0, half: 0, done: 0 };
  students.forEach((st) => { bands[bandOf(st.progress)] += 1; });
  const totalStudents = totalStudentsCount || students.length;
  const avgProgress = students.length > 0 ? studentProgressSummary.average_system_progress : null;
  const tabs: { id: string; label: string; n?: number }[] = [
    { id: 'students', label: 'Students', n: totalStudents },
    { id: 'import', label: 'Bulk import' },
    { id: 'reports', label: 'Reports' },
  ];
  const openAdd = () => {
    setEditingStudent(null);
    setFormData(emptyStudentForm);
    setSectionInputMode('predefined');
    setCustomSection("");
    setIsDialogOpen(true);
  };

  let statusLine: React.ReactNode;
  if (isStudentsLoading && students.length === 0) statusLine = 'Loading students…';
  else if (studentsFailed && students.length === 0) statusLine = 'The students did not load. Try again.';
  else if (students.length === 0) statusLine = 'No students yet. Add one, or import a whole class from a spreadsheet.';
  else statusLine = <><strong>{plural(totalStudents, 'student')}</strong> in {plural(activeSchoolsWithStudents, 'school')}{bands.new > 0 ? `. ${bands.new} ${bands.new === 1 ? 'has' : 'have'} not started a course.` : '.'}</>;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ad-title">
        <div className="sd-hero-copy">
          <h1 id="ad-title" className="mc-hero-title">Students</h1>
          <p className="sd-where">Every student on the platform</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={openAdd}><Plus aria-hidden="true" />Add student</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => setActiveTab('import')}><Upload aria-hidden="true" />Import a class</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={handleOpenExportDialog}><Download aria-hidden="true" />Export</button>
          </div>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void loadData()} disabled={isStudentsLoading} aria-label={isStudentsLoading ? 'Refreshing' : 'Refresh'} title="Refresh">
              <RefreshCw className={isStudentsLoading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>
        {isStudentsLoading && students.length === 0 ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: '9rem' }} /></div>
        ) : (
          <ProgressRun counts={bands} selected={bandFilter} onSelect={(b) => { setBandFilter(b); if (b) setActiveTab('students'); }} average={avgProgress} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Student numbers">
        <button type="button" aria-pressed={!bandFilter && activeTab === 'students'} onClick={() => { setBandFilter(null); setActiveTab('students'); }}>
          <span className="sd-l">Students</span><b className="sd-n">{totalStudents}</b><small>{totalStudents > students.length ? `${students.length} loaded here` : 'Every account'}</small>
        </button>
        <Link href="/lms/admin/schools">
          <span className="sd-l">Schools with students</span><b className="sd-n">{students.length === 0 ? 0 : activeSchoolsWithStudents}</b><small>{students.length > 0 && activeSchoolsWithStudents === schools.length ? `All ${schools.length} schools` : `of ${schools.length} schools`}</small>
        </Link>
        <Link href="/lms/admin/student-progress">
          <span className="sd-l">Average progress</span><b className="sd-n">{avgProgress == null ? '–' : `${Math.round(avgProgress)}%`}</b><small>Open course progress</small>
        </Link>
        <button type="button" aria-pressed={bandFilter === 'done'} onClick={() => { setBandFilter(bandFilter === 'done' ? null : 'done'); setActiveTab('students'); }}>
          <span className="sd-l">Finished all courses</span><b className="sd-n">{students.length === 0 ? 0 : studentProgressSummary.students_completed}</b><small>Tap to see who</small>
        </button>
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Students, import and reports" style={{ justifySelf: 'start' }}>
        {tabs.map((tb) => (
          <button key={tb.id} role="tab" className="mc-tab" aria-selected={activeTab === tb.id} onClick={() => setActiveTab(tb.id)}>
            {tb.label}{tb.n != null && <b>{tb.n}</b>}
          </button>
        ))}
      </div>

      {activeTab === 'students' && studentsFailed && students.length === 0 && !isStudentsLoading && (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the students</b>
            <p>Check your connection, then try again. Nothing was changed.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void loadData()}>Try again</button>
          </div>
        </section>
      )}

      {activeTab === 'students' && !(studentsFailed && students.length === 0 && !isStudentsLoading) && (
        <StudentsTab
          students={studentTableRows}
          loading={isStudentsLoading}
          band={bandFilter}
          onClearBand={() => setBandFilter(null)}
          resetKey={bulkSelectionResetKey}
          enrollingId={isEnrollingStudent}
          syncing={isSyncingEnrollments}
          bulkEnrolling={isBulkEnrolling}
          onAdd={openAdd}
          onSync={handleSyncEnrollments}
          onView={(id) => { const r = findStudent(id); if (r) handleViewStudent(r); }}
          onEdit={(id) => { const r = findStudent(id); if (r) handleEditStudent(r); }}
          onEnroll={(id) => { const r = findStudent(id); if (r) void handleEnrollStudent(r); }}
          onDelete={(id) => { const r = findStudent(id); if (r) requestDeleteStudent(r); }}
          onBulkMove={(ids) => requestBulkMoveStudents(studentTableRows.filter((r) => ids.includes(r.id)))}
          onBulkEnroll={(ids) => void handleBulkEnrollStudents(studentTableRows.filter((r) => ids.includes(r.id)))}
          onBulkDelete={(ids) => requestBulkDeleteStudents(studentTableRows.filter((r) => ids.includes(r.id)))}
          extraActions={
            <BulkDeleteStudentsButton
              schools={schools}
              onDeleted={() => {
                setBulkSelectionResetKey((k) => k + 1);
                void loadData();
              }}
            />
          }
        />
      )}

            {activeTab === 'import' && (
              <section className="sd-panel ad-import mc-swap" aria-labelledby="ad-import-title">
                <div className="sd-panel-head"><div><h2 id="ad-import-title">Bulk import students</h2><p>Pick a school, then upload a filled-in template to create many students at once.</p></div></div>
                <div className="ad-import">
                  {!bulkImportDone && (
                  <>
                  {/* Step 1: Select School */}
                  <div className="ad-step">
                    <h3>1. Pick the school</h3>
                    <p>Every student in this import joins the school you pick.</p>
                    {schools.length === 0 ? (
                      <p className="st-hint"><Loader2 className="inline h-4 w-4 animate-spin" aria-hidden="true" /> Loading schools…</p>
                    ) : (
                      <div className="sd-field-wrap">
                        <label htmlFor="bulk-school">School</label>
                        <select
                          id="bulk-school"
                          className="sd-field"
                          value={selectedSchoolForImport}
                          onChange={(e) => {
                            const selectedSchool = schools.find((s: School) => s.id === e.target.value);
                            setSelectedSchoolGrades(selectedSchool?.grades ?? []);
                            setSelectedSchoolForImport(e.target.value);
                          }}
                        >
                          <option value="">Choose a school</option>
                          {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="sd-field-wrap">
                      <label htmlFor="bulk-email-domain">Email domain <small>(optional)</small></label>
                      <input
                        id="bulk-email-domain"
                        className="sd-field"
                        value={bulkEmailDomain}
                        onChange={(e) => setBulkEmailDomain(e.target.value)}
                        placeholder={(schools.find((s: School) => s.id === selectedSchoolForImport)?.name?.toLowerCase().replace(/\s+/g, '') || 'schoolname') + '.edu'}
                        aria-invalid={bulkEmailDomainInvalid}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {bulkEmailDomainInvalid ? (
                        <p className="st-hint" data-t="bad">Enter a domain like school.edu.in, with no spaces and no @ in the middle.</p>
                      ) : (
                        <p className="st-hint">The part after @ in student emails. Leave it blank to use the school name.</p>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Upload */}
                  <div className="ad-step">
                    <h3>2. Upload the file</h3>
                    <p>CSV or Excel (.xlsx, .xls) with the columns Student Name, Father Name, Phone Number, Grade and Section.</p>
                    <div className="ad-drop" data-ready={!!selectedSchoolForImport}>
                      <FileSpreadsheet aria-hidden="true" />
                      <b>Choose your file</b>
                      <span>{selectedSchoolForImport ? 'Upload a CSV or Excel file with your students.' : 'Pick a school first.'}</span>
                      <div className="ad-drop-acts">
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="bulk-file-upload-tab"
                          disabled={!selectedSchoolForImport}
                        />
                        <label htmlFor="bulk-file-upload-tab" className="sd-btn sd-btn--amber" aria-disabled={!selectedSchoolForImport}>
                          <Upload aria-hidden="true" />Choose file
                        </label>
                        <button type="button" className="sd-btn sd-btn--line" onClick={downloadSampleCSV}>
                          <Download aria-hidden="true" />Download template
                        </button>
                      </div>
                      {uploadFile && (
                        <>
                          <span className="ad-ok">Selected: {uploadFile.name}</span>
                          {isParsingFile && <span><Loader2 className="inline h-4 w-4 animate-spin" aria-hidden="true" /> Reading the file…</span>}
                          {!isParsingFile && bulkData.length > 0 && (
                            <span className="ad-ok">Read {bulkData.length} student{bulkData.length !== 1 ? 's' : ''}. Emails are filled in {normalizedBulkEmailDomain && !bulkEmailDomainInvalid ? `with @${normalizedBulkEmailDomain}` : 'from the school name'}.</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {bulkImportError && (
                    <div className="ad-err" role="alert"><b>The import hit a problem</b>{bulkImportError}</div>
                  )}
                  </>
                  )}

                  {bulkData.length > 0 && (
                    <>
                      {/* Step 3: Review & Edit */}
                      {!bulkImportDone && (
                      <div className="ad-step">
                        <div className="ad-review-head">
                          <div>
                            <h3>3. Check the students ({bulkData.length})</h3>
                            <p>
                              Emails are filled in {normalizedBulkEmailDomain && !bulkEmailDomainInvalid ? `with @${normalizedBulkEmailDomain}` : 'from the school name'}. Leave a password blank and the student gets a unique one. Type one only to set your own.
                            </p>
                          </div>
                          <button
                            className="sd-btn sd-btn--amber"
                            onClick={handleBulkImport}
                            disabled={isBulkImporting || !selectedSchoolForImport || bulkEmailDomainInvalid || bulkData.some((item: BulkImportData) => !item.student_name || !item.grade || !item.section || !item.email)}
                          >
                            {isBulkImporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                            {isBulkImporting ? 'Importing…' : `Import ${bulkData.length} student${bulkData.length !== 1 ? 's' : ''}`}
                          </button>
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
                            <p className="ad-warn">
                              {notes.join(', ')}. These will not block the import, but check them below.
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
                                      <p className="text-xs text-amber-600 mt-1">Not in this school&apos;s grade list — will still be saved as entered</p>
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
                      )}

                      {/* Import Results */}
                      {bulkImportResults && (
                        <div className="ad-step">
                          {bulkImportDone ? (
                            <div className="ad-done">
                              <CheckCircle2 aria-hidden="true" className="h-10 w-10" />
                              <h3>Import complete</h3>
                              <p>
                                {bulkImportResults.success} student{bulkImportResults.success !== 1 ? "s" : ""} added to{" "}
                                <strong>{schools.find((s: School) => s.id === selectedSchoolForImport)?.name ?? "the school"}</strong>
                                {uploadFile ? ` from ${uploadFile.name}` : ""}.
                              </p>
                            </div>
                          ) : (
                            <div className="ad-err" role="alert"><b>No students were imported</b>Fix the rows above and try again.</div>
                          )}
                          <div className="ad-tally">
                            <div><b>{bulkImportResults.success}</b><span>Imported</span></div>
                            <div data-bad={bulkImportResults.failed > 0}><b>{bulkImportResults.failed}</b><span>Failed</span></div>
                          </div>
                          {bulkImportResults.errors.length > 0 && (
                            <div className="ad-err" role="alert">
                              <b>{bulkImportDone ? "These rows were not imported. Add them again in a new import:" : "What went wrong:"}</b>
                              <ul className="ad-names">
                                {bulkImportResults.errors.map((error, idx) => <li key={idx}>{error}</li>)}
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
                              <div className="ad-creds">
                                <div>
                                  <b>Download the login details</b>
                                  <p>{bulkImportCredentials.length} student{bulkImportCredentials.length !== 1 ? 's' : ''} got an auto-generated password. Download them before you leave this page, so you can share them with the school.</p>
                                </div>
                                <div className="ad-creds-bar">
                                  <select className="sd-field" aria-label="Grade" value={credentialsGradeFilter} onChange={(e) => { setCredentialsGradeFilter(e.target.value); setCredentialsSectionFilter('all'); }}>
                                    <option value="all">All grades</option>
                                    {gradesPresent.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                                  </select>
                                  <select className="sd-field" aria-label="Section" value={credentialsSectionFilter} onChange={(e) => setCredentialsSectionFilter(e.target.value)}>
                                    <option value="all">All sections</option>
                                    {sectionsPresent.map((section) => <option key={section} value={section}>Section {section}</option>)}
                                  </select>
                                  <span className="st-hint">{filteredCount} student{filteredCount !== 1 ? 's' : ''} match</span>
                                </div>
                                <div className="ad-creds-bar">
                                  <button type="button" className="sd-btn sd-btn--line" disabled={filteredCount === 0} onClick={() => downloadBulkImportCredentials('csv')}><Download aria-hidden="true" />Download CSV</button>
                                  <button type="button" className="sd-btn sd-btn--line" disabled={filteredCount === 0} onClick={() => downloadBulkImportCredentials('pdf')}><Download aria-hidden="true" />Download PDF</button>
                                </div>
                              </div>
                            );
                          })()}

                          {bulkImportDone && (
                            <div className="ad-import-foot">
                              <button type="button" className="sd-btn sd-btn--line" onClick={handleGoToStudentsList}><Users aria-hidden="true" />View students</button>
                              <button type="button" className="sd-btn sd-btn--amber" onClick={handleResetAndNewImport}><RotateCcw aria-hidden="true" />Done, start a new import</button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}


      {activeTab === 'reports' && <ReportsTab onDownload={downloadReport} disabled={students.length === 0} />}

      {/* Add student */}
                    <Dialog
                      open={isDialogOpen}
                      onOpenChange={(open) => {
                        if (open) {
                          setIsDialogOpen(true);
                          return;
                        }
                        requestCloseAddStudent();
                      }}
                    >
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
                          onClick={requestCloseAddStudent}
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

      <ConfirmModal
        open={deletingStudent !== null}
        onClose={() => setDeletingStudent(null)}
        title="Delete this student?"
        subtitle={deletingStudent ? `${deletingStudent.full_name}, ${deletingStudent.email}` : undefined}
        confirmLabel="Delete student"
        danger
        busy={isDeletingStudent}
        onConfirm={() => void confirmDeleteStudent()}
      >
        <p>This cannot be undone. Their account, enrollment and progress are removed, and their email can be used again.</p>
      </ConfirmModal>

      <ConfirmModal
        open={bulkDeleteStudents !== null}
        onClose={() => setBulkDeleteStudents(null)}
        title={`Delete ${plural(bulkDeleteStudents?.length ?? 0, 'student')}?`}
        confirmLabel="Delete students"
        danger
        busy={isBulkDeletingStudents}
        onConfirm={() => void confirmBulkDeleteStudents()}
      >
        <p>This cannot be undone. Their accounts, enrollment and progress are removed, and their emails can be used again.</p>
        <ul className="ad-names">
          {(bulkDeleteStudents ?? []).slice(0, 20).map((st) => <li key={st.id}>{st.full_name} ({st.email})</li>)}
          {(bulkDeleteStudents?.length ?? 0) > 20 && <li style={{ listStyle: 'none' }}>…and {(bulkDeleteStudents?.length ?? 0) - 20} more</li>}
        </ul>
      </ConfirmModal>

      <Modal
        open={!!bulkMoveRows}
        onClose={() => { if (!isBulkMoving) setBulkMoveRows(null); }}
        title="Move students to a class"
        subtitle={`${plural(bulkMoveRows?.length ?? 0, 'student')} selected. Students who are not in the school you pick are skipped.`}
        footer={
          <>
            <button className="sd-btn sd-btn--line" onClick={() => setBulkMoveRows(null)} disabled={isBulkMoving}>Cancel</button>
            <button className="sd-btn sd-btn--amber" disabled={isBulkMoving || !bulkMoveSchoolId || !bulkMoveGrade} onClick={() => void confirmBulkMoveStudents()}>
              {isBulkMoving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MoveRight aria-hidden="true" />}
              Move {plural(bulkMoveRows?.length ?? 0, 'student')}
            </button>
          </>
        }
      >
        <div className="sm-form">
          <div className="sd-field-wrap">
            <label htmlFor="bm-school">School</label>
            <select id="bm-school" className="sd-field" value={bulkMoveSchoolId} onChange={(e) => { setBulkMoveSchoolId(e.target.value); setBulkMoveGrade(''); setBulkMoveSection(''); }}>
              <option value="">Choose a school</option>
              {schools.map((sc: School) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
            </select>
          </div>
          <div className="sm-two">
            <div className="sd-field-wrap">
              <label htmlFor="bm-grade">Grade</label>
              <select id="bm-grade" className="sd-field" value={bulkMoveGrade} disabled={!bulkMoveSchoolId} onChange={(e) => { setBulkMoveGrade(e.target.value); setBulkMoveSection(''); }}>
                <option value="">Choose a grade</option>
                {(() => {
                  const school = schools.find((sc: School) => sc.id === bulkMoveSchoolId);
                  const names = (school?.grades ?? []).map((g) => g.name);
                  return (names.length > 0 ? names : availableGrades).map((g) => <option key={g} value={g}>{g}</option>);
                })()}
              </select>
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="bm-section">Section <small>(optional)</small></label>
              <select id="bm-section" className="sd-field" value={bulkMoveSection} disabled={!bulkMoveGrade} onChange={(e) => setBulkMoveSection(e.target.value)}>
                <option value="">Keep current section</option>
                {(() => {
                  const school = schools.find((sc: School) => sc.id === bulkMoveSchoolId);
                  const gradeObj = (school?.grades ?? []).find((g) => g.name === bulkMoveGrade);
                  const names = (gradeObj?.sections ?? []).map((x) => x.name);
                  return (names.length > 0 ? names : ["A", "B", "C", "D", "E", "F", "G", "H"]).map((x) => <option key={x} value={x}>{x}</option>);
                })()}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* View Student Dialog — components/admin/ViewStudentDialog.tsx */}
      <ViewStudentDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        student={viewingStudent}
      />

            {/* Edit Student Dialog */}
            <Dialog
              open={isEditDialogOpen}
              onOpenChange={(open) => {
                if (open) {
                  setIsEditDialogOpen(true);
                  return;
                }
                requestCloseEditStudent();
              }}
            >
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
                    onClick={requestCloseEditStudent}
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
                            onCheckedChange={() => setExportSchools([])}
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
                      <CardTitle className="text-lg">Select Grades &amp; Sections</CardTitle>
                      <CardDescription>
                        {exportSelectedSchools.length === 0
                          ? "Showing grades across all schools. Select schools above to see only their grades and sections."
                          : "Grades and sections that have students in the selected school(s)."}{" "}
                        Leave unchecked to include all.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <Checkbox
                            id="export-all-grades"
                            checked={exportSelectedClasses.length === 0}
                            onCheckedChange={() => setExportSelectedClasses([])}
                          />
                          <Label htmlFor="export-all-grades" className="font-medium cursor-pointer">
                            All Grades
                          </Label>
                        </div>
                        {exportOptions.map((option) => {
                          const pickedCount = option.sections.filter((s) => exportSelectedClasses.includes(s.key)).length;
                          const allPicked = pickedCount === option.sections.length;
                          const expanded = exportExpandedGrades.includes(option.grade);
                          return (
                            <div key={option.grade}>
                              <div className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                                <Checkbox
                                  id={`export-grade-${option.grade}`}
                                  checked={allPicked}
                                  onCheckedChange={() => handleExportGradeToggle(option)}
                                />
                                <Label htmlFor={`export-grade-${option.grade}`} className="cursor-pointer flex-1">
                                  {option.grade}
                                  <span className="ml-2 text-xs font-normal text-gray-400">
                                    {option.count} student{option.count !== 1 ? "s" : ""}
                                  </span>
                                  {pickedCount > 0 && !allPicked && (
                                    <span className="ml-2 text-xs font-normal text-blue-600">
                                      {pickedCount}/{option.sections.length} sections
                                    </span>
                                  )}
                                </Label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExportExpandedGrades((prev) =>
                                      prev.includes(option.grade)
                                        ? prev.filter((g) => g !== option.grade)
                                        : [...prev, option.grade],
                                    )
                                  }
                                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-1"
                                >
                                  {option.sections.length} section{option.sections.length !== 1 ? "s" : ""}
                                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                              {expanded && (
                                <div className="ml-8 grid grid-cols-2 sm:grid-cols-3 gap-1 pb-1">
                                  {option.sections.map((s) => (
                                    <div key={s.key} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded">
                                      <Checkbox
                                        id={`export-section-${s.key}`}
                                        checked={exportSelectedClasses.includes(s.key)}
                                        onCheckedChange={() => handleExportSectionToggle(s.key)}
                                      />
                                      <Label htmlFor={`export-section-${s.key}`} className="cursor-pointer text-sm">
                                        {s.section ? `Section ${s.section}` : "No section"}
                                        <span className="ml-1 text-xs text-gray-400">({s.count})</span>
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {exportSelectedClasses.length > 0 && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">Selected: {exportClassesLabel}</p>
                        </div>
                      )}
                      {exportOptions.length === 0 && (
                        <p className="text-sm text-gray-500">
                          {exportSelectedSchools.length > 0
                            ? "The selected school(s) have no students yet."
                            : "No grades found."}
                        </p>
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
                          <strong>Grades:</strong> {exportClassesLabel}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Students to export:</strong> {exportMatchCount}
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
                      setExportSelectedClasses([]);
                      setExportExpandedGrades([]);
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

    </div>
  );
}

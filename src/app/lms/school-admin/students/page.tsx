"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  SchoolAdminStudentManagementTable,
  type SchoolAdminStudentTableRow,
} from "@/components/ui/school-admin-student-management-table";
import {
  Plus,
  Search,
  Download,
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Shield,
  Loader2,
  Trash2,
} from "lucide-react";

interface Student {
  id: string;
  profile_id: string;
  student_id?: string;
  school_id: string;
  grade: string;
  section?: string;
  joining_code: string;
  enrolled_at: string;
  is_active: boolean;
  profile: {
    full_name: string;
    email: string;
    created_at: string;
    parent_name?: string;
    parent_phone?: string;
  };
  last_login?: string;
}

/** True when class/enrollment columns are empty in the API payload (persisted DB nulls). */
function enrollmentMissingClassOrCode(student: Pick<Student, "grade" | "section" | "joining_code">): boolean {
  const gradeEmpty = !String(student.grade ?? "").trim();
  const sectionEmpty = !String(student.section ?? "").trim();
  const codeEmpty = !String(student.joining_code ?? "").trim();
  return gradeEmpty && sectionEmpty && codeEmpty;
}

/** Preferred display name when full_name was cleared server-side — falls back from email local part. */
function displayStudentName(student: Student): string {
  const trimmed = student?.profile?.full_name?.trim();
  if (trimmed) return trimmed;
  const email = student?.profile?.email?.trim();
  if (email) {
    const raw = email.split("@")[0] ?? "";
    const tokens = raw
      .replace(/[._+-]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length > 0) {
      return tokens.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
  }
  return `Student #${student.id}`;
}

function mapStudentToTableRow(student: Student): SchoolAdminStudentTableRow {
  const nameDisplay = displayStudentName(student);
  const emailDisplay = student.profile?.email || "No email";
  const gradeDisplay = student.grade || "-";
  const sectionDisplay = student.section || "";
  const parentNameDisplay = student.profile?.parent_name || "";
  const parentPhoneDisplay = student.profile?.parent_phone || "";
  return {
    id: student.id,
    nameDisplay,
    emailDisplay,
    gradeDisplay,
    sectionDisplay,
    parentNameDisplay,
    parentPhoneDisplay,
    parentPhoneHref: parentPhoneDisplay ? `tel:${parentPhoneDisplay}` : null,
    hasJoinCode: !!student.joining_code,
    enrolledDisplay: student.enrolled_at
      ? new Date(student.enrolled_at).toLocaleDateString()
      : "—",
    statusLabel: student.is_active ? "Active" : "Inactive",
    is_active: student.is_active,
    searchBlob: [nameDisplay, emailDisplay, gradeDisplay, sectionDisplay, parentNameDisplay, parentPhoneDisplay]
      .join(" ")
      .toLowerCase(),
  };
}

/** Radix Select forbids `SelectItem value=""`. Drops blanks / whitespace-only and dedupes. */
function selectChoicesFrom(values: (string | null | undefined)[], sortAlphabetically: boolean): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return sortAlphabetically ? [...out].sort() : out;
}

export default function StudentsManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [schoolId, setSchoolId] = useState<string>("");
  const [schoolGrades, setSchoolGrades] = useState<string[]>([]);
  const [schoolSections, setSchoolSections] = useState<string[]>([]);

  const predefinedSections = useMemo(
    () => selectChoicesFrom(schoolSections, false),
    [schoolSections],
  );
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([]);
  const [importResults, setImportResults] = useState<null | {
    summary: { total: number; success: number; failed: number; generated_passwords: number; dry_run: boolean };
    results: Array<{ index: number; email: string | null; success: boolean; error?: string; generated_password?: string }>;
  }>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isDeleteStudentDialogOpen, setIsDeleteStudentDialogOpen] = useState(false);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<{ student: Student; next: boolean } | null>(null);
  const [isToggleStudentDialogOpen, setIsToggleStudentDialogOpen] = useState(false);
  const [isTogglingStudent, setIsTogglingStudent] = useState(false);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<SchoolAdminStudentTableRow[] | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkSelectionResetKey, setBulkSelectionResetKey] = useState(0);

  const studentTableRows = useMemo(() => students.map(mapStudentToTableRow), [students]);

  // Form states
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    grade: "",
    section: "",
    joining_code: "",
    password: "",
    parent_name: "",
    parent_phone: ""
  });

  const getEmptyStudentForm = () => ({
    full_name: "",
    email: "",
    grade: "",
    section: "",
    joining_code: "",
    password: "",
    parent_name: "",
    parent_phone: "",
  });

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch school info via schoolAdminApi (school_admins table)
      try {
        const schoolRes = await schoolAdminApi.school.get();
        const schoolData = schoolRes.data ?? {};
        const school = (schoolData as { school?: { id?: string; number_of_sections?: number; grades_offered?: string[]; sections_offered?: string[] } }).school;
        if (school) {
          setSchoolId(school.id ?? '');
          if (school.sections_offered && school.sections_offered.length > 0) {
            setSchoolSections(school.sections_offered);
          }
          setSchoolGrades(
            Array.isArray(school.grades_offered) ? selectChoicesFrom(school.grades_offered, true) : [],
          );
        } else {
          console.warn('School not found in API response');
          setSchoolGrades([]);
          setSchoolSections([]);
        }
      } catch (err) {
        console.log('Error fetching school info:', err);
        setSchoolGrades([]);
        setSchoolSections([]);
      }

      // Load students for this school using centralized schoolAdminApi (server-side filter + paging)
      const response = await schoolAdminApi.students.list({
        limit: pageSize,
        page,
        q: searchTerm || undefined,
        grade: gradeFilter !== 'all' ? gradeFilter : undefined,
        section: sectionFilter !== 'all' ? sectionFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      const raw = response.data ?? {};
      const root = raw as Record<string, unknown> | undefined;
      const data =
        root?.data != null &&
        typeof root.data === 'object' &&
        !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : (root ?? {});

      // Transform API response to match expected format
      type ApiStudentRow = {
        id?: string;
        profile?: {
          id?: string;
          full_name?: string;
          email?: string;
          created_at?: string;
          parent_name?: string;
          parent_phone?: string;
        };
        student_id?: string;
        school_id?: string;
        grade?: string;
        section?: string;
        joining_code?: string;
        is_active?: boolean;
        enrolled_at?: string;
        parent_name?: string;
        parent_phone?: string;
      };

      const apiStudents =
        (data as { students?: unknown[] }).students ??
        (Array.isArray(data) ? data : []);

      const transformedStudents = (apiStudents as ApiStudentRow[]).map((student) => ({
        id: String(student.id ?? student.student_id ?? ""),
        profile_id: student.profile?.id || student.student_id,
        student_id: student.student_id,
        school_id: student.school_id,
        grade: student.grade ?? "",
        section: student.section ?? "",
        joining_code: student.joining_code ?? "",
        is_active: student.is_active ?? true,
        enrolled_at: student.enrolled_at ?? "",
        profile: {
          full_name: student.profile?.full_name ?? "",
          email: student.profile?.email ?? "",
          created_at: student.profile?.created_at ?? "",
          parent_name: student.profile?.parent_name || student.parent_name || "",
          parent_phone: student.profile?.parent_phone || student.parent_phone || "",
        },
      }));

      setStudents(transformedStudents as unknown as Student[]);
      const maybeTotal = (data as { total?: number }).total;
      setTotal(typeof maybeTotal === 'number' ? maybeTotal : transformedStudents.length);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  }, [gradeFilter, page, pageSize, searchTerm, sectionFilter, statusFilter]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, gradeFilter, sectionFilter, statusFilter, pageSize]);

  const handleAddStudent = async () => {
    try {
      setIsAddingStudent(true);
      
      if (!schoolId) {
        toast.error('School ID not available. Please refresh the page.');
        console.error('School ID not available');
        setIsAddingStudent(false);
        return;
      }

      // Validate required fields (manual add flow: all visible fields are mandatory)
      if (
        !formData.full_name ||
        !formData.email ||
        !formData.grade ||
        !formData.password ||
        !formData.section ||
        !formData.parent_name ||
        !formData.parent_phone
      ) {
        toast.warning('Please fill in all required fields: Full Name, Email, Grade, Section, Password, Parent Name, and Parent Number.');
        setIsAddingStudent(false);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.warning('Please enter a valid email address.');
        setIsAddingStudent(false);
        return;
      }

      // Validate password strength (8+ chars, uppercase, lowercase, number)
      const { validatePasswordClient } = await import('@/lib/password-validation');
      const passwordError = validatePasswordClient(formData.password);
      if (passwordError) {
        toast.warning(passwordError);
        setIsAddingStudent(false);
        return;
      }

      console.log('➕ Creating student...', {
        full_name: formData.full_name,
        email: formData.email,
        grade: formData.grade,
        school_id: schoolId || undefined });

      const response = await schoolAdminApi.students.create({
        full_name: formData.full_name,
        email: formData.email,
        grade: formData.grade,
        section: formData.section || undefined,
        password: formData.password,
        parent_name: formData.parent_name || undefined,
        parent_phone: formData.parent_phone || undefined
      });

      const result = response.data as { success?: boolean; student?: unknown; error?: string; details?: string };

      if (result.success) {
        console.log('✅ Student created successfully:', result.student);
        const studentName = formData.full_name;
        const studentEmail = formData.email;
        setFormData(getEmptyStudentForm());
        setIsAddDialogOpen(false);
        await loadStudents();
        toast.success(
          `Student "${studentName}" added. They can log in with ${studentEmail} and the password you set.`,
        );
      } else {
        console.error('Failed to create student:', result.error);
        toast.error(`Failed to create student: ${result.error || 'Please try again.'}`);
      }
     
    } catch (error: unknown) {
      console.error('Error adding student:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } }; message?: string };
      const msg = err?.response?.data?.error || err?.response?.data?.details || (error instanceof Error ? error.message : 'Please try again.');
      toast.error(`Error adding student: ${msg}`);
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleViewStudent = (student: Student) => {
    setViewingStudent(student);
    setIsViewDialogOpen(true);
  };

  const handleEditStudentClick = (student: Student) => {
    setSelectedStudent(student);
    const sectionValue = student.section || "";
    setFormData({
      full_name: student?.profile?.full_name || "",
      email: student?.profile?.email || "",
      grade: student.grade || "",
      section: predefinedSections.includes(sectionValue) ? sectionValue : "",
      joining_code: student.joining_code || "",
      password: "",
      parent_name: student?.profile?.parent_name || "",
      parent_phone: student?.profile?.parent_phone || ""
    });
    setNewPassword(""); // Reset new password
    setShowNewPassword(false); // Reset new password visibility
    setIsEditDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!selectedStudent) return;

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

    try {
      console.log('🔐 Changing password for student:', selectedStudent?.profile?.email);

      await schoolAdminApi.students.changePassword(selectedStudent.id, { password: newPassword });

      toast.success(
        `Password updated for ${selectedStudent ? displayStudentName(selectedStudent) : 'student'}.`,
      );
      
      // Reset password field
      setNewPassword("");
      
      // Refresh the student list to get updated data
      await loadStudents();
     
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      const msg = error instanceof Error ? error.message : 'Please try again.';
      toast.error(`Failed to change password: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const generateNewPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
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

  const handleEditStudent = async () => {
    if (!selectedStudent) return;

    try {
      console.log('✏️ Updating student:', selectedStudent.id);

      await schoolAdminApi.students.update(selectedStudent.id, {
        full_name: formData.full_name,
        email: formData.email,
        grade: formData.grade,
        section: formData.section || null,
        joining_code: formData.joining_code || null,
        parent_name: formData.parent_name || null,
        parent_phone: formData.parent_phone || null,
      });

      console.log('✅ Student updated successfully');
      setIsEditDialogOpen(false);
      setSelectedStudent(null);
      await loadStudents();
      toast.success(`Student "${formData.full_name}" updated successfully.`);
     
    } catch (error: unknown) {
      console.error('Error updating student:', error);
      const msg = error instanceof Error ? error.message : 'Please try again.';
      toast.error(`Error updating student: ${msg}`);
    }
  };

  const requestDeleteStudent = (student: Student) => {
    setDeletingStudent(student);
    setIsDeleteStudentDialogOpen(true);
  };

  const confirmDeleteStudent = async () => {
    if (!deletingStudent || isDeletingStudent) return;
    const student = deletingStudent;
    setIsDeletingStudent(true);
    try {
      console.log('🗑️ Deleting student:', student.id);
      await schoolAdminApi.students.delete(student.id, { hard: true });
      await loadStudents();
      setIsDeleteStudentDialogOpen(false);
      setDeletingStudent(null);
      toast.success(`Student "${displayStudentName(student)}" deleted successfully.`);
    } catch (error: unknown) {
      console.error('Error deleting student:', error);
      const msg = error instanceof Error ? error.message : 'Please try again.';
      toast.error(`Error deleting student: ${msg}`);
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const requestToggleStudentActive = (student: Student) => {
    const next = !student.is_active;
    setToggleTarget({ student, next });
    setIsToggleStudentDialogOpen(true);
  };

  const confirmToggleStudentActive = async () => {
    if (!toggleTarget || isTogglingStudent) return;
    const { student, next } = toggleTarget;
    setIsTogglingStudent(true);
    try {
      setActionLoading('toggle-active');
      await schoolAdminApi.students.update(student.id, { is_active: next });
      await loadStudents();
      const needsRepairHint =
        enrollmentMissingClassOrCode(student) ||
        !(student.profile?.full_name ?? "").trim();
      const repairNote = needsRepairHint
        ? ' Class or name fields may still be blank—use Edit on this student to restore them.'
        : '';
      toast.success(
        `Student "${displayStudentName(student)}" is now ${next ? 'Active' : 'Inactive'}.${repairNote}`,
      );
      setIsToggleStudentDialogOpen(false);
      setToggleTarget(null);
    } catch (error: unknown) {
      console.error('Error toggling student status:', error);
      const msg = error instanceof Error ? error.message : 'Please try again.';
      toast.error(`Failed to update student status: ${msg}`);
    } finally {
      setActionLoading(null);
      setIsTogglingStudent(false);
    }
  };

  const _handleResetPassword = async (student: Student) => {
    try {
      console.log('🔐 Resetting password for student:', student.id);
      const tempPassword = `TempPass${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      await schoolAdminApi.students.changePassword(student.id, { password: tempPassword });
      toast.success(`Password reset for ${displayStudentName(student)}.`);
    } catch (error: unknown) {
      console.error('Error resetting password:', error);
      const msg = error instanceof Error ? error.message : 'Please try again.';
      toast.error(`Error resetting password: ${msg}`);
    }
  };

  const filteredStudents = students;

  const findStudentById = (id: string) => students.find((s) => s.id === id);

  const requestBulkDeleteStudents = (rows: SchoolAdminStudentTableRow[]) => {
    if (rows.length === 0) return;
    setBulkDeleteTargets(rows);
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDeleteStudents = async () => {
    if (!bulkDeleteTargets?.length || isBulkDeleting) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        bulkDeleteTargets.map((row) => schoolAdminApi.students.delete(row.id, { hard: true })),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (succeeded > 0) {
        toast.success(`Deleted ${succeeded} student${succeeded !== 1 ? "s" : ""}.`);
        setBulkSelectionResetKey((k) => k + 1);
        await loadStudents();
      }
      if (failed > 0) {
        toast.error(`Could not delete ${failed} student${failed !== 1 ? "s" : ""}.`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Bulk delete failed unexpectedly.");
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteDialogOpen(false);
      setBulkDeleteTargets(null);
    }
  };

  const getAllSections = () => selectChoicesFrom(schoolSections, true);

  const getGradeOptions = () => selectChoicesFrom(schoolGrades, true);

  const handleExportStudents = () => {
    if (filteredStudents.length === 0) {
      toast.warning('No students to export.');
      return;
    }

    // Prepare CSV data
    const headers = ['Name', 'Email', 'Grade', 'Section', 'Joining Code', 'Status', 'Enrolled Date'];
    const rows = filteredStudents.map((student: Student) => [
      student?.profile?.full_name?.trim() || displayStudentName(student),
      student?.profile?.email || '',
      student.grade || '',
      student.section || '',
      student.joining_code || '',
      student.is_active ? 'Active' : 'Inactive',
      student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : '',
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
    link.setAttribute('download', `students_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ Exported ${filteredStudents.length} student(s) to CSV`);
  };

  const downloadImportTemplate = () => {
    const headers = ['email', 'full_name', 'grade', 'section', 'joining_code', 'parent_name', 'parent_phone', 'password', 'is_active'];
    const example = [
      ['student1@example.com', 'Student One', 'Grade 5', 'A', 'ABC123', 'Parent One', '9999999999', '', 'true'],
      ['student2@example.com', 'Student Two', 'Grade 6', 'B', '', 'Parent Two', '', 'StrongPass1!', 'true'],
    ];
    const csv = [headers.join(','), ...example.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'students_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const splitLine = (line: string) => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          const next = line[i + 1];
          if (inQuotes && next === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          out.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const headers = splitLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
    const rows = lines.slice(1).map((l) => splitLine(l));
    return rows.map((cols) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        const raw = cols[idx] ?? '';
        obj[h] = raw.replace(/^"|"$/g, '').trim();
      });
      return obj;
    });
  };

  const handleSelectImportFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    setImportResults(null);
    setImportPreview(rows);
    if (rows.length === 0) toast.warning('No rows found in CSV.');
  };

  const handleRunImport = async (dryRun: boolean) => {
    if (importPreview.length === 0) {
      toast.warning('Please select a CSV file first.');
      return;
    }
    setActionLoading(dryRun ? 'import-dry' : 'import');
    try {
      const studentsPayload = importPreview.map((r) => ({
        email: r.email,
        full_name: r.full_name,
        grade: r.grade,
        section: r.section,
        joining_code: r.joining_code,
        parent_name: r.parent_name,
        parent_phone: r.parent_phone,
        password: r.password,
        is_active: r.is_active ? String(r.is_active).toLowerCase() !== 'false' : undefined,
      }));

      const resp = await schoolAdminApi.students.bulkImport({ students: studentsPayload, dry_run: dryRun });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = resp.data as { success: boolean; summary: any; results: any[] };
      if (!data?.success) throw new Error('Bulk import failed');
      setImportResults({ summary: data.summary, results: data.results });
      if (!dryRun) await loadStudents();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      toast.error(`Import failed: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
        <p className="text-gray-600 mt-2">Manage student enrollment and information</p>
      </div>

      {/* Filters and Actions */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {getGradeOptions().map((grade: string) => (
                <SelectItem key={grade} value={grade}>{grade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {getAllSections().map((section: string) => (
                <SelectItem key={section} value={section}>Section {section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {filteredStudents.length} of {total} student(s)
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportStudents}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Bulk import students (CSV)</DialogTitle>
                  <DialogDescription>
                    Download the template, fill it, and upload to create students in bulk.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={downloadImportTemplate}>
                      <Download className="mr-2 h-4 w-4" />
                      Download template
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleSelectImportFile(f);
                      }}
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose CSV
                    </Button>
                    {importPreview.length > 0 && (
                      <div className="text-sm text-gray-600 flex items-center">
                        Loaded {importPreview.length} row(s)
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-600">
                    Required column: <code>email</code>. If <code>password</code> is empty, the system generates one and returns it in the result.
                  </div>

                  {importResults && (
                    <div className="border rounded p-3 space-y-2">
                      <div className="text-sm font-medium">Result</div>
                      <div className="text-sm text-gray-700">
                        Total: {importResults.summary.total} | Success: {importResults.summary.success} | Failed: {importResults.summary.failed} | Generated passwords: {importResults.summary.generated_passwords}{importResults.summary.dry_run ? ' (dry run)' : ''}
                      </div>
                      {importResults.results.filter((r) => !r.success).slice(0, 10).length > 0 && (
                        <div className="text-sm text-red-700">
                          {importResults.results.filter((r) => !r.success).slice(0, 10).map((r) => (
                            <div key={`${r.index}-${r.email}`}>Row {r.index + 1}: {r.email || '(no email)'} — {r.error}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    disabled={actionLoading !== null || importPreview.length === 0}
                    onClick={() => void handleRunImport(true)}
                  >
                    Dry run
                  </Button>
                  <Button
                    disabled={actionLoading !== null || importPreview.length === 0}
                    onClick={() => void handleRunImport(false)}
                  >
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={isAddDialogOpen}
              onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (open) {
                  setFormData(getEmptyStudentForm());
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Student</DialogTitle>
                  <DialogDescription>
                    Add a new student to your school. You’ll share their login credentials securely after creation.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="full_name" className="text-right">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="grade" className="text-right">
                      Grade <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.grade || undefined}
                      onValueChange={(value) => setFormData({...formData, grade: value})}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectChoicesFrom(schoolGrades, true).map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="section" className="text-right">
                      Section <span className="text-red-500">*</span>
                    </Label>
                    <div className="col-span-3 space-y-2">
                      <Select
                        value={formData.section || undefined}
                        onValueChange={(value) => setFormData({...formData, section: value})}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          {predefinedSections.map((section) => (
                            <SelectItem key={section} value={section}>
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="parent_name" className="text-right">
                      Parent Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="parent_name"
                      value={formData.parent_name}
                      onChange={(e) => setFormData({...formData, parent_name: e.target.value})}
                      className="col-span-3"
                      placeholder="Enter parent/guardian name"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="parent_phone" className="text-right">
                      Parent Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="parent_phone"
                      type="tel"
                      value={formData.parent_phone}
                      onChange={(e) => setFormData({...formData, parent_phone: e.target.value})}
                      className="col-span-3"
                      placeholder="Enter parent/guardian phone"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAddDialogOpen(false)}
                    disabled={isAddingStudent}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddStudent}
                    disabled={
                      isAddingStudent ||
                      !formData.full_name ||
                      !formData.email ||
                      !formData.grade ||
                      !formData.password ||
                      !formData.section ||
                      !formData.parent_name ||
                      !formData.parent_phone
                    }
                  >
                    {isAddingStudent ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Student
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Students List</CardTitle>
          <CardDescription>
            Manage student information and enrollment status — use column filters or select rows for bulk actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolAdminStudentManagementTable
            rows={studentTableRows}
            loading={loading}
            onView={(row) => {
              const student = findStudentById(row.id);
              if (student) handleViewStudent(student);
            }}
            onEdit={(row) => {
              const student = findStudentById(row.id);
              if (student) handleEditStudentClick(student);
            }}
            onToggleActive={(row) => {
              const student = findStudentById(row.id);
              if (student) requestToggleStudentActive(student);
            }}
            onDelete={(row) => {
              const student = findStudentById(row.id);
              if (student) requestDeleteStudent(student);
            }}
            onBulkDeleteSelected={requestBulkDeleteStudents}
            resetSelectionKey={bulkSelectionResetKey}
            serverPagination={{
              page,
              pageSize,
              total,
              onPageChange: setPage,
              onPageSizeChange: setPageSize,
              pageSizeOptions: [25, 50, 100],
            }}
            emptyMessage="No students found. Try adjusting your search or filters."
            className="shadow-sm"
          />
        </CardContent>
      </Card>

      {/* View Student Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              View detailed information about the student
            </DialogDescription>
          </DialogHeader>
          {viewingStudent && (
            <div className="space-y-6 py-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                  <p className="text-base font-medium">
                    {viewingStudent ? displayStudentName(viewingStudent) : ""}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Email</Label>
                  <p className="text-base">{viewingStudent?.profile?.email || "No email"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Student ID</Label>
                  <p className="text-base font-mono text-sm">{viewingStudent.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Grade</Label>
                  <Badge variant="outline">Grade {viewingStudent.grade}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Section</Label>
                  {viewingStudent.section ? (
                    <Badge variant="outline">Section {viewingStudent.section}</Badge>
                  ) : (
                    <p className="text-base text-gray-400 italic">Not assigned</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Enrollment Source</Label>
                  {viewingStudent.joining_code ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <circle cx="6" cy="6" r="6" fill="#16a34a" opacity="0.15"/>
                          <path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Self-registered via join code
                      </span>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{viewingStudent.joining_code}</code>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-0.5">Added by admin</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <Badge variant={viewingStudent.is_active ? "default" : "secondary"}>
                    {viewingStudent.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Enrolled Date</Label>
                  <p className="text-base">{new Date(viewingStudent.enrolled_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created At</Label>
                  <p className="text-base">
                    {viewingStudent?.profile?.created_at
                      ? new Date(viewingStudent.profile.created_at).toLocaleDateString()
                      : "Unknown"}
                  </p>
                </div>
              </div>

              {/* Parent Information */}
              {(viewingStudent?.profile?.parent_name || viewingStudent?.profile?.parent_phone) && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">Parent/Guardian Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {viewingStudent?.profile?.parent_name && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Parent Name</Label>
                        <p className="text-base">{viewingStudent.profile.parent_name}</p>
                      </div>
                    )}
                    {viewingStudent?.profile?.parent_phone && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Parent Phone</Label>
                        <p className="text-base">
                          <a 
                            href={`tel:${viewingStudent.profile.parent_phone}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {viewingStudent.profile.parent_phone}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setSelectedStudent(null);
          setNewPassword(""); // Reset new password
          setShowNewPassword(false); // Reset new password visibility
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information and enrollment details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_full_name" className="text-right">
                Full Name
              </Label>
              <Input
                id="edit_full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_email" className="text-right">
                Email
              </Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                Change Password
              </Label>
              <div className="col-span-3 space-y-2">
                <p className="text-xs text-gray-500">
                  Use this to reset the password if the student has forgotten it. A new password will be generated and assigned.
                </p>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_grade" className="text-right">
                Grade
              </Label>
              <Select
                value={formData.grade || undefined}
                onValueChange={(value) => setFormData({...formData, grade: value})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {selectChoicesFrom(schoolGrades, true).map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_section" className="text-right">
                Section <span className="text-red-500">*</span>
              </Label>
              <div className="col-span-3 space-y-2">
                <Select
                  value={formData.section || undefined}
                  onValueChange={(value) => setFormData({...formData, section: value})}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {predefinedSections.map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_joining_code" className="text-right">
                Joining Code
              </Label>
              <Input
                id="edit_joining_code"
                value={formData.joining_code}
                onChange={(e) => setFormData({...formData, joining_code: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_parent_name" className="text-right">
                Parent Name
              </Label>
              <Input
                id="edit_parent_name"
                value={formData.parent_name}
                onChange={(e) => setFormData({...formData, parent_name: e.target.value})}
                className="col-span-3"
                placeholder="Enter parent/guardian name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_parent_phone" className="text-right">
                Parent Number
              </Label>
              <Input
                id="edit_parent_phone"
                type="tel"
                value={formData.parent_phone}
                onChange={(e) => setFormData({...formData, parent_phone: e.target.value})}
                className="col-span-3"
                placeholder="Enter parent/guardian phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditStudent}
              disabled={!formData.full_name || !formData.email || !formData.section}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              This cannot be undone. Enrollments and related data for this student may be removed depending on server policy.
            </DialogDescription>
          </DialogHeader>
          {deletingStudent && (
            <p className="text-sm text-gray-700 py-2">
              Delete <span className="font-semibold">{displayStudentName(deletingStudent)}</span>?
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

      <Dialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsBulkDeleteDialogOpen(open);
          if (!open) setBulkDeleteTargets(null);
        }}
      >
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Delete selected students</DialogTitle>
            <DialogDescription>
              This cannot be undone. Selected student accounts will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          {bulkDeleteTargets && bulkDeleteTargets.length > 0 && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-gray-700">
                Delete <span className="font-semibold">{bulkDeleteTargets.length}</span>{" "}
                student{bulkDeleteTargets.length !== 1 ? "s" : ""}?
              </p>
              <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-muted-foreground">
                {bulkDeleteTargets.slice(0, 20).map((t) => (
                  <li key={t.id}>{t.nameDisplay}</li>
                ))}
                {bulkDeleteTargets.length > 20 && (
                  <li className="list-none pl-0 text-muted-foreground/80">
                    …and {bulkDeleteTargets.length - 20} more
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
                setBulkDeleteTargets(null);
              }}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isBulkDeleting || !bulkDeleteTargets?.length}
              onClick={() => void confirmBulkDeleteStudents()}
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete students
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isToggleStudentDialogOpen}
        onOpenChange={(open) => {
          setIsToggleStudentDialogOpen(open);
          if (!open) setToggleTarget(null);
        }}
      >
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.next ? 'Activate student' : 'Deactivate student'}
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.next
                ? 'This student will be able to log in again (subject to other account rules).'
                : 'This student will not be able to log in until reactivated.'}
            </DialogDescription>
          </DialogHeader>
          {toggleTarget && (
            <p className="text-sm text-gray-700 py-2">
              {toggleTarget.next ? 'Activate' : 'Deactivate'}{' '}
              <span className="font-semibold">{displayStudentName(toggleTarget.student)}</span>?
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsToggleStudentDialogOpen(false);
                setToggleTarget(null);
              }}
              disabled={isTogglingStudent}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={toggleTarget?.next ? 'default' : 'secondary'}
              disabled={isTogglingStudent || !toggleTarget}
              onClick={() => void confirmToggleStudentActive()}
            >
              {isTogglingStudent ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating…
                </>
              ) : toggleTarget?.next ? (
                'Activate'
              ) : (
                'Deactivate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


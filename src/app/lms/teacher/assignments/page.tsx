"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { teacherApi } from "@/lib/api/teacher.api";
import { confirmDialog, choiceDialog } from "@/components/ui/confirm-dialog";
import { useTeacherSchools } from "@/hooks/useTeacherData";
import { useTeacherSchool } from "../context";
import { type Assignment as BuilderAssignment } from "@/components/admin/AssignmentBuilder";
import AssignmentAnalyticsPanel, { type AssignmentAnalyticsData } from "@/components/teacher/AssignmentAnalyticsPanel";
import TeacherRetakeRequestsPanel from "@/components/teacher/TeacherRetakeRequestsPanel";
import {
  audienceFromAssignment,
  resolveAudiencePayload,
  schoolsMissingAudience,
  targetsForSchool,
  type GradeAudienceTarget,
  type TeacherClass,
} from "@/components/teacher/AssignmentAudiencePicker";
import AssignmentsPageHeader from "@/components/teacher/assignments/AssignmentsPageHeader";
import AssignmentListPane from "@/components/teacher/assignments/AssignmentListPane";
import AssignmentDetailPane from "@/components/teacher/assignments/AssignmentDetailPane";
import AssignmentFormDrawer, {
  type CreatePayload,
} from "@/components/teacher/assignments/AssignmentFormDrawer";
import {
  type TeacherAssignment,
  type Submission,
  type StudentRow,
  type AssignmentDetail,
  type AssignmentsTab,
  type DetailTab,
} from "@/components/teacher/assignments/assignments-shared";
import { AlertCircle, X } from "lucide-react";
import { toast } from "@/components/ui/toast";

type RetakeGrantInfo = {
  student_id: number;
  is_active: boolean;
  granted_at: string | null;
  grant_count: number;
};

function titlesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function findMatchingDaily(
  list: TeacherAssignment[],
  title: string,
  excludeId?: string | null,
): TeacherAssignment | undefined {
  return list.find(
    (a) =>
      a.id !== excludeId &&
      (a.assignment_type ?? "DAILY").toUpperCase() === "DAILY" &&
      titlesMatch(a.title, title),
  );
}

type AnalyticsData = AssignmentAnalyticsData;

const emptyCreatePayload: CreatePayload = {
  dueDate: "",
  schoolIds: [],
  subject: "",
  isPublished: false,
  academicYear: "2024-25",
  entireSchool: true,
  gradeTargets: [] as GradeAudienceTarget[],
};

function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function TeacherAssignmentsPage() {
  const { data: schools = [] } = useTeacherSchools();
  // Follow the active school chosen in the dashboard topbar so assignments,
  // analytics, and new-assignment defaults all stay scoped to one school.
  const { selectedSchool } = useTeacherSchool();
  const activeSchoolId = selectedSchool?.id;
  const [tab, setTab] = useState<AssignmentsTab>("daily");
  const [dailyAssignments, setDailyAssignments] = useState<TeacherAssignment[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<TeacherAssignment[]>([]);
  const [pendingRetakeRequestCount, setPendingRetakeRequestCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detailTab, setDetailTab] = useState<DetailTab>("submissions");
  const [assignmentDetail, setAssignmentDetail] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [retakeGrants, setRetakeGrants] = useState<RetakeGrantInfo[]>([]);
  const [grading, setGrading] = useState<Record<string, { score: string; feedback: string }>>({});
  const [grantingStudentId, setGrantingStudentId] = useState<number | null>(null);
  const [grantSearch, setGrantSearch] = useState("");
  const [grantFilter, setGrantFilter] = useState<"all" | "graded" | "pending">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [builderAssignment, setBuilderAssignment] = useState<BuilderAssignment | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [subFilter, setSubFilter] = useState<"all" | "graded" | "pending">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [createPayload, setCreatePayload] = useState(emptyCreatePayload);
  const [schoolsWithExistingCopy, setSchoolsWithExistingCopy] = useState<string[]>([]);

  const assignments = tab === "daily" ? dailyAssignments : courseAssignments;
  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selectedId),
    [assignments, selectedId]
  );

  const editSubmissionCount = useMemo(() => {
    if (editingAssignmentId) {
      const fromList = assignments.find((a) => a.id === editingAssignmentId)?.submission_count;
      if (typeof fromList === "number") return fromList;
    }
    if (assignmentDetail?.id === (editingAssignmentId || selectedId)) {
      return assignmentDetail.submission_count ?? 0;
    }
    return selectedAssignment?.submission_count ?? 0;
  }, [assignments, assignmentDetail, editingAssignmentId, selectedId, selectedAssignment]);

  /** Questions are frozen once published or any student has submitted. */
  const questionsLocked =
    modalMode === "edit" &&
    (createPayload.isPublished || editSubmissionCount > 0);

  const questionsLockMessage = editSubmissionCount > 0
    ? "Questions are locked because students have already submitted. Subject, due date, and audience can still be updated. Create a new assignment if the questions must change — existing scores stay as recorded."
    : "Questions are locked while published. Unpublish (with no submissions) to edit questions. Subject, due date, and audience can still be updated.";

  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments;
    const q = searchQuery.toLowerCase();
    return assignments.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subject ?? "").toLowerCase().includes(q) ||
        (a.grade_name ?? "").toLowerCase().includes(q)
    );
  }, [assignments, searchQuery]);

  const gradedSubmissions = useMemo(() => submissions.filter((s) => s.status === "graded"), [submissions]);
  const pendingSubmissions = useMemo(() => submissions.filter((s) => s.status !== "graded"), [submissions]);

  // Group all submission rows by student, pick best and latest attempt.
  // "Best" honors the assignment's own retakeScoringRule ('highest' vs
  // 'latest') — same tie-break as the canonical StudentRankingService and
  // this page's own Analytics tab (getTeacherAssignmentAnalytics). This
  // table used to always pick the highest-scoring graded attempt regardless
  // of the rule, so a 'latest'-rule assignment where a retake scored lower
  // than an earlier attempt showed the wrong (higher, stale) score here
  // while the Analytics tab correctly showed the real latest score for the
  // identical student+assignment.
  const retakeRule = (selectedAssignment?.retake_rule ?? "latest").toLowerCase();
  const grantByStudentId = useMemo(() => {
    const map = new Map<number, RetakeGrantInfo>();
    for (const g of retakeGrants) map.set(g.student_id, g);
    return map;
  }, [retakeGrants]);
  const studentRows = useMemo((): StudentRow[] => {
    const map = new Map<number, StudentRow>();
    for (const s of submissions) {
      const grant = grantByStudentId.get(s.student_id);
      const row = map.get(s.student_id) ?? {
        student_id: s.student_id,
        student_name: s.student_name,
        grade: s.grade ?? null,
        section: s.section ?? null,
        school_name: s.school_name ?? null,
        attempts: [],
        best: null,
        latest: s,
        retake_granted: !!grant?.is_active,
        retake_grant_count: grant?.grant_count ?? 0,
        retake_granted_at: grant?.granted_at ?? null,
      };
      row.attempts.push(s);
      // latest = highest attempt_number
      if (s.attempt_number >= row.latest.attempt_number) row.latest = s;
      if (s.status === "graded" && s.score != null) {
        if (retakeRule === "highest") {
          if (!row.best || (row.best.score ?? -1) < s.score) row.best = s;
        } else {
          // 'latest': the most recently attempted graded submission wins,
          // regardless of whether an earlier attempt scored higher.
          if (!row.best || s.attempt_number >= row.best.attempt_number) row.best = s;
        }
      }
      map.set(s.student_id, row);
    }
    // Keep grant fields in sync if grants reload after submissions.
    for (const row of map.values()) {
      const grant = grantByStudentId.get(row.student_id);
      row.retake_granted = !!grant?.is_active;
      row.retake_grant_count = grant?.grant_count ?? 0;
      row.retake_granted_at = grant?.granted_at ?? null;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.student_name.localeCompare(b.student_name)
    );
  }, [submissions, retakeRule, grantByStudentId]);

  const filteredStudentRows = useMemo(() => {
    let rows = studentRows;
    if (subFilter === "graded") rows = rows.filter((r) => r.best !== null);
    if (subFilter === "pending") rows = rows.filter((r) => r.best === null);
    if (subSearch.trim()) {
      const q = subSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          (r.grade ?? "").toLowerCase().includes(q) ||
          (r.section ?? "").toLowerCase().includes(q) ||
          (r.school_name ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [studentRows, subFilter, subSearch]);

  const filteredGrantRows = useMemo(() => {
    let rows = studentRows;
    if (grantFilter === "graded") rows = rows.filter((r) => r.best !== null);
    if (grantFilter === "pending") rows = rows.filter((r) => r.best === null);
    if (grantSearch.trim()) {
      const q = grantSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          (r.grade ?? "").toLowerCase().includes(q) ||
          (r.section ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [studentRows, grantFilter, grantSearch]);

  const statsBar = useMemo(() => {
    const total = assignments.length;
    const published = assignments.filter((a) => a.is_published).length;
    const totalSubs = assignments.reduce((acc, a) => acc + (a.submission_count ?? 0), 0);
    return { total, published, drafts: total - published, totalSubs };
  }, [assignments]);

  /* ─── data loaders ─── */
  const loadAssignments = useCallback(async (type: "DAILY" | "COURSE") => {
    try {
      const { data } = await teacherApi.assignments.list({ type, school_id: activeSchoolId });
      const list = (data as { assignments?: TeacherAssignment[] }).assignments ?? [];
      if (type === "DAILY") setDailyAssignments(list);
      else setCourseAssignments(list);
      setError(null);
    } catch {
      setError("Failed to load assignments");
    }
  }, [activeSchoolId]);

  const loadSubmissions = useCallback(async (assignmentId: string) => {
    if (!assignmentId) return;
    const { data } = await teacherApi.assignments.submissions(assignmentId);
    const payload = data as {
      submissions?: Submission[];
      retake_grants?: RetakeGrantInfo[];
    };
    setSubmissions(payload.submissions ?? []);
    setRetakeGrants(payload.retake_grants ?? []);
  }, []);

  const loadAssignmentDetail = useCallback(async (assignmentId: string) => {
    if (!assignmentId) {
      setAssignmentDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const { data } = await teacherApi.assignments.get(assignmentId);
      const raw = (data as { assignment?: AssignmentDetail }).assignment;
      if (!raw) {
        setAssignmentDetail(null);
        return;
      }
      setAssignmentDetail({
        ...raw,
        submission_count: raw.submission_count ?? 0,
        questions: (raw.questions ?? []).map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? (q.options as string[]) : [],
          correct_answer: q.correct_answer ?? "",
          question_type:
            String(q.question_type).toLowerCase() === "fillblank" ? "FillBlank" : "MCQ",
        })),
      });
    } catch {
      setAssignmentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadClasses = useCallback(async (schoolIds: string[]) => {
    const ids = [...new Set(schoolIds.filter(Boolean))];
    if (ids.length === 0) {
      setTeacherClasses([]);
      return;
    }
    try {
      const results = await Promise.all(
        ids.map(async (schoolId) => {
          const { data } = await teacherApi.classes.list(schoolId);
          return (data as { classes?: TeacherClass[] }).classes ?? [];
        }),
      );
      setTeacherClasses(results.flat());
    } catch {
      setTeacherClasses([]);
    }
  }, []);

  useEffect(() => { void loadAssignments("DAILY"); void loadAssignments("COURSE"); }, [loadAssignments]);

  // Pending-request badge on the tab itself — fetched independently of which
  // tab is active so it's visible before the teacher ever opens the tab.
  useEffect(() => {
    teacherApi.retakeRequests
      .list({ status: "pending" })
      .then(({ data }) => setPendingRetakeRequestCount(((data as { requests?: unknown[] })?.requests ?? []).length))
      .catch(() => setPendingRetakeRequestCount(0));
  }, [tab]);

  useEffect(() => {
    if (tab === "analytics" && !analyticsData) {
      setAnalyticsLoading(true);
      teacherApi.assignments.analytics({ school_id: activeSchoolId })
        .then(({ data }) => setAnalyticsData((data as { analytics?: AnalyticsData }).analytics ?? null))
        .catch(() => setAnalyticsData(null))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [tab, analyticsData, activeSchoolId]);

  // When the active school changes, drop school-specific selections and cached
  // analytics so everything reloads scoped to the newly selected school.
  useEffect(() => {
    setSelectedId("");
    setSubmissions([]);
    setAssignmentDetail(null);
    setAnalyticsData(null);
  }, [activeSchoolId]);

  useEffect(() => {
    if (selectedId) {
      void loadSubmissions(selectedId);
      void loadAssignmentDetail(selectedId);
      setDetailTab("submissions");
    } else {
      setSubmissions([]);
      setAssignmentDetail(null);
    }
  }, [selectedId, loadSubmissions, loadAssignmentDetail]);

  useEffect(() => {
    setSelectedId("");
    setSubmissions([]);
    setAssignmentDetail(null);
    setSearchQuery("");
  }, [tab]);

  useEffect(() => {
    const fromPayload = createPayload.schoolIds.filter(Boolean);
    const fallback =
      activeSchoolId ||
      (Array.isArray(schools) && schools.length > 0
        ? String((schools[0] as { id?: string }).id ?? "")
        : "");
    const ids = fromPayload.length > 0 ? fromPayload : fallback ? [fallback] : [];
    if (ids.length > 0) void loadClasses(ids);
  }, [createPayload.schoolIds, activeSchoolId, schools, loadClasses]);

  // Badge schools that already have a same-title DAILY copy (edit mode).
  useEffect(() => {
    if (modalMode !== "edit" || !editingSchoolId) {
      setSchoolsWithExistingCopy([]);
      return;
    }
    const title = (builderAssignment?.title || "").trim();
    if (!title) {
      setSchoolsWithExistingCopy([]);
      return;
    }
    const otherSchoolIds = (Array.isArray(schools) ? schools : [])
      .map((s) => String((s as { id?: string }).id ?? ""))
      .filter((id) => id && id !== editingSchoolId);
    if (otherSchoolIds.length === 0) {
      setSchoolsWithExistingCopy([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const matches: string[] = [];
      await Promise.all(
        otherSchoolIds.map(async (schoolId) => {
          try {
            const { data } = await teacherApi.assignments.list({
              type: "DAILY",
              school_id: schoolId,
            });
            const list =
              (data as { assignments?: TeacherAssignment[] }).assignments ?? [];
            if (findMatchingDaily(list, title, editingAssignmentId)) {
              matches.push(schoolId);
            }
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) setSchoolsWithExistingCopy(matches);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    modalMode,
    editingSchoolId,
    editingAssignmentId,
    builderAssignment?.title,
    schools,
  ]);

  /* ─── actions ─── */
  // The modal's own "School" field is independent of the header's "Active
  // School" switcher — left unseeded, a teacher who doesn't explicitly
  // re-pick a school can end up creating the assignment under whatever
  // school happened to be selected last (or the first in the list), not the
  // one they're actually looking at, and it then silently doesn't show up
  // in the (activeSchoolId-filtered) list. Seed it from the active school
  // every time the modal opens so the two stay in sync by default.
  const closeAssignmentModal = () => {
    setModalMode(null);
    setEditingAssignmentId(null);
    setEditingSchoolId(null);
    setBuilderAssignment(null);
    setCreatePayload(emptyCreatePayload);
    setSchoolsWithExistingCopy([]);
  };

  const openCreateModal = () => {
    setEditingAssignmentId(null);
    setEditingSchoolId(null);
    const schoolId = activeSchoolId || "";
    setCreatePayload({
      ...emptyCreatePayload,
      schoolIds: schoolId ? [schoolId] : [],
    });
    // Pre-seed so the Questions step never shows the nested "Create Assignment" gate.
    setBuilderAssignment({
      chapter_id: schoolId || "daily-school-assignment",
      title: "",
      description: undefined,
      auto_grading_enabled: true,
      max_score: 100,
      questions: [],
    });
    setModalMode("create");
  };

  const openEditModal = async () => {
    if (!selectedId || tab !== "daily") return;
    setLoading(true);
    setError(null);
    try {
      let detail = assignmentDetail;
      if (!detail || detail.id !== selectedId) {
        const { data } = await teacherApi.assignments.get(selectedId);
        detail = (data as { assignment?: AssignmentDetail }).assignment ?? null;
        if (detail) {
          detail = {
            ...detail,
            questions: (detail.questions ?? []).map((q) => ({
              ...q,
              options: Array.isArray(q.options) ? (q.options as string[]) : [],
              correct_answer: q.correct_answer ?? "",
              question_type:
                String(q.question_type).toLowerCase() === "fillblank" ? "FillBlank" : "MCQ",
            })),
          };
          setAssignmentDetail(detail);
        }
      }
      if (!detail) {
        setError("Failed to load assignment for editing");
        return;
      }

      const schoolId = detail.school_id || activeSchoolId || "";
      let classesForAudience = teacherClasses;
      if (schoolId) {
        const { data } = await teacherApi.classes.list(schoolId);
        classesForAudience = (data as { classes?: TeacherClass[] }).classes ?? [];
        setTeacherClasses(classesForAudience);
      }

      const audience = audienceFromAssignment(detail, classesForAudience);
      setCreatePayload({
        dueDate: toDateInputValue(detail.due_date),
        schoolIds: schoolId ? [schoolId] : [],
        subject: detail.subject ?? "",
        isPublished: !!detail.is_published,
        academicYear: detail.academic_year || "2024-25",
        entireSchool: audience.entireSchool,
        gradeTargets: audience.gradeTargets,
      });
      setBuilderAssignment({
        id: detail.id,
        chapter_id: schoolId || "daily-school-assignment",
        title: detail.title,
        description: detail.description ?? undefined,
        auto_grading_enabled: true,
        max_score: (detail.total_marks ?? detail.questions.reduce((sum, q) => sum + (q.marks || 0), 0)) || 100,
        questions: detail.questions.map((q) => ({
          id: q.id,
          question_type: q.question_type === "FillBlank" ? "FillBlank" : "MCQ",
          question_text: q.question_text,
          options: Array.isArray(q.options) ? q.options : undefined,
          correct_answer: q.correct_answer ?? "",
          marks: q.marks,
        })),
      });
      setEditingAssignmentId(selectedId);
      setEditingSchoolId(schoolId || null);
      setModalMode("edit");
    } catch {
      setError("Failed to open assignment editor");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const fallbackSchoolId =
        activeSchoolId ||
        (Array.isArray(schools) && schools.length > 0
          ? String((schools[0] as { id?: string }).id ?? "")
          : "");
      const schoolIds = [
        ...new Set(
          (createPayload.schoolIds.length > 0
            ? createPayload.schoolIds
            : fallbackSchoolId
              ? [fallbackSchoolId]
              : []
          ).filter(Boolean),
        ),
      ];
      if (schoolIds.length === 0) {
        setError("No school found. Please contact admin.");
        return;
      }
      const missing = schoolsMissingAudience(
        schoolIds,
        createPayload.entireSchool,
        createPayload.gradeTargets,
        teacherClasses,
      );
      if (missing.length > 0) {
        setError(
          schoolIds.length > 1
            ? "Select Entire selected schools, or at least one grade / section for each school."
            : "Select Entire school, or at least one grade / section.",
        );
        return;
      }

      const questionPayload = (builderAssignment?.questions ?? []).map((q) => ({
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options ?? [],
        correct_answer: q.correct_answer,
        marks: q.marks,
      }));
      const base = {
        title: builderAssignment?.title || "Daily Assignment",
        description: builderAssignment?.description || undefined,
        dueDate: createPayload.dueDate || undefined,
        subject: createPayload.subject || undefined,
        totalMarks: builderAssignment?.max_score
          ? Number(builderAssignment.max_score)
          : undefined,
        questions: questionPayload,
        isPublished: createPayload.isPublished,
        assignmentType: "DAILY",
        academicYear: createPayload.academicYear,
      };

      await Promise.all(
        schoolIds.map((schoolId) => {
          const schoolClasses = teacherClasses.filter(
            (c) => !c.school_id || c.school_id === schoolId,
          );
          const schoolTargets = createPayload.entireSchool
            ? []
            : targetsForSchool(createPayload.gradeTargets, schoolClasses);
          const audience = resolveAudiencePayload(
            createPayload.entireSchool,
            schoolTargets,
            schoolClasses,
          );
          return teacherApi.assignments.create({
            ...base,
            schoolId,
            publishScope: audience.publishScope,
            gradeId: audience.gradeId,
            publishedGradeIds: audience.publishedGradeIds,
            publishedSectionIds: audience.publishedSectionIds,
          });
        }),
      );
      closeAssignmentModal();
      await loadAssignments("DAILY");
      setError(null);
    } catch (e: unknown) {
      setError(typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message) : "Failed to create assignment");
    } finally { setLoading(false); }
  };

  const handleUpdate = async () => {
    if (!editingAssignmentId) return;
    const assignmentId = editingAssignmentId;
    const title = (builderAssignment?.title || "Daily Assignment").trim();
    setLoading(true);
    try {
      const originalSchoolId =
        editingSchoolId ||
        (assignmentDetail?.id === assignmentId
          ? assignmentDetail.school_id || ""
          : "") ||
        createPayload.schoolIds[0] ||
        "";
      const schoolIds = [...new Set(createPayload.schoolIds.filter(Boolean))];
      if (schoolIds.length === 0) {
        setError("Select at least one school.");
        return;
      }
      const missing = schoolsMissingAudience(
        schoolIds,
        createPayload.entireSchool,
        createPayload.gradeTargets,
        teacherClasses,
      );
      if (missing.length > 0) {
        setError(
          schoolIds.length > 1
            ? "Select Entire selected schools, or at least one grade / section for each school."
            : "Select Entire school, or at least one grade / section.",
        );
        return;
      }

      const updateSchoolId = originalSchoolId || schoolIds[0];
      const extraSchoolIds = schoolIds.filter((id) => id !== updateSchoolId);

      // Resolve conflicts BEFORE any writes (1A).
      type ExtraAction =
        | { schoolId: string; action: "create" }
        | { schoolId: string; action: "update"; existingId: string; existing: TeacherAssignment }
        | { schoolId: string; action: "leave" };

      const extraActions: ExtraAction[] = [];
      for (const schoolId of extraSchoolIds) {
        const schoolName =
          (schools as Array<{ id?: string; name?: string }>).find(
            (s) => String(s.id) === schoolId,
          )?.name ?? "That school";
        let existing: TeacherAssignment | undefined;
        try {
          const { data } = await teacherApi.assignments.list({
            type: "DAILY",
            school_id: schoolId,
          });
          const list =
            (data as { assignments?: TeacherAssignment[] }).assignments ?? [];
          existing = findMatchingDaily(list, title, assignmentId);
        } catch {
          existing = undefined;
        }

        if (!existing) {
          extraActions.push({ schoolId, action: "create" });
          continue;
        }

        const choice = await choiceDialog({
          title: `${schoolName} already has this assignment`,
          description: `"${existing.title}" already exists at ${schoolName}. Leave it unchanged, or update that copy with your current questions and audience.`,
          primaryText: "Update existing copy",
          secondaryText: "Leave unchanged",
          cancelText: "Cancel save",
        });
        if (choice === "cancel") {
          setLoading(false);
          return;
        }
        if (choice === "primary") {
          extraActions.push({
            schoolId,
            action: "update",
            existingId: existing.id,
            existing,
          });
        } else {
          extraActions.push({ schoolId, action: "leave" });
        }
      }

      const lockQuestions =
        createPayload.isPublished || editSubmissionCount > 0;
      const questionPayload = (builderAssignment?.questions ?? []).map((q) => ({
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options ?? [],
        correct_answer: q.correct_answer,
        marks: q.marks,
      }));

      const audienceFor = (schoolId: string) => {
        const schoolClasses = teacherClasses.filter(
          (c) => !c.school_id || c.school_id === schoolId,
        );
        const schoolTargets = createPayload.entireSchool
          ? []
          : targetsForSchool(createPayload.gradeTargets, schoolClasses);
        return resolveAudiencePayload(
          createPayload.entireSchool,
          schoolTargets,
          schoolClasses,
        );
      };

      const updateAudience = audienceFor(updateSchoolId);
      await teacherApi.assignments.update(assignmentId, {
        title: title || "Daily Assignment",
        description: builderAssignment?.description || undefined,
        dueDate: createPayload.dueDate || undefined,
        subject: createPayload.subject || undefined,
        totalMarks: lockQuestions
          ? undefined
          : builderAssignment?.max_score
            ? Number(builderAssignment.max_score)
            : undefined,
        ...(lockQuestions ? {} : { questions: questionPayload }),
        isPublished: createPayload.isPublished,
        publishScope: updateAudience.publishScope,
        gradeId: updateAudience.gradeId ?? null,
        publishedGradeIds: updateAudience.publishedGradeIds,
        publishedSectionIds: updateAudience.publishedSectionIds,
      });

      for (const item of extraActions) {
        if (item.action === "leave") continue;
        const audience = audienceFor(item.schoolId);
        if (item.action === "create") {
          await teacherApi.assignments.create({
            title: title || "Daily Assignment",
            description: builderAssignment?.description || undefined,
            dueDate: createPayload.dueDate || undefined,
            schoolId: item.schoolId,
            subject: createPayload.subject || undefined,
            totalMarks: builderAssignment?.max_score
              ? Number(builderAssignment.max_score)
              : undefined,
            questions: questionPayload,
            isPublished: createPayload.isPublished,
            assignmentType: "DAILY",
            academicYear: createPayload.academicYear,
            publishScope: audience.publishScope,
            gradeId: audience.gradeId,
            publishedGradeIds: audience.publishedGradeIds,
            publishedSectionIds: audience.publishedSectionIds,
          });
          continue;
        }

        // Update existing copy — respect question lock on that copy.
        const copyLocked =
          !!item.existing.is_published ||
          (item.existing.submission_count ?? 0) > 0;
        await teacherApi.assignments.update(item.existingId, {
          title: title || "Daily Assignment",
          description: builderAssignment?.description || undefined,
          dueDate: createPayload.dueDate || undefined,
          subject: createPayload.subject || undefined,
          totalMarks: copyLocked
            ? undefined
            : builderAssignment?.max_score
              ? Number(builderAssignment.max_score)
              : undefined,
          ...(copyLocked ? {} : { questions: questionPayload }),
          isPublished: createPayload.isPublished,
          publishScope: audience.publishScope,
          gradeId: audience.gradeId ?? null,
          publishedGradeIds: audience.publishedGradeIds,
          publishedSectionIds: audience.publishedSectionIds,
        });
      }

      closeAssignmentModal();
      await loadAssignments("DAILY");
      await loadAssignmentDetail(assignmentId);
      setError(null);
    } catch (e: unknown) {
      setError(typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message) : "Failed to update assignment");
    } finally { setLoading(false); }
  };

  const handleTogglePublish = async (a: TeacherAssignment) => {
    setLoading(true);
    try {
      await teacherApi.assignments.update(a.id, { isPublished: !a.is_published });
      await loadAssignments(tab === "daily" ? "DAILY" : "COURSE");
      if (selectedId === a.id) await loadAssignmentDetail(a.id);
      setError(null);
    } catch { setError("Failed to update assignment"); }
    finally { setLoading(false); }
  };

  const handleGrade = async (submissionId: string) => {
    if (!selectedId) return;
    const payload = grading[submissionId] ?? { score: "", feedback: "" };
    setLoading(true);
    try {
      await teacherApi.assignments.grade(selectedId, submissionId, {
        score: payload.score ? Number(payload.score) : undefined,
        feedback: payload.feedback || undefined,
        status: "graded",
      });
      await loadSubmissions(selectedId);
      if (tab === "daily") await loadAssignments("DAILY"); else await loadAssignments("COURSE");
    } finally { setLoading(false); }
  };

  const handleOpenRetakeForAll = async () => {
    if (!selectedId) return;
    if (!(await confirmDialog({
      title: 'Open retake for all?',
      description: 'Open the retake window for all students who have already submitted.',
      confirmText: 'Open Retake',
    }))) return;
    setLoading(true);
    try {
      await teacherApi.assignments.openRetakeForAll(selectedId);
      await loadSubmissions(selectedId);
      setError(null);
    } catch { setError("Failed to open retake window"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (assignmentId: string) => {
    const target = assignments.find((a) => a.id === assignmentId);
    const submissionCount = target?.submission_count ?? 0;
    if (!(await confirmDialog({
      title: 'Delete this assignment?',
      description:
        submissionCount > 0
          ? `This will permanently delete ${submissionCount} existing student submission${submissionCount === 1 ? '' : 's'} (including any grades/feedback already given) along with the assignment. This action cannot be undone.`
          : 'This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    }))) return;
    setLoading(true);
    try {
      await teacherApi.assignments.delete(assignmentId);
      if (selectedId === assignmentId) {
        setSelectedId("");
        setSubmissions([]);
        setAssignmentDetail(null);
      }
      await loadAssignments("DAILY");
    } catch { setError("Failed to delete assignment"); }
    finally { setLoading(false); }
  };


  const showSchoolSelect =
    modalMode === "edit" ||
    !activeSchoolId ||
    (Array.isArray(schools) && schools.length > 1);

  const retakeRuleLabel =
    (selectedAssignment?.retake_rule ?? "latest").toLowerCase() === "highest"
      ? "Best score"
      : "Latest score";

  const handleGrantRetake = async (studentId: number) => {
    if (!selectedId) return;
    setGrantingStudentId(studentId);
    setLoading(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7441/ingest/b3c04580-14c5-4099-bcec-c0dbc729bb7f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'990e57'},body:JSON.stringify({sessionId:'990e57',runId:'post-fix',hypothesisId:'G',location:'teacher/assignments/page.tsx:handleGrantRetake',message:'grant start',data:{assignmentId:selectedId,studentId,activate:true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await teacherApi.assignments.grantRetake(selectedId, {
        studentIds: [studentId],
        isActive: true,
      });
      await Promise.all([
        loadSubmissions(selectedId),
        loadAssignmentDetail(selectedId),
      ]);
      setError(null);
      toast.success("Retake access granted");
      // #region agent log
      fetch('http://127.0.0.1:7441/ingest/b3c04580-14c5-4099-bcec-c0dbc729bb7f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'990e57'},body:JSON.stringify({sessionId:'990e57',runId:'post-fix',hypothesisId:'G',location:'teacher/assignments/page.tsx:handleGrantRetake',message:'grant ok',data:{assignmentId:selectedId,studentId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (e: unknown) {
      setError(
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : "Failed to grant retake",
      );
    } finally {
      setLoading(false);
      setGrantingStudentId(null);
    }
  };

  const handleRevokeRetake = async (studentId: number) => {
    if (!selectedId) return;
    setGrantingStudentId(studentId);
    setLoading(true);
    try {
      await teacherApi.assignments.grantRetake(selectedId, {
        studentIds: [studentId],
        isActive: false,
      });
      await loadSubmissions(selectedId);
      setError(null);
      toast.success("Retake access revoked");
    } catch (e: unknown) {
      setError(
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : "Failed to revoke retake",
      );
    } finally {
      setLoading(false);
      setGrantingStudentId(null);
    }
  };

  return (
    <div className="min-h-full bg-white">
      <AssignmentsPageHeader
        tab={tab}
        onTabChange={setTab}
        pendingRetakeCount={pendingRetakeRequestCount}
        onNewAssignment={openCreateModal}
      />

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {tab === "analytics" && (
        <div className="px-6 py-6 max-w-6xl mx-auto">
          <AssignmentAnalyticsPanel loading={analyticsLoading} data={analyticsData} />
        </div>
      )}

      {tab === "requests" && (
        <div className="px-6 py-6 max-w-4xl mx-auto">
          <TeacherRetakeRequestsPanel />
        </div>
      )}

      {(tab === "daily" || tab === "course") && (
        <div className="flex h-[calc(100vh-9.5rem)] border-t border-gray-100">
          <div
            className={`${
              selectedId ? "hidden lg:flex" : "flex"
            } w-full lg:w-auto`}
          >
            <AssignmentListPane
              tab={tab}
              assignments={assignments}
              filteredAssignments={filteredAssignments}
              selectedId={selectedId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelect={setSelectedId}
              onCreate={tab === "daily" ? openCreateModal : undefined}
              teacherClasses={teacherClasses}
              stats={statsBar}
            />
          </div>

          <div
            className={`${
              selectedId ? "flex" : "hidden lg:flex"
            } flex-1 min-w-0`}
          >
            <AssignmentDetailPane
              tab={tab}
              selectedAssignment={selectedAssignment ?? null}
              assignmentDetail={assignmentDetail}
              detailLoading={detailLoading}
              detailTab={detailTab}
              onDetailTabChange={setDetailTab}
              onBack={() => setSelectedId("")}
              loading={loading}
              teacherClasses={teacherClasses}
              submissionsCount={submissions.length}
              gradedCount={gradedSubmissions.length}
              pendingCount={pendingSubmissions.length}
              onEdit={() => void openEditModal()}
              onTogglePublish={() =>
                selectedAssignment && void handleTogglePublish(selectedAssignment)
              }
              onDelete={() =>
                selectedAssignment && void handleDelete(selectedAssignment.id)
              }
              onOpenRetakeForAll={() => void handleOpenRetakeForAll()}
              onGrantRetake={(id) => void handleGrantRetake(id)}
              onRevokeRetake={(id) => void handleRevokeRetake(id)}
              grantingStudentId={grantingStudentId}
              studentRows={studentRows}
              filteredStudentRows={filteredStudentRows}
              subSearch={subSearch}
              onSubSearchChange={setSubSearch}
              subFilter={subFilter}
              onSubFilterChange={setSubFilter}
              expanded={expanded}
              onToggleExpand={(studentId) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(studentId)) next.delete(studentId);
                  else next.add(studentId);
                  return next;
                })
              }
              grading={grading}
              onGradingChange={(id, patch) =>
                setGrading((prev) => ({
                  ...prev,
                  [id]: {
                    score: patch.score ?? prev[id]?.score ?? "",
                    feedback: patch.feedback ?? prev[id]?.feedback ?? "",
                  },
                }))
              }
              onGrade={(id) => void handleGrade(id)}
              retakeRuleLabel={retakeRuleLabel}
              grantSearch={grantSearch}
              onGrantSearchChange={setGrantSearch}
              grantFilter={grantFilter}
              onGrantFilterChange={setGrantFilter}
              filteredGrantRows={filteredGrantRows}
            />
          </div>
        </div>
      )}

      {modalMode && (
        <AssignmentFormDrawer
          mode={modalMode}
          payload={createPayload}
          onPayloadChange={(patch) =>
            setCreatePayload((p) => ({ ...p, ...patch }))
          }
          schools={schools as Array<{ id?: string; name?: string }>}
          showSchoolSelect={showSchoolSelect}
          lockedSchoolId={
            modalMode === "edit"
              ? editingSchoolId || undefined
              : undefined
          }
          schoolsWithExistingCopy={schoolsWithExistingCopy}
          teacherClasses={teacherClasses}
          builderAssignment={builderAssignment}
          onBuilderChange={setBuilderAssignment}
          questionsLocked={questionsLocked}
          questionsLockMessage={questionsLockMessage}
          loading={loading}
          onClose={closeAssignmentModal}
          onSubmit={() => void (modalMode === "edit" ? handleUpdate() : handleCreate())}
        />
      )}
    </div>
  );
}

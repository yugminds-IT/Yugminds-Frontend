"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Users } from "lucide-react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { getStoredUserId } from "@/lib/session-utils";
import { toast } from "@/components/ui/toast";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import ConfirmModal from "@/components/portal/ConfirmModal";
import { ChipGroup } from "@/components/portal/notifications";
import StatusRun from "@/components/school-admin/courses/StatusRun";
import CourseDetailModal from "@/components/school-admin/courses/CourseDetailModal";
import CourseStudentsModal from "@/components/school-admin/courses/CourseStudentsModal";
import { accessLabels, formatGrade, type Course, type CourseChapter, type CourseStatus, type CourseStudentsData } from "@/components/school-admin/courses/types";
import "@/components/school-admin/students.css";
import "@/components/school-admin/teachers.css";
import "@/components/school-admin/courses/courses.css";

interface ApiChapter {
  id: string;
  order_number?: number;
  order_index?: number;
  title?: string;
  name?: string;
  learning_outcomes?: string[];
  content_description?: string;
  is_published?: boolean;
}
interface ApiCourse {
  id: string;
  grades?: string[];
  grade?: string;
  grade_access?: Array<{ grade: string; sections?: string[] }>;
  title?: string;
  course_name?: string;
  description?: string;
  num_chapters?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  chapters?: ApiChapter[];
}
interface ApiProgress {
  course_id: string;
  total_students?: number;
  completed_students?: number;
  average_progress?: number;
}

const MAX_CHIPS = 4;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function mapCourse(c: ApiCourse): Course {
  // The API gives `grades` as an array; a comma-separated string is still accepted.
  const grades = Array.isArray(c.grades) ? c.grades : c.grade ? c.grade.split(",").map((g) => g.trim()) : [];
  const grade_access = Array.isArray(c.grade_access)
    ? c.grade_access.map((g) => ({ grade: g.grade, sections: Array.isArray(g.sections) ? g.sections : [] }))
    : grades.map((grade) => ({ grade, sections: [] as string[] }));
  const chapters: CourseChapter[] = (Array.isArray(c.chapters) ? c.chapters : []).map((ch) => ({
    id: ch.id,
    chapter_number: ch.order_number || ch.order_index || 0,
    title: ch.title || ch.name || "Untitled chapter",
    learning_outcomes: ch.learning_outcomes || [],
    content_description: ch.content_description || "",
    is_published: !!ch.is_published,
  }));
  return {
    id: c.id,
    course_name: c.title || c.course_name || "Untitled course",
    description: c.description || "",
    num_chapters: c.num_chapters !== undefined ? c.num_chapters : chapters.length,
    status: (c.status || "Draft") as CourseStatus,
    created_at: c.created_at ?? "",
    updated_at: c.updated_at ?? "",
    grades,
    grade_access,
    chapters,
    student_progress: { total_students: 0, completed_students: 0, average_progress: 0 },
  };
}

export default function CoursesManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "all">("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [schoolStudents, setSchoolStudents] = useState(0);
  const [viewing, setViewing] = useState<Course | null>(null);
  const [studentsFor, setStudentsFor] = useState<Course | null>(null);
  const [studentsData, setStudentsData] = useState<CourseStudentsData | null>(null);
  const [requesting, setRequesting] = useState<Course | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const isFetchingRef = useRef(false);

  const loadCourses = useCallback(async (opts?: { silent?: boolean }) => {
    if (isFetchingRef.current) return; // don't overlap loads
    isFetchingRef.current = true;
    try {
      if (!opts?.silent) setLoading(true);
      setLoadFailed(false);
      const [coursesRes, progressRes, studentsRes] = await Promise.all([
        schoolAdminApi.courses.list({ limit: 100 }),
        schoolAdminApi.courses.progress(),
        // Only the count is needed: ask for one row and read the real `total`.
        schoolAdminApi.students.list({ limit: 1 }),
      ]);
      const coursesData = coursesRes.data ?? {};
      const apiCourses = ((coursesData as { courses?: ApiCourse[] }).courses ?? (Array.isArray(coursesData) ? coursesData : [])) as ApiCourse[];
      const progress = ((progressRes.data ?? {}) as { progress?: ApiProgress[] }).progress ?? [];
      const progressMap = new Map(progress.map((p) => [p.course_id, p]));
      setSchoolStudents(Number(((studentsRes.data ?? {}) as { total?: number }).total ?? 0));
      setCourses(
        apiCourses.map(mapCourse).map((course) => {
          const p = progressMap.get(course.id);
          return p
            ? { ...course, student_progress: { total_students: p.total_students ?? 0, completed_students: p.completed_students ?? 0, average_progress: p.average_progress ?? 0 } }
            : course;
        }),
      );
    } catch (error) {
      console.error("Error loading courses:", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useDashboardRealtime("school_admin", {
    enabled: true,
    debugLabel: "school-admin-courses",
    onStats: () => void loadCourses({ silent: true }),
  });

  const openStudents = async (course: Course) => {
    setViewing(null);
    setStudentsFor(course);
    setStudentsData(null);
    try {
      const res = await schoolAdminApi.courses.progressStudentDetail({ courseId: course.id });
      const data = res.data as CourseStudentsData | undefined;
      setStudentsData(data && Array.isArray(data.students) ? data : { students: [], chapters: [], error: "The server sent something we could not read." });
    } catch (e) {
      setStudentsData({ students: [], chapters: [], error: e instanceof Error ? e.message : "Try again in a moment." });
    }
  };

  const sendUpdateRequest = async () => {
    if (!requesting) return;
    const userId = getStoredUserId();
    if (!userId) {
      toast.warning("Log in again to send an update request.");
      return;
    }
    setRequestBusy(true);
    try {
      const label = requesting.grades.map(formatGrade).join(", ");
      await schoolAdminApi.notifications.create({
        title: "Course Update Request",
        message: `School admin has requested an update for course: ${requesting.course_name}${label ? ` (${label})` : ""}`,
        type: "info",
        recipientType: "role",
        recipients: ["admin"],
      });
      toast.success("Update request sent to the main admin.");
      setRequesting(null);
    } catch (err) {
      toast.error(`The request did not send: ${err instanceof Error ? err.message : "Try again."}`);
    } finally {
      setRequestBusy(false);
    }
  };

  /* ───────── filtering and numbers ───────── */
  const gradeOptions = useMemo(() => [...new Set(courses.flatMap((c) => c.grades).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [courses]);
  const filtered = courses.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      (c.course_name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) &&
      (statusFilter === "all" || c.status === statusFilter) &&
      (gradeFilter === "all" || c.grades.includes(gradeFilter))
    );
  });

  const counts: Record<CourseStatus, number> = {
    Draft: courses.filter((c) => c.status === "Draft").length,
    Published: courses.filter((c) => c.status === "Published").length,
    Archived: courses.filter((c) => c.status === "Archived").length,
  };
  // courses nobody is taking would drag the average to zero, so they are left out
  const withStudents = courses.filter((c) => c.student_progress.total_students > 0);
  const average = withStudents.length ? Math.round(withStudents.reduce((n, c) => n + c.student_progress.average_progress, 0) / withStudents.length) : null;
  const enrolments = courses.reduce((n, c) => n + c.student_progress.total_students, 0);
  const finished = courses.reduce((n, c) => n + c.student_progress.completed_students, 0);
  const hasFilters = !!searchTerm || statusFilter !== "all" || gradeFilter !== "all";
  const clearFilters = () => { setSearchTerm(""); setStatusFilter("all"); setGradeFilter("all"); };

  let status: React.ReactNode;
  if (loadFailed) status = "The courses did not load. Check your connection and try again.";
  else if (loading) status = "Loading courses…";
  else if (courses.length === 0) status = "No courses are open to your school yet. The main admin assigns them.";
  else if (counts.Published === 0) status = <><strong>{plural(courses.length, "course")}</strong> assigned, none published yet.</>;
  else status = <><strong>{plural(counts.Published, "course")}</strong> {counts.Published === 1 ? "is" : "are"} live for {plural(schoolStudents, "student")}{average != null ? <>. Students are {average}% through on average.</> : "."}</>;

  const tiles = [
    { label: "Courses", value: String(courses.length), hint: `${counts.Published} published` },
    { label: "Students", value: schoolStudents.toLocaleString("en-IN"), hint: "In your school" },
    { label: "Average progress", value: average == null ? "–" : `${average}%`, hint: "Courses with students" },
    { label: "Finished", value: String(finished), hint: `of ${plural(enrolments, "enrolment")}` },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="cr-title">
        <div className="sd-hero-copy">
          <h1 id="cr-title" className="mc-hero-title">Courses</h1>
          <p className="sd-status">{status}</p>
        </div>
        <StatusRun counts={counts} selected={statusFilter} onSelect={setStatusFilter} average={average} />
      </section>

      <div className="sd-ledger" role="group" aria-label="Course summary">
        {tiles.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {loading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{m.value}</b>}
            <small>{m.hint}</small>
          </div>
        ))}
      </div>

      <div className="nt-bar">
        <input type="search" className="sd-field" placeholder="Search courses" aria-label="Search courses" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        {gradeOptions.length > 0 && (
          <ChipGroup label="Grade" value={gradeFilter} options={[["all", "All grades"] as const, ...gradeOptions.map((g) => [g, g] as const)]} onChange={setGradeFilter} />
        )}
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
      </div>

      {loading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : loadFailed ? (
        <section className="sd-panel">
          <div className="sd-empty"><b>We could not load your courses</b><p>Check your connection, then try again.</p><button className="sd-btn sd-btn--amber" onClick={() => void loadCourses()}>Try again</button></div>
        </section>
      ) : filtered.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{courses.length === 0 ? "No courses yet" : "No courses match"}</b>
            <p>{courses.length === 0 ? "Courses the main admin opens to your classes will show up here." : "Try a different search, or clear the filters."}</p>
            {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
          </div>
        </section>
      ) : (
        <div className="cr-grid mc-swap">
          {filtered.map((c) => {
            const labels = accessLabels(c);
            const p = c.student_progress;
            return (
              <article key={c.id} className="cr-card">
                <button className="cr-card-main" onClick={() => setViewing(c)} aria-label={`Open ${c.course_name}`}>
                  <span className="cr-title"><b>{c.course_name}</b><span className="sm-chip" data-on={c.status === "Published"} data-warn={c.status === "Archived" ? "true" : undefined}>{c.status}</span></span>
                  {c.description && <span className="cr-desc">{c.description}</span>}
                  <span className="tm-chips">
                    {labels.length === 0 ? <span className="sm-chip">No class yet</span> : labels.slice(0, MAX_CHIPS).map((l) => <span key={l} className="sm-chip" data-class="true">{l}</span>)}
                    {labels.length > MAX_CHIPS && <span className="sm-chip">+{labels.length - MAX_CHIPS} more</span>}
                  </span>
                  <span className="cr-meter">
                    <span>{p.total_students === 0 ? "No students yet" : "Average progress"}<b>{p.total_students === 0 ? "–" : `${p.average_progress}%`}</b></span>
                    <i className="tm-bar cr-bar" aria-hidden="true"><u style={{ width: `${p.average_progress}%` }} /></i>
                  </span>
                </button>
                <div className="cr-foot">
                  <button className="cr-students" onClick={() => void openStudents(c)} aria-label={`See the ${plural(p.total_students, "student")} in ${c.course_name}`}>
                    <Users aria-hidden="true" style={{ display: "inline", width: "1rem", height: "1rem", marginRight: "0.35rem", verticalAlign: "-0.15em" }} />
                    {plural(p.total_students, "student")}{p.completed_students > 0 ? `, ${p.completed_students} finished` : ""}
                  </button>
                  <span>{plural(c.num_chapters, "chapter")}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CourseDetailModal
        course={viewing}
        onClose={() => setViewing(null)}
        onStudents={() => viewing && void openStudents(viewing)}
        onRequestUpdate={() => { if (viewing) { setRequesting(viewing); setViewing(null); } }}
      />

      <CourseStudentsModal key={studentsFor?.id ?? "none"} course={studentsFor} data={studentsData} onClose={() => setStudentsFor(null)} />

      <ConfirmModal
        open={!!requesting}
        onClose={() => setRequesting(null)}
        busy={requestBusy}
        title="Request an update?"
        subtitle={requesting ? `This tells the main admin you would like changes to ${requesting.course_name}.` : undefined}
        confirmLabel="Send request"
        onConfirm={() => void sendUpdateRequest()}
      >
        <p>They get a notification. You will hear back through your notifications.</p>
      </ConfirmModal>
    </div>
  );
}

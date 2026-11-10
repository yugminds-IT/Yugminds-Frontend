"use client";

import { useState } from "react";
import { Loader2, UserCog } from "lucide-react";
import Modal from "../portal/Modal";
import { initialsOf } from "../portal/notifications";
import { addedOn, classLine, placementsOf } from "./students/utils";
import { startImpersonation, impersonationLandingPath } from "@/lib/impersonation";

interface StudentSchool {
  id?: string;
  student_id?: string;
  school_id?: string;
  school_name?: string | null;
  grade?: string;
  section?: string;
  is_active?: boolean;
  schools?: { name?: string };
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

export interface ViewStudentDialogStudent {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  parent_name?: string;
  parent_phone?: string;
  student_schools?: Array<StudentSchool & { schools?: { name?: string } }>;
  courses?: Course[];
  student_courses?: StudentCourse[];
  progress?: number;
}

/**
 * Read-only student detail dialog — extracted from the students management
 * page's ~3300-line file. Pure display, no mutation handlers, so it carries
 * none of that page's form/import state.
 */
export default function ViewStudentDialog({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: ViewStudentDialogStudent | null;
}) {
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

  const handleImpersonate = async () => {
    if (!student) return;
    setImpersonating(true);
    setImpersonateError(null);
    try {
      const { role } = await startImpersonation(parseInt(student.id, 10));
      window.location.href = impersonationLandingPath(role);
    } catch (e) {
      setImpersonateError(e instanceof Error ? e.message : "Could not sign in as this student.");
      setImpersonating(false);
    }
  };

  const progress = Math.round(student?.progress ?? 0);
  const places = student ? placementsOf(student) : [];
  const courses = student?.student_courses ?? [];

  return (
    <Modal
      open={open && !!student}
      onClose={() => onOpenChange(false)}
      wide
      title={student?.full_name ?? "Student"}
      subtitle={student?.email}
      footer={
        <>
          {impersonateError && <span className="ad-view-err" role="alert">{impersonateError}</span>}
          <button className="sd-btn sd-btn--line" onClick={handleImpersonate} disabled={impersonating || !student}>
            {impersonating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserCog aria-hidden="true" />}
            Sign in as this student
          </button>
          <button className="sd-btn sd-btn--amber" onClick={() => onOpenChange(false)}>Close</button>
        </>
      }
    >
      {student && (
        <div className="ad-view">
          <div className="ad-view-top">
            <span className="sd-avatar" aria-hidden="true">{initialsOf(student.full_name)}</span>
            <dl className="ad-facts">
              <div><dt>Student ID</dt><dd>{student.id}</dd></div>
              <div><dt>Added</dt><dd>{addedOn(student.created_at) || "Unknown"}</dd></div>
              {student.parent_name && <div><dt>Parent</dt><dd>{student.parent_name}</dd></div>}
              {student.parent_phone && <div><dt>Parent phone</dt><dd>{student.parent_phone}</dd></div>}
            </dl>
          </div>

          <section aria-labelledby="ad-view-progress">
            <h3 id="ad-view-progress">Overall progress</h3>
            <div className="ad-view-prog">
              <span className="sd-meter" role="img" aria-label={`${progress}% through their courses`}><i style={{ "--p": `${Math.max(progress, 2)}%` } as React.CSSProperties} /></span>
              <b>{progress}%</b>
            </div>
          </section>

          <section aria-labelledby="ad-view-class">
            <h3 id="ad-view-class">School and class</h3>
            {places.length === 0 ? <p className="ad-view-none">Not in a school yet.</p> : places.map((p, i) => (
              <div key={`${p.schoolId}-${i}`} className="ad-view-row">
                <span><b>{p.school}</b><small>{classLine(p)}</small></span>
                {student.student_schools?.[i]?.is_active === false && <span className="sm-chip" data-on="false">Inactive</span>}
              </div>
            ))}
          </section>

          <section aria-labelledby="ad-view-courses">
            <h3 id="ad-view-courses">Courses</h3>
            {courses.length === 0 ? <p className="ad-view-none">Not enrolled in any course yet.</p> : courses.map((c: StudentCourse, i: number) => (
              <div key={c.id ?? i} className="ad-view-row">
                <span><b>{c.courses?.course_name || "Course"}</b></span>
                {c.progress_percentage !== undefined && (
                  <span className="ad-view-cp">
                    <span className="sd-meter" role="img" aria-label={`${c.progress_percentage}% done`}><i style={{ "--p": `${Math.max(c.progress_percentage, 2)}%` } as React.CSSProperties} /></span>
                    <b>{Math.round(c.progress_percentage)}%</b>
                  </span>
                )}
              </div>
            ))}
          </section>
        </div>
      )}
    </Modal>
  );
}

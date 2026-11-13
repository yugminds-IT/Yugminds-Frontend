"use client";

import { useMemo } from "react";
import { teacherApi } from "@/lib/api/teacher.api";
import { useTeacherStudentProgress } from "@/hooks/useStudentProgress";
import { useTeacherSchool } from "@/app/lms/teacher/context";
import { loadTeacherReport } from "@/components/teacher/assignments/ReportDownloadDialog";
import PerformanceView from "./PerformanceView";

/** Same view as the school admin's, limited to the teacher's own sections and the school picked in the header. */
export default function TeacherPerformance({ mode }: { mode: "overall" | "daily" }) {
  const schoolId = useTeacherSchool().selectedSchool?.id;
  const progress = useTeacherStudentProgress(schoolId);
  const completion = useMemo(
    () => (progress.data?.students ? new Map(progress.data.students.map((p) => [String(p.student_id), Number(p.average_progress) || 0])) : undefined),
    [progress.data],
  );
  return (
    <PerformanceView
      key={schoolId ?? "all"} // switching school closes any open assignment and resets filters
      mode={mode}
      scope="your sections"
      queryKey={["teacher", "leaderboard", schoolId ?? "all"]}
      fetchLeaderboard={() => teacherApi.leaderboard.get(schoolId)}
      fetchMarks={(id) => teacherApi.leaderboard.assignmentMarks(id, schoolId)}
      loadReport={loadTeacherReport}
      completion={completion}
    />
  );
}

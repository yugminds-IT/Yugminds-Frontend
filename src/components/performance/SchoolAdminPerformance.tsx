"use client";

import { useMemo } from "react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { useSchoolAdminStudentProgress } from "@/hooks/useStudentProgress";
import { reportLoader } from "@/components/teacher/assignments/ReportDownloadDialog";
import PerformanceView from "./PerformanceView";

export default function SchoolAdminPerformance({ mode }: { mode: "overall" | "daily" }) {
  const progress = useSchoolAdminStudentProgress();
  const completion = useMemo(
    () => (progress.data?.students ? new Map(progress.data.students.map((p) => [String(p.student_id), Number(p.average_progress) || 0])) : undefined),
    [progress.data],
  );
  return (
    <PerformanceView
      mode={mode}
      queryKey={["school-admin", "leaderboard"]}
      fetchLeaderboard={() => schoolAdminApi.stats.leaderboard()}
      fetchMarks={(id) => schoolAdminApi.stats.assignmentMarks(id)}
      loadReport={reportLoader(schoolAdminApi.stats.assignmentReport)}
      completion={completion}
    />
  );
}

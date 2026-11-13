"use client";

import ExamAnalyticsView from "@/components/performance/ExamAnalyticsView";
import { teacherApi } from "@/lib/api/teacher.api";
import { loadTeacherReport } from "@/components/teacher/assignments/ReportDownloadDialog";
import { useTeacherSchool } from "../context";

export default function Page() {
  // Follow the school switcher: only the selected school's exams.
  const { selectedSchool } = useTeacherSchool();
  const schoolId = selectedSchool?.id;
  return (
    <ExamAnalyticsView
      queryKey={["teacher", "exam-analytics", schoolId ?? "all"]}
      fetcher={() => teacherApi.assignments.examAnalytics({ school_id: schoolId })}
      loadReport={loadTeacherReport}
    />
  );
}

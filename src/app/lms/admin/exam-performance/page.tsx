"use client";

import ExamAnalyticsView from "@/components/performance/ExamAnalyticsView";
import { reportLoader } from "@/components/teacher/assignments/ReportDownloadDialog";
import { adminApi } from "@/lib/api/admin.api";

export default function Page() {
  return <ExamAnalyticsView queryKey={["admin", "exam-analytics"]} fetcher={(school_id) => adminApi.dashboard.examAnalytics({ school_id })} loadReport={reportLoader(adminApi.dashboard.assignmentReport)} />;
}

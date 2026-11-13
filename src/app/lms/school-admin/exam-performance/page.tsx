"use client";

import ExamAnalyticsView from "@/components/performance/ExamAnalyticsView";
import { reportLoader } from "@/components/teacher/assignments/ReportDownloadDialog";
import { schoolAdminApi } from "@/lib/api/school-admin.api";

export default function Page() {
  return <ExamAnalyticsView queryKey={["school-admin", "exam-analytics"]} fetcher={() => schoolAdminApi.stats.examAnalytics()} loadReport={reportLoader(schoolAdminApi.stats.assignmentReport)} />;
}

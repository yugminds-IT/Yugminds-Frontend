"use client";

import ResetRequestsView from "@/components/school-admin/resets/ResetRequestsView";
import { schoolAdminApi } from "@/lib/api/school-admin.api";

export default function SchoolAdminPasswordResetRequestsPage() {
  return <ResetRequestsView api={schoolAdminApi.passwordResetRequests} keyPrefix="sa-resets" audience="your students and teachers" />;
}

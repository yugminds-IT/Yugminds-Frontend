"use client";

import ResetRequestsView from "@/components/school-admin/resets/ResetRequestsView";
import { adminApi } from "@/lib/api/admin.api";

export default function PasswordResetRequestsPage() {
  return (
    <ResetRequestsView
      api={adminApi.passwordResetRequests}
      keyPrefix="ad-resets"
      audience="students, teachers and school admins"
      where="Everyone who is locked out"
      showSchool
    />
  );
}

"use client";

import AccountSettings, { type AccountAdapter, type LoadResult, type PrefSpec } from "@/components/portal/AccountSettings";
import { commonApi } from "@/lib/api";
import { schoolAdminApi } from "@/lib/api/school-admin.api";

const PREFS: PrefSpec[] = [
  { key: "system_alerts", label: "System alerts", description: "Platform announcements and system notices" },
  { key: "teacher_leave_requests", label: "Teacher leave requests", description: "Alerts when teachers at your school submit leave requests" },
];

const adapter: AccountAdapter = {
  async load(userId): Promise<LoadResult> {
    const { data: roleData } = await commonApi.getRole(userId);
    const role = String((roleData as { role?: string })?.role ?? "").trim().toLowerCase();
    if (role !== "school_admin") return { redirect: "/lms/redirect", fullName: "", prefs: {} };

    const { data } = await schoolAdminApi.profile.get();
    const p = data as { full_name?: string; profile?: { full_name?: string }; system_alerts?: boolean; teacher_leave_requests?: boolean };
    return {
      fullName: p?.full_name ?? p?.profile?.full_name ?? "",
      prefs: { system_alerts: p?.system_alerts ?? true, teacher_leave_requests: p?.teacher_leave_requests ?? true },
      raw: p,
    };
  },
  save: (d) => schoolAdminApi.profile.update(d),
};

export default function SchoolAdminSettings() {
  return <AccountSettings adapter={adapter} prefs={PREFS} intro="Change your name, your password and which alerts you get." />;
}

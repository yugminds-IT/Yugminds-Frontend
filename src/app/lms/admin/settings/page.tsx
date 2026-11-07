"use client";

import AccountSettings, { type AccountAdapter, type LoadResult, type PrefSpec } from "@/components/portal/AccountSettings";
import { adminApi, commonApi } from "@/lib/api";

const PREFS: PrefSpec[] = [
  { key: "system_alerts", label: "System alerts", description: "Weekly platform digests and system announcements" },
  { key: "teacher_leave_requests", label: "Teacher leave requests", description: "Alerts when teachers submit leave requests" },
];

const adapter: AccountAdapter = {
  async load(userId): Promise<LoadResult> {
    const { data: roleData } = await commonApi.getRole(userId);
    const role = String((roleData as { role?: string })?.role ?? "").trim().toLowerCase();
    if (role !== "admin" && role !== "super_admin") return { redirect: "/lms/redirect", fullName: "", prefs: {} };

    const { data } = await adminApi.profile.get(userId);
    const p = ((data as { profile?: unknown })?.profile ?? data) as { full_name?: string; system_alerts?: boolean; teacher_leave_requests?: boolean };
    return {
      fullName: p?.full_name || "",
      prefs: { system_alerts: p?.system_alerts ?? true, teacher_leave_requests: p?.teacher_leave_requests ?? true },
      raw: p,
    };
  },
  save: (d) => adminApi.profile.update(d),
};

export default function AdminSettings() {
  return <AccountSettings adapter={adapter} prefs={PREFS} intro="Change your name, your password and which alerts you get." />;
}

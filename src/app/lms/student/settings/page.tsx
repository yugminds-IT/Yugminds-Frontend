"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AccountSettings, { type AccountAdapter, type PrefSpec } from "@/components/portal/AccountSettings";
import { commonApi } from "@/lib/api";

const PREFS: PrefSpec[] = [
  { key: "assignment_reminders", label: "Assignment alerts", description: "New assignments, retakes and other homework news" },
  { key: "grade_notifications", label: "Grades", description: "A note when your work has been graded" },
  { key: "course_updates", label: "Course news", description: "Certificates and announcements about your courses" },
];

type Profile = {
  full_name?: string;
  students?: Array<{ schools?: Array<{ name?: string }>; grade?: string; section?: string; joining_code?: string }>;
  assignment_reminders?: boolean;
  grade_notifications?: boolean;
  course_updates?: boolean;
};

const adapter: AccountAdapter = {
  async load(userId) {
    const { data } = await commonApi.profile.get({ userId });
    const profile = ((data as { profile?: unknown })?.profile ?? data) as Profile;
    return {
      fullName: profile?.full_name || "",
      prefs: {
        assignment_reminders: profile?.assignment_reminders ?? true,
        grade_notifications: profile?.grade_notifications ?? true,
        course_updates: profile?.course_updates ?? true,
      },
      raw: profile,
    };
  },
  save: (d) => commonApi.profile.update(d),
};

function details(raw: unknown) {
  const s = (raw as Profile | null)?.students?.[0];
  const school = s?.schools?.[0]?.name;
  const section = s?.section ? s.section.replace(/^section\s*/i, "") : "";
  const gradeText = s?.grade ? `${s.grade}${section ? `, Section ${section}` : ""}` : "";
  const rows = [
    school && { label: "School", value: school },
    gradeText && { label: "Grade", value: gradeText },
    s?.joining_code && { label: "Joining code", value: s.joining_code, code: true },
  ].filter(Boolean) as Array<{ label: string; value: string; code?: boolean }>;
  return { where: [school, s?.grade ? `${s.grade}${section ? ` • Section ${section}` : ""}` : ""].filter(Boolean).join(" • "), rows };
}

function StudentSettingsInner() {
  const router = useRouter();
  const forceChange = useSearchParams().get("force_change") === "true";
  return (
    <AccountSettings
      adapter={adapter}
      prefs={PREFS}
      details={details}
      forceChange={forceChange}
      afterSave={() => {
        // After the first-login change, send them to the dashboard instead of reloading the form.
        if (!forceChange) return false;
        setTimeout(() => router.push("/lms/student"), 2000);
        return true;
      }}
    />
  );
}

export default function StudentSettings() {
  return (
    <Suspense fallback={<div className="sd-page"><div className="sd-skel" style={{ height: "14rem" }} /></div>}>
      <StudentSettingsInner />
    </Suspense>
  );
}

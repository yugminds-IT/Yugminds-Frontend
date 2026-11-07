"use client";

import AccountSettings, { type AccountAdapter, type PrefSpec } from "@/components/portal/AccountSettings";
import { commonApi } from "@/lib/api";
import { useTeacherSchool } from "../context";

const PREFS: PrefSpec[] = [
  { key: "assignment_reminders", label: "Assignment alerts", description: "New assignments, retakes and related updates" },
  { key: "grade_notifications", label: "Grades", description: "Updates when assignments are graded" },
  { key: "course_updates", label: "Course updates", description: "Certificates and course-related announcements" },
  { key: "system_alerts", label: "Schedule alerts", description: "Schedule sync and related system notices" },
];

type Profile = {
  full_name?: string;
  assignment_reminders?: boolean;
  grade_notifications?: boolean;
  course_updates?: boolean;
  system_alerts?: boolean;
};

const adapter: AccountAdapter = {
  async load(userId) {
    const { data } = await commonApi.profile.get({ userId });
    const p = ((data as { profile?: unknown })?.profile ?? data) as Profile;
    return {
      fullName: p?.full_name || "",
      prefs: {
        assignment_reminders: p?.assignment_reminders ?? true,
        grade_notifications: p?.grade_notifications ?? true,
        course_updates: p?.course_updates ?? true,
        system_alerts: p?.system_alerts ?? true,
      },
      raw: p,
    };
  },
  save: (d) => commonApi.profile.update(d),
};

/** The schools a teacher is assigned to, with the one they are working in marked. */
function SchoolAssignments() {
  const { selectedSchool, schools } = useTeacherSchool();
  return (
    <section className="sd-panel" aria-labelledby="st-schools">
      <div className="sd-panel-head"><div><h2 id="st-schools">Your schools</h2><p>The schools you are assigned to</p></div></div>
      {schools && schools.length > 0 ? (
        <div>
          {schools.map((school) => {
            const subjects = Array.isArray(school.assignment?.subjects) ? (school.assignment?.subjects as string[]) : [];
            return (
              <div key={school.id} className="st-dev" data-here={selectedSchool?.id === school.id}>
                <div className="st-dev-main">
                  <b>{school.name}{selectedSchool?.id === school.id && <span className="st-here">Working in</span>}</b>
                  {(school.city || school.state) && <small>{[school.city, school.state].filter(Boolean).join(", ")}</small>}
                  {subjects.length > 0 && <small>{subjects.join(", ")}</small>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sd-empty"><b>No schools yet</b><p>An administrator will assign you to a school.</p></div>
      )}
    </section>
  );
}

export default function TeacherSettings() {
  return <AccountSettings adapter={adapter} prefs={PREFS} intro="Change your name, your password and which alerts you get." aside={<SchoolAssignments />} />;
}

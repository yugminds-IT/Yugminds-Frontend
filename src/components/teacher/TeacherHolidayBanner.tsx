"use client";

import { CalendarOff } from "lucide-react";
import { useTeacherDayStatus } from "@/hooks/useTeacherData";

interface Props {
  selectedSchoolId: string | null;
  schools: Array<{ id: string; name: string }>;
}

/** Portal-wide notice when today is a declared Holiday/Break at the teacher's school(s). */
export default function TeacherHolidayBanner({ selectedSchoolId, schools }: Props) {
  const { data } = useTeacherDayStatus();
  const closed = (data?.schools ?? []).filter(
    (s) =>
      s.status === "holiday" &&
      (selectedSchoolId ? s.school_id === selectedSchoolId : true),
  );
  if (closed.length === 0) return null;

  const nameOf = (id: string) => schools.find((s) => s.id === id)?.name ?? "Your school";
  const allClosed = !selectedSchoolId && closed.length === schools.length;

  return (
    <div className="to-notice" role="status">
      <CalendarOff aria-hidden="true" />
      <div>
        {closed.length === 1 ? (
          <>
            <b>
              Today is a {closed[0].holiday?.type === "Break" ? "break" : "holiday"} at {nameOf(closed[0].school_id)}
              {closed[0].holiday?.name ? `: ${closed[0].holiday.name}` : ""}
            </b>
            <p>No classes are held today, so reports can&apos;t be submitted for this school.</p>
          </>
        ) : (
          <>
            <b>{allClosed ? "All your schools are closed today" : "Some of your schools are closed today"}</b>
            <ul>
              {closed.map((s) => (
                <li key={s.school_id}>
                  {nameOf(s.school_id)}
                  {s.holiday?.name ? `: ${s.holiday.name}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

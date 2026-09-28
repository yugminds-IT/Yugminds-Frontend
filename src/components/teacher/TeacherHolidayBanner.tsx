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
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <CalendarOff className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          {closed.length === 1 ? (
            <>
              <p className="font-semibold text-red-800">
                Today is a {closed[0].holiday?.type === "Break" ? "break" : "holiday"} at{" "}
                {nameOf(closed[0].school_id)}
                {closed[0].holiday?.name ? ` — ${closed[0].holiday.name}` : ""}
              </p>
              <p className="text-red-700 mt-0.5">
                No classes are held today, so reports can&apos;t be submitted for this school.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-red-800">
                {allClosed ? "All your schools are closed today" : "Some of your schools are closed today"}
              </p>
              <ul className="text-red-700 mt-1 list-disc pl-5">
                {closed.map((s) => (
                  <li key={s.school_id}>
                    {nameOf(s.school_id)}
                    {s.holiday?.name ? ` — ${s.holiday.name}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

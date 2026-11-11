"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin.api";
import { initialsOf } from "../../portal/notifications";
import { plural, type CalendarEntry } from "./utils";

interface Impact {
  schools: { id: string; name: string; teachers: number }[];
  teachers: { id: number; name: string; email: string; classes: number; schools: { id: string; name: string; classes: number }[] }[];
  without_classes: { id: number; name: string }[];
}

const HEADING: Record<CalendarEntry["type"], string> = {
  Holiday: "Teachers whose classes are cancelled",
  Break: "Teachers whose classes are cancelled",
  HalfDay: "Teachers with classes on this half day",
  CompensatoryWork: "Teachers who teach on this make-up day",
};

/** Under a calendar entry: which schools it covers and which teachers it touches. */
export default function ImpactPanel({ entries }: { entries: CalendarEntry[] }) {
  const type = entries[0].type;
  // The key includes dates and type, so editing an entry (same id) never shows the old answer.
  const key = entries.map((e) => `${e.id}:${e.date}:${e.end_date ?? ""}:${e.type}`).sort().join("|");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "calendar", "impact", key],
    queryFn: async () => (await adminApi.calendar.impact(entries.map((e) => e.id))).data as Impact,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="ac-impact"><div className="sd-skel" /></div>;
  if (isError || !data) {
    return (
      <div className="ac-impact">
        <p className="cd-fine">We could not load who is affected. <button type="button" className="ac-dayact" onClick={() => void refetch()}>Try again</button></p>
      </div>
    );
  }

  return (
    <div className="ac-impact">
      <div>
        <h4>{data.schools.length === 1 ? "School" : `Schools (${data.schools.length})`}</h4>
        <ul className="ac-chips">
          {data.schools.map((s) => (
            <li key={s.id} className="sm-chip">{s.name}<small>{s.teachers > 0 ? plural(s.teachers, "teacher") : "no classes"}</small></li>
          ))}
        </ul>
      </div>
      <div>
        <h4>{HEADING[type]} ({data.teachers.length})</h4>
        {data.teachers.length === 0 ? (
          <p className="cd-fine">No teacher has classes scheduled on {type === "Break" ? "these dates" : "this date"}.</p>
        ) : (
          <ul className="ac-people">
            {data.teachers.map((t) => (
              <li key={t.id}>
                <span className="sd-avatar" aria-hidden="true">{initialsOf(t.name)}</span>
                <span>
                  <b>{t.name}</b>
                  <small>{t.schools.map((s) => `${s.name}, ${plural(s.classes, "class", "classes")}`).join(" · ")}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
        {data.without_classes.length > 0 && (
          <p className="cd-fine">No classes then for: {data.without_classes.map((t) => t.name).join(", ")}.</p>
        )}
      </div>
    </div>
  );
}

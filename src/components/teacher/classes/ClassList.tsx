import Link from "next/link";
import { CalendarDays, FileText } from "lucide-react";
import { naturalSort, subjectHue } from "../../school-admin/schedule/utils";
import { formatGradeBadge, formatSectionLabel } from "../../school-admin/student-utils";
import { plural } from "../overview/utils";

export type ClassEntry = {
  key: string;
  grade: string;
  section: string;
  school: string;
  subjects: string[];
  periods: number;
  active: boolean;
};

/** Assigned classes, grouped by grade. Each row can write a report or jump to that class's timetable. */
export default function ClassList({ rows, onTimetable }: { rows: ClassEntry[]; onTimetable: (grade: string, section: string) => void }) {
  const grades = [...new Set(rows.map((r) => r.grade))].sort(naturalSort);
  return (
    <div>
      {grades.map((g) => {
        const list = rows.filter((r) => r.grade === g).sort((a, b) => naturalSort(a.section, b.section));
        return (
          <section key={g || "none"} aria-label={formatGradeBadge(g) || "No grade"}>
            <h3 className="as-group">{formatGradeBadge(g) || "No grade"}<span>{plural(list.length, "class", "classes")}</span></h3>
            {list.map((r) => (
              <div key={r.key} className="cl-row" data-active={r.active}>
                <span className="cl-row-name">
                  <b>{formatSectionLabel(r.section) || formatGradeBadge(r.grade) || "Class"}</b>
                  {r.school && <small>{r.school}</small>}
                </span>
                <span className="cl-row-subjects">
                  {r.subjects.length === 0 ? <small>No subject set</small> : r.subjects.map((s) => <span key={s} className="ts-tag" data-h={subjectHue(s)}>{s}</span>)}
                </span>
                <span className="cl-row-load">
                  {r.periods > 0 ? plural(r.periods, "period") + " a week" : "Not on the timetable"}
                  {!r.active && <span className="sm-chip">Inactive</span>}
                </span>
                <span className="cl-row-acts">
                  <button type="button" className="sd-btn sd-btn--line" onClick={() => onTimetable(r.grade, r.section)} disabled={r.periods === 0}><CalendarDays aria-hidden="true" />Timetable</button>
                  <Link
                    className="sd-btn sd-btn--ink"
                    href={`/lms/teacher/reports${r.grade ? `?grade=${encodeURIComponent(r.grade)}${r.section ? `&section=${encodeURIComponent(r.section)}` : ""}` : ""}`}
                  ><FileText aria-hidden="true" />Report</Link>
                </span>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

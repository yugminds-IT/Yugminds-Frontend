import { ChevronRight } from "lucide-react";
import { ago } from "../../portal/notifications";
import { gradeLabel, plural, STAGE_LABEL, type Row } from "./utils";

const COURSE_LABEL: Record<string, string> = { completed: "Finished", in_progress: "In progress", not_started: "Not started" };

/** The class a student sits in, e.g. "Grade 8 · B". */
const classOf = (r: Row) => [gradeLabel(r.grade), r.section ? `Section ${r.section}` : ""].filter(Boolean).join(" · ") || "No class yet";

/** One page of students. A row opens to show the student's courses, chapter by chapter. */
export default function StudentsTab({
  rows,
  now,
  openId,
  onOpen,
}: {
  rows: Row[];
  now: number;
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  return (
    <section className="sd-panel ps-list mc-swap" aria-label="Students">
      <div className="ps-head" aria-hidden="true">
        <span>Student</span>
        <span>School</span>
        <span>Learning</span>
        <span>Progress</span>
        <span>Last active</span>
        <span />
      </div>
      {rows.map((r) => {
        const open = openId === r.id;
        return (
          <div key={r.id} className="ps-item" data-open={open}>
            <button type="button" className="ps-row" aria-expanded={open} aria-controls={`ps-d-${r.id}`} onClick={() => onOpen(open ? null : r.id)}>
              <span className="ps-who"><b>{r.name}</b><small>{r.email}</small></span>
              <span className="ps-school"><b>{r.school || "No school"}</b><small>{classOf(r)}</small></span>
              <span className="ps-stage">
                <span className="sm-chip" data-on={r.stage === "going" ? "true" : undefined} data-class={r.stage === "done" ? "true" : undefined} data-s={r.stage}>{STAGE_LABEL[r.stage]}</span>
                <small>{r.courses.length === 0 ? "Not enrolled" : `${r.done} of ${plural(r.courses.length, "course")} finished`}</small>
              </span>
              <span className="ps-prog">
                <span className="sd-meter" role="img" aria-label={`${r.progress}% progress`}><i style={{ "--p": `${r.progress}%` } as React.CSSProperties} /></span>
                <b>{r.progress}%</b>
              </span>
              <span className="ps-seen">{r.last ? ago(r.last, now) : <small>Never</small>}</span>
              <ChevronRight className="ps-chev" aria-hidden="true" />
            </button>
            {open && (
              <div id={`ps-d-${r.id}`} className="ps-detail">
                {r.courses.length === 0 ? (
                  <p className="ps-none">{r.name} is not enrolled in any course yet. Courses are assigned from a school&apos;s course settings.</p>
                ) : (
                  <ul>
                    {r.courses.map((c) => (
                      <li key={c.course_id}>
                        <span className="ps-cname"><b>{c.course_name || "Untitled course"}</b><small>{c.completed_chapters} of {plural(c.total_chapters, "chapter")} done</small></span>
                        <span className="ps-prog">
                          <span className="sd-meter" role="img" aria-label={`${Math.round(c.progress_percentage)}% progress`}><i style={{ "--p": `${Math.round(c.progress_percentage)}%` } as React.CSSProperties} /></span>
                          <b>{Math.round(c.progress_percentage)}%</b>
                        </span>
                        <span className="ps-cstate">
                          <span className="sm-chip" data-on={c.status === "in_progress" ? "true" : undefined} data-class={c.status === "completed" ? "true" : undefined} data-s={c.status}>{COURSE_LABEL[c.status] ?? c.status}</span>
                          <small>{c.last_accessed ? `Opened ${ago(c.last_accessed, now)}` : "Not opened yet"}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

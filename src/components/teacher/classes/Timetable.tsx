import Link from "next/link";
import { subjectHue } from "../../school-admin/schedule/utils";
import { classLabel, clock, plural, toMin } from "../overview/utils";
import { periodIdOf, roomOf, startOf, endOf, spanLabel, type Period, type Sched } from "./utils";

/** One class in the grid or the day list. Today's classes open their report form. */
export function ClassCard({ s, today, live, showSchool }: { s: Sched; today: boolean; live: boolean; showSchool: boolean }) {
  const meta = [roomOf(s), showSchool ? s.school?.name : null].filter(Boolean).join(" · ");
  const id = periodIdOf(s);
  const body = (
    <>
      <b>{s.subject || "Class"}</b>
      <span>{classLabel(s.grade, s.section) || "No grade"}</span>
      {meta && <small>{meta}</small>}
    </>
  );
  return (
    <div className="ts-card cl-card" data-h={subjectHue(s.subject)} data-live={live}>
      {today && id ? (
        <Link href={`/lms/teacher/reports?period_id=${id}`} className="cl-body" title="Write the report for this class">{body}</Link>
      ) : (
        <div className="cl-body">{body}</div>
      )}
    </div>
  );
}

/** Whether a class is running right now, for the highlight. */
export const isLive = (s: Sched, isToday: boolean, nowMin: number) => {
  if (!isToday) return false;
  const a = toMin(startOf(s));
  const b = toMin(endOf(s));
  return Number.isFinite(a) && nowMin >= a && (Number.isFinite(b) ? nowMin < b : nowMin < a + 40);
};

/** Read-only week grid: a row per period, a column per day. Wide screens only; phones get the day list. */
export default function Timetable({
  periods,
  days,
  cell,
  today,
  nowMin,
  showSchool,
}: {
  periods: Period[];
  days: string[];
  cell: (day: string, periodKey: string) => Sched[];
  today: string;
  nowMin: number;
  showSchool: boolean;
}) {
  return (
    <div className="ts-scroll">
      <table data-no-stack className="ts-grid" style={{ "--cols": days.length } as React.CSSProperties}>
        <caption className="sr-only">Your weekly timetable</caption>
        <thead>
          <tr>
            <th scope="col" className="ts-corner">Period</th>
            {days.map((d) => (
              <th key={d} scope="col" data-today={d === today}>
                <span className="ts-dayname">{d}</span>
                {d === today && <small><span className="sm-chip" data-on="true">Today</span></small>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.key}>
              <th scope="row" className="ts-period">
                <b>{p.no ? `Period ${p.no}` : clock(toMin(p.start))}</b>
                <small>{p.no ? spanLabel(p.start, p.end) : p.end ? `to ${clock(toMin(p.end))}` : ""}</small>
              </th>
              {days.map((d) => {
                const items = cell(d, p.key);
                return (
                  <td key={d} data-today={d === today}>
                    <div className="ts-cell">
                      {items.map((s) => <ClassCard key={s.id} s={s} today={d === today} live={isLive(s, d === today, nowMin)} showSchool={showSchool} />)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The same classes as a list grouped by day. Phones use this instead of the grid. */
export function Agenda({
  days,
  rows,
  today,
  nowMin,
  showSchool,
}: {
  days: string[];
  rows: (day: string) => Sched[];
  today: string;
  nowMin: number;
  showSchool: boolean;
}) {
  return (
    <div>
      {days.map((d) => {
        const list = rows(d);
        if (list.length === 0) return null;
        return (
          <section key={d} aria-label={d}>
            <h3 className="as-group">
              {d}
              <span>{plural(list.length, "period")}</span>
              {d === today && <span className="sm-chip" data-on="true">Today</span>}
            </h3>
            {list.map((s) => (
              <div key={s.id} className="cl-ag">
                <span className="cl-ag-time">{clock(toMin(startOf(s)))}{endOf(s) && <small>to {clock(toMin(endOf(s)))}</small>}</span>
                <ClassCard s={s} today={d === today} live={isLive(s, d === today, nowMin)} showSchool={showSchool} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

import { dayStatus, monthDate, STATUS_LABEL, type DayRecord, type DayStatus } from "./utils";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KEY: DayStatus[] = ["present", "absent", "leave", "unreported"];

/** One month, a cell per day coloured by how that day was marked. Days without a record are school-off days. */
export default function MonthGrid({ ym, records, todayKey }: { ym: string; records: DayRecord[]; todayKey: string }) {
  const first = monthDate(ym);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const byDate = new Map(records.map((r) => [r.date, r]));
  return (
    <div>
      <div className="at-dow" aria-hidden="true">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
      <ol className="at-grid" aria-label="Day by day">
        {Array.from({ length: lead }, (_, i) => <li key={`b${i}`} aria-hidden="true" />)}
        {Array.from({ length: count }, (_, i) => {
          const d = i + 1;
          const date = `${ym}-${String(d).padStart(2, "0")}`;
          const rec = byDate.get(date);
          const st = dayStatus(rec?.status);
          const label = new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
          return (
            <li key={date} className="at-day" data-s={st ?? "none"} data-today={date === todayKey} aria-label={`${label}: ${st ? STATUS_LABEL[st] : "no record"}`} title={`${label}: ${st ? STATUS_LABEL[st] : "no record"}`}>
              {d}
            </li>
          );
        })}
      </ol>
      <p className="at-key">
        {KEY.map((k) => <span key={k}><i data-s={k} />{STATUS_LABEL[k]}</span>)}
      </p>
    </div>
  );
}

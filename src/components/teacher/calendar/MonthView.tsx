import { dayInfo, KIND_LABEL, TYPE_LABEL, ymd, longDate, rangeLabel, type CalendarEntry, type DayInfo, type Index } from "./utils";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid. Each day is tinted by what it is for you, and holds the names of what is happening. */
export function MonthGrid({
  year,
  month,
  index,
  today,
  selected,
  onSelect,
  schoolIdx,
  multi,
}: {
  year: number;
  month: number; // 1-12
  index: Index;
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  schoolIdx: Map<string, number>;
  multi: boolean;
}) {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  return (
    <div>
      <div className="cd-dow" aria-hidden="true">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
      <ol className="cd-grid">
        {Array.from({ length: lead }, (_, i) => <li key={`b${i}`} aria-hidden="true" />)}
        {Array.from({ length: count }, (_, i) => {
          const date = ymd(new Date(year, month - 1, i + 1));
          const info = dayInfo(index, date);
          const first = info.entries[0];
          return (
            <li key={date}>
              <button
                type="button"
                className="cd-day"
                data-k={info.kind}
                data-today={date === today}
                aria-pressed={date === selected}
                aria-label={`${longDate(date)}: ${KIND_LABEL[info.kind]}${info.entries.length ? `, ${info.entries.map((e) => e.name).join(", ")}` : ""}`}
                onClick={() => onSelect(date)}
              >
                <b>{i + 1}</b>
                {info.entries.length > 0 && <small>{first.name}{info.entries.length > 1 ? ` +${info.entries.length - 1}` : ""}</small>}
                <span className="cd-marks" aria-hidden="true">
                  {info.entries.slice(0, 3).map((e) => <i key={e.id + e.school_id} data-t={e.type} />)}
                  {multi && info.scheduled.map((s) => <em key={s.school_id} data-sc={(schoolIdx.get(s.school_id) ?? 0) % 6} />)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="cd-key">
        <span><i data-k="work" />Teaching day</span>
        <span><i data-k="closed" />Holiday or break</span>
        <span><i data-k="half" />Half day</span>
        <span><i data-k="comp" />Make-up day</span>
        <span><i data-k="off" />Weekly off</span>
      </p>
    </div>
  );
}

/** What one day means for you: where you teach, and everything on the school calendar that day. */
export function DayDetail({ date, info, schoolIdx, multi }: { date: string; info: DayInfo; schoolIdx: Map<string, number>; multi: boolean }) {
  const closed = info.closedAt.length > 0;
  return (
    <div className="cd-detail" aria-live="polite">
      <div className="cd-detail-head">
        <h3>{longDate(date)}</h3>
        <span className="cd-chip" data-k={info.kind}>{KIND_LABEL[info.kind]}</span>
      </div>
      {info.scheduled.length > 0 && (
        <p className="cd-where">
          You are scheduled at{" "}
          {info.scheduled.map((s, i) => (
            <span key={s.school_id}>
              {i > 0 && ", "}
              {multi && <em data-sc={(schoolIdx.get(s.school_id) ?? 0) % 6} />}
              <b>{s.school_name || "your school"}</b>
            </span>
          ))}
          .
          {closed ? (info.kind === "closed" ? " It is closed there." : ` Closed at ${[...new Set(info.closedAt.map((c) => c.school_name))].join(" and ")}.`) : ""}
        </p>
      )}
      {info.scheduled.length === 0 && info.kind === "off" && <p className="cd-where">You do not teach on this day.</p>}
      {info.kind === "unassigned" && <p className="cd-where">You were not assigned to a school yet on this date.</p>}
      {info.entries.length > 0 ? (
        <ul className="cd-events">
          {info.entries.map((e) => <EventRow key={e.id + e.school_id} e={e} multi={multi} />)}
        </ul>
      ) : (
        info.kind !== "unassigned" && <p className="cd-fine">Nothing special on the school calendar.</p>
      )}
    </div>
  );
}

export function EventRow({ e, multi }: { e: CalendarEntry; multi: boolean }) {
  return (
    <li className="cd-event">
      <span className="cd-event-date">{rangeLabel(e)}</span>
      <span className="cd-event-main">
        <b>{e.name}</b>
        <small>{[multi ? e.school_name : null, e.description].filter(Boolean).join(" · ")}</small>
      </span>
      <span className="cd-chip" data-t={e.type}>{TYPE_LABEL[e.type]}</span>
    </li>
  );
}

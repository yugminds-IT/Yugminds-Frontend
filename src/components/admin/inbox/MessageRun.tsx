import Droid from "../../portal/Droid";
import { FLOW, STATUS_LABEL, type Counts, type Status } from "./utils";

/**
 * A message's journey: new, read, replied, archived. The droid waits at the first stop that has messages
 * waiting (new, then read), or at the stop you filtered to. Pressing a stop filters the list;
 * pressing it again clears the filter.
 */
export default function MessageRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Counts;
  selected: Status | null;
  onSelect: (s: Status | null) => void;
  caption: React.ReactNode;
}) {
  const n = FLOW.length;
  const total = FLOW.reduce((sum, s) => sum + counts[s], 0);
  const firstTodo = counts.new > 0 ? 0 : counts.read > 0 ? 1 : counts.replied > 0 ? 2 : 0;
  const at = selected ? FLOW.indexOf(selected) : firstTodo;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Messages by status">
          {FLOW.map((s) => (
            <li key={s} className="sd-day" data-active={s === "replied" && counts[s] > 0} data-late={(s === "new" || s === "read") && counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0 || s === "archived"}>
              <button type="button" className="tm-node" aria-pressed={selected === s} aria-label={`${STATUS_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "message" : "messages"}`} onClick={() => onSelect(selected === s ? null : s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{STATUS_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "message" : "messages"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show all messages</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}

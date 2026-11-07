import { Check } from "lucide-react";
import Droid from "./Droid";

const MAX_NODES = 12;

/** Any run of steps as a track of nodes (chapters, modules, lessons). The droid rolls to the step you are on when the page loads. */
export default function ProgressRail({ total, completed }: { total: number; completed: number }) {
  const n = Math.min(total, MAX_NODES);
  const exact = total <= MAX_NODES;
  const allDone = completed >= total;
  const done = allDone ? n : exact ? completed : Math.round((completed / total) * n);
  const cur = allDone ? n - 1 : Math.min(done, n - 1);
  const fill = n > 1 ? Math.max(0, Math.min(done, n) - 1) / (n - 1) : 0;
  return (
    <div className="sd-run" style={{ "--n": n, "--p": (cur + 0.5) / n, "--spin": `${(cur + 0.5) * 520}deg` } as React.CSSProperties}>
      <div className="sd-droid"><Droid /></div>
      <div className="sd-run-line" />
      {done > 1 && <div className="sd-run-fill" style={{ "--f": fill } as React.CSSProperties} />}
      <ol className="sd-days" aria-label={`${completed} of ${total} chapters done`}>
        {Array.from({ length: n }, (_, i) => (
          <li key={i} className="sd-day" data-active={i < done} data-today={!allDone && i === cur} data-future={i > cur}>
            <span className="sd-node">{i < done && <Check />}</span>
            {exact && <span>{i + 1}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

import Droid from "../../portal/Droid";

export type SetupStep = { id: string; label: string; done: boolean; detail: string };

/**
 * Getting one school ready is a sequence: a school admin, joining codes, teachers, students. Each step fills
 * once it is done, and the droid waits at the first one that is not.
 */
export default function SetupRun({ steps, caption }: { steps: SetupStep[]; caption: string }) {
  const n = steps.length;
  const first = steps.findIndex((s) => !s.done);
  const at = first < 0 ? n - 1 : first;
  const done = steps.filter((s) => s.done).length;
  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Setting up this school">
          {steps.map((s, i) => (
            <li key={s.id} className="sd-day" data-active={s.done} data-today={i === first} data-future={!s.done && i !== first}>
              <span className="sc-step" aria-label={`${s.label}: ${s.done ? "done" : "not yet"}. ${s.detail}`}>
                <span className="sd-node">{s.done ? "✓" : i + 1}</span>
                <span>{s.label}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{done}<small>of {n} steps done</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

/* A short vertical process on the navy panel. With `auto`, a highlight walks down the steps on a loop to preview the
   process; otherwise `stage` says how far along the person is (steps before it are done, that one is active). Reduced
   motion never walks. */
export default function AuthSteps({
  steps,
  stage = 0,
  auto = false,
  label,
}: {
  steps: { name: string; text: string }[];
  stage?: number;
  auto?: boolean;
  label: string;
}) {
  const [walk, setWalk] = useState(0);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setWalk((w) => (w + 1) % (steps.length + 1)), walk === steps.length ? 2200 : 1800);
    return () => clearTimeout(id);
  }, [auto, walk, steps.length]);

  const cur = auto ? walk : stage;
  return (
    <ol className="au-steps" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.name} data-state={i < cur ? "done" : i === cur ? "active" : "todo"}>
          <span>{i < cur ? <Check size={16} aria-hidden="true" /> : i + 1}</span>
          <div>
            <b>{s.name}</b>
            <p>{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

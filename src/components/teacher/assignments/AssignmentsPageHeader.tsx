"use client";

import type { AssignmentsTab } from "./assignments-shared";

type Props = {
  tab: AssignmentsTab;
  onTabChange: (tab: AssignmentsTab) => void;
  pendingRetakeCount: number;
};

const TABS: Array<{ key: AssignmentsTab; label: string }> = [
  { key: "daily", label: "Daily" },
  { key: "course", label: "Course" },
  { key: "requests", label: "Retake requests" },
  { key: "analytics", label: "Analytics" },
];

/** The four views of the assignments page. The page's own hero carries the title and the new-assignment button. */
export default function AssignmentsPageHeader({ tab, onTabChange, pendingRetakeCount }: Props) {
  return (
    <div className="tg-tabs">
      <div className="mc-tabs" role="tablist" aria-label="Assignment views">
        {TABS.map(({ key, label }) => (
          <button key={key} type="button" role="tab" id={`tg-tab-${key}`} aria-selected={tab === key} aria-controls="tg-panel" className="mc-tab" onClick={() => onTabChange(key)}>
            {label}
            {key === "requests" && pendingRetakeCount > 0 && <span className="tg-dot">{pendingRetakeCount}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

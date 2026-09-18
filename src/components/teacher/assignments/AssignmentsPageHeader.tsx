"use client";

import { Plus, ClipboardList, BookOpen, RotateCcw, BarChart2 } from "lucide-react";
import type { AssignmentsTab } from "./assignments-shared";

type Props = {
  tab: AssignmentsTab;
  onTabChange: (tab: AssignmentsTab) => void;
  pendingRetakeCount: number;
  onNewAssignment: () => void;
};

const TABS: Array<{
  key: AssignmentsTab;
  label: string;
  icon: typeof ClipboardList;
}> = [
  { key: "daily", label: "Daily", icon: ClipboardList },
  { key: "course", label: "Course", icon: BookOpen },
  { key: "requests", label: "Retake Requests", icon: RotateCcw },
  { key: "analytics", label: "Analytics", icon: BarChart2 },
];

export default function AssignmentsPageHeader({
  tab,
  onTabChange,
  pendingRetakeCount,
  onNewAssignment,
}: Props) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Assignments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, grade, and track student work
          </p>
        </div>
        {tab === "daily" && (
          <button
            type="button"
            onClick={onNewAssignment}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Assignment
          </button>
        )}
      </div>

      <div className="px-6 flex items-center gap-1 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {key === "requests" && pendingRetakeCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                  {pendingRetakeCount}
                </span>
              )}
              {active && (
                <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

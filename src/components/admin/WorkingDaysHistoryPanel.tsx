"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, History } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import { formatWorkingDays } from "@/lib/weekday-utils";

interface HistoryEntry {
  effective_from: string;
  working_days: number[];
}

function formatDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Read-only, collapsible list of dated working-days changes for one
 * teacher+school — lets an admin verify a mid-month change actually landed
 * on the date they picked. Corrections are made by saving a new "Effective
 * from" date on the assignment above, not by editing history entries here.
 */
export default function WorkingDaysHistoryPanel({
  teacherId,
  schoolId,
}: {
  teacherId: string;
  schoolId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const { data } = await adminApi.teachers.workingDaysHistory(teacherId, schoolId);
        setEntries(((data as { history?: HistoryEntry[] })?.history ?? []) as HistoryEntry[]);
        setLoaded(true);
      } catch {
        // Non-fatal — the panel just stays empty.
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <History className="h-3 w-3" />
        Working days history
      </button>
      {expanded && (
        <div className="mt-1.5 pl-4 border-l-2 border-gray-100 space-y-1">
          {loading ? (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-gray-400">No history yet.</p>
          ) : (
            entries.map((e, i) => (
              <p key={`${e.effective_from}-${i}`} className="text-xs text-gray-600">
                <span className="font-medium">{formatWorkingDays(e.working_days)}</span>
                {" — since "}
                {formatDate(e.effective_from)}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}

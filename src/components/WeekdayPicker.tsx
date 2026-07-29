"use client";

import { Button } from "./ui/button";
import { WEEKDAY_LABELS, WEEKDAY_DISPLAY_ORDER } from "@/lib/weekday-utils";

/**
 * Toggle-button row for picking which weekdays (0=Sun..6=Sat) a teacher
 * works at a given school. Shared between AddTeacherDialog and the admin
 * teachers page edit dialog so both stay visually/behaviorally identical.
 */
export default function WeekdayPicker({
  value,
  onChange,
  idPrefix,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  idPrefix?: string;
}) {
  const toggle = (day: number) => {
    const next = value.includes(day)
      ? value.filter((d) => d !== day)
      : [...value, day];
    onChange(next.sort((a, b) => a - b));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_DISPLAY_ORDER.map((day) => {
          const active = value.includes(day);
          return (
            <Button
              key={day}
              type="button"
              id={idPrefix ? `${idPrefix}_${day}` : undefined}
              variant={active ? "default" : "outline"}
              size="sm"
              className={`h-8 w-12 px-0 text-xs ${active ? "" : "text-gray-500"}`}
              onClick={() => toggle(day)}
            >
              {WEEKDAY_LABELS[day]}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-1.5">
        {value.length} day{value.length !== 1 ? "s" : ""}/week
        {value.includes(0) && (
          <span className="text-amber-600"> · Sunday only counts if the school has a compensatory work day declared for it</span>
        )}
      </p>
    </div>
  );
}

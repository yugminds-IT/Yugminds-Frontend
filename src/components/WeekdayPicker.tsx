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
  allowedDays,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  idPrefix?: string;
  /** When set, days not in this list render disabled/muted — e.g. a school's own operatingDays constraining a teacher's working-day picker. */
  allowedDays?: number[];
}) {
  const toggle = (day: number) => {
    if (allowedDays && !allowedDays.includes(day)) return;
    const next = value.includes(day)
      ? value.filter((d) => d !== day)
      : [...value, day];
    onChange(next.sort((a, b) => a - b));
  };

  const disallowedSelected = allowedDays
    ? value.filter((d) => !allowedDays.includes(d))
    : [];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_DISPLAY_ORDER.map((day) => {
          const active = value.includes(day);
          const disabled = allowedDays ? !allowedDays.includes(day) : false;
          return (
            <Button
              key={day}
              type="button"
              id={idPrefix ? `${idPrefix}_${day}` : undefined}
              variant={active ? "default" : "outline"}
              size="sm"
              disabled={disabled}
              title={disabled ? "This school doesn't operate on this day" : undefined}
              className={`h-8 w-12 px-0 text-xs ${active ? "" : "text-gray-500"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
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
      {disallowedSelected.length > 0 && (
        <p className="text-xs text-red-500 mt-1">
          {disallowedSelected.map((d) => WEEKDAY_LABELS[d]).join(", ")} {disallowedSelected.length > 1 ? "aren't" : "isn't"} a day this school operates on — remove {disallowedSelected.length > 1 ? "them" : "it"} before saving.
        </p>
      )}
    </div>
  );
}

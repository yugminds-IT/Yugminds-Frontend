"use client";

import { Button } from "./ui/button";
import { WEEKDAY_LABELS, WEEKDAY_DISPLAY_ORDER } from "@/lib/weekday-utils";

export type DaySlotInput = { slot: "MORNING" | "AFTERNOON"; start: string; end: string };
export type DaySlotsInput = Record<string, DaySlotInput>;

const SLOT_DEFAULTS = { MORNING: ["08:00", "12:30"], AFTERNOON: ["12:30", "17:00"] } as const;

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
  slots,
  onSlotsChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  idPrefix?: string;
  /** When set, days not in this list render disabled/muted — e.g. a school's own operatingDays constraining a teacher's working-day picker. */
  allowedDays?: number[];
  /** Teacher assignments only: per-weekday half-day windows (a day not listed is a full day). Omit onSlotsChange to hide the editor. */
  slots?: DaySlotsInput | null;
  onSlotsChange?: (slots: DaySlotsInput) => void;
}) {
  const setDaySlot = (day: number, kind: "FULL" | "MORNING" | "AFTERNOON", patch?: Partial<DaySlotInput>) => {
    const next = { ...(slots ?? {}) };
    if (kind === "FULL") delete next[String(day)];
    else {
      const prev = next[String(day)];
      const [start, end] = prev && prev.slot === kind ? [prev.start, prev.end] : SLOT_DEFAULTS[kind];
      next[String(day)] = { slot: kind, start, end, ...patch };
    }
    onSlotsChange?.(next);
  };
  const halfCount = Object.keys(slots ?? {}).filter((d) => value.includes(Number(d))).length;
  const effectiveDays = value.length - halfCount / 2;

  const toggle = (day: number) => {
    const isSelected = value.includes(day);
    // A disallowed day can still be REMOVED (that's how a stale/legacy
    // assignment — created before the school's operating days were
    // restricted — gets fixed). Only block ADDING a new disallowed day.
    if (allowedDays && !allowedDays.includes(day) && !isSelected) return;
    const next = isSelected
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
          // Never disable an already-selected day — it must stay clickable
          // so a stale/legacy assignment can be corrected by removing it.
          const disabled = allowedDays ? !allowedDays.includes(day) && !active : false;
          return (
            <Button
              key={day}
              type="button"
              id={idPrefix ? `${idPrefix}_${day}` : undefined}
              variant={active ? "default" : "outline"}
              size="sm"
              disabled={disabled}
              title={disabled ? "This school doesn't operate on this day" : undefined}
              className={`h-8 w-14 px-0 text-xs ${active ? "" : "text-gray-500"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              onClick={() => toggle(day)}
            >
              {WEEKDAY_LABELS[day]}
              {active && slots?.[String(day)] && (
                <span className="ml-0.5 text-[9px] font-semibold opacity-80">
                  {slots[String(day)].slot === "MORNING" ? "AM" : "PM"}
                </span>
              )}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-1.5">
        {effectiveDays} day{effectiveDays !== 1 ? "s" : ""}/week{halfCount > 0 && ` (${halfCount} half-day${halfCount > 1 ? "s" : ""})`}
        {value.includes(0) && (
          <span className="text-amber-600"> · Sunday only counts if the school has a compensatory work day declared for it</span>
        )}
      </p>
      {onSlotsChange && value.length > 0 && (
        <details className="mt-2 rounded-md border border-gray-200 px-3 py-2" open={halfCount > 0}>
          <summary className="cursor-pointer text-xs text-gray-600">
            Half-day slots{halfCount > 0 ? ` (${halfCount})` : ""} — for a teacher who splits a day between two schools
          </summary>
          <div className="mt-2 space-y-1.5">
            {WEEKDAY_DISPLAY_ORDER.filter((d) => value.includes(d)).map((day) => {
              const cur = slots?.[String(day)];
              return (
                <div key={day} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="w-9 font-medium">{WEEKDAY_LABELS[day]}</span>
                  <select
                    className="h-8 rounded-md border border-gray-300 bg-white px-2"
                    value={cur?.slot ?? "FULL"}
                    onChange={(e) => setDaySlot(day, e.target.value as "FULL" | "MORNING" | "AFTERNOON")}
                  >
                    <option value="FULL">Full day</option>
                    <option value="MORNING">Morning half</option>
                    <option value="AFTERNOON">Afternoon half</option>
                  </select>
                  {cur && (
                    <>
                      <input type="time" className="h-8 rounded-md border border-gray-300 px-2" value={cur.start}
                        onChange={(e) => setDaySlot(day, cur.slot, { start: e.target.value })} />
                      <span>to</span>
                      <input type="time" className="h-8 rounded-md border border-gray-300 px-2" value={cur.end}
                        onChange={(e) => setDaySlot(day, cur.slot, { end: e.target.value })} />
                    </>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-gray-400">
              Counts as half a working day here. Pair a morning half at one school with an afternoon half at the other; class periods can only be scheduled inside this window.
            </p>
          </div>
        </details>
      )}
      {disallowedSelected.length > 0 && (
        <p className="text-xs text-red-500 mt-1">
          {disallowedSelected.map((d) => WEEKDAY_LABELS[d]).join(", ")} {disallowedSelected.length > 1 ? "aren't" : "isn't"} a day this school operates on — remove {disallowedSelected.length > 1 ? "them" : "it"} before saving.
        </p>
      )}
    </div>
  );
}

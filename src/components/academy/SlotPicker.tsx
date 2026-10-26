"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { academy } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";

const IST = "Asia/Kolkata";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
export const whenLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: IST, dateStyle: "medium", timeStyle: "short" });

/**
 * Tutor's open slots grouped by day (IST). With `onBook` the learner can book;
 * without it the picker is a read-only preview.
 */
export function SlotPicker({
  tutorId,
  minutes,
  onBook,
}: {
  tutorId: string;
  minutes: number;
  onBook?: (startsAt: string) => Promise<void>;
}) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    academy.catalog
      .slots(tutorId, minutes)
      .then((data) => {
        if (!live) return;
        setSlots(data);
        setDay(data.length ? dayKey(data[0]) : null);
      })
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [tutorId, minutes]);

  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slots ?? []) map.set(dayKey(s), [...(map.get(dayKey(s)) ?? []), s]);
    return [...map.entries()];
  }, [slots]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!slots) return <Loader2 className="h-5 w-5 animate-spin text-ac-brand" />;
  if (slots.length === 0) {
    return <p className="text-sm text-ac-muted">No open slots in the next two weeks. Please check back soon.</p>;
  }

  const book = async () => {
    if (!picked || !onBook) return;
    setBusy(true);
    setError("");
    try {
      await onBook(picked);
      setSlots((s) => s?.filter((x) => x !== picked) ?? null);
      setPicked(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map(([key, list]) => (
          <button
            key={key}
            onClick={() => { setDay(key); setPicked(null); }}
            className={`shrink-0 rounded-xl border px-3 py-2 text-sm ${day === key ? "border-ac-brand bg-ac-soft font-semibold text-ac-brand" : "border-slate-200 hover:border-ac-brand"}`}
          >
            {dayLabel(list[0])}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {days.find(([k]) => k === day)?.[1].map((s) => (
          <button
            key={s}
            disabled={!onBook}
            onClick={() => setPicked(s)}
            className={`rounded-lg border px-2 py-2 text-sm ${picked === s ? "border-ac-brand bg-ac-brand text-white" : "border-slate-200 enabled:hover:border-ac-brand disabled:cursor-default"}`}
          >
            {timeLabel(s)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ac-muted">{minutes}-minute classes, times shown in IST</p>
      {onBook && (
        <button
          onClick={book}
          disabled={!picked || busy}
          className="mt-4 w-full rounded-lg bg-ac-brand px-6 py-3 font-semibold text-white hover:bg-ac-brand-dark disabled:opacity-50"
        >
          {busy ? "Booking…" : picked ? `Book ${whenLabel(picked)}` : "Pick a time"}
        </button>
      )}
    </div>
  );
}

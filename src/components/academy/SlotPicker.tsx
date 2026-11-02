"use client";

import { useEffect, useMemo, useState } from "react";
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

  if (error && !slots) return <p className="ac-note" data-tone="error" role="alert">{error}</p>;
  if (!slots) return <span className="ac-spin" role="status" aria-label="Loading open times" />;
  if (slots.length === 0) {
    return <p className="ac-note">No open times in the next two weeks. Check back soon.</p>;
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
    <div className="ac-slots">
      <div className="ac-days" role="group" aria-label="Pick a day">
        {days.map(([key, list]) => (
          <button key={key} type="button" aria-pressed={day === key} onClick={() => { setDay(key); setPicked(null); }}>
            {dayLabel(list[0])}
          </button>
        ))}
      </div>
      <div className="ac-times" role="group" aria-label="Pick a time">
        {days.find(([k]) => k === day)?.[1].map((s) => (
          <button key={s} type="button" disabled={!onBook} aria-pressed={picked === s} onClick={() => setPicked(s)}>
            {timeLabel(s)}
          </button>
        ))}
      </div>
      <p className="ac-hint">{minutes}-minute classes, times shown in IST</p>
      {error && <p className="ac-note" data-tone="error" role="alert">{error}</p>}
      {onBook && (
        <button type="button" onClick={book} disabled={!picked || busy} className="rh-btn rh-btn--primary" style={{ width: "100%" }}>
          {busy ? "Booking…" : picked ? `Book ${whenLabel(picked)}` : "Pick a time"}
        </button>
      )}
    </div>
  );
}

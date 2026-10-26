"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { academy, type AvailabilityWindow } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TutorSchedulePage() {
  const [windows, setWindows] = useState<AvailabilityWindow[] | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    academy.tutor.me().then((t) => setWindows(t.availability)).catch((e) => setMsg(errorText(e)));
  }, []);

  const update = (i: number, patch: Partial<AvailabilityWindow>) =>
    setWindows((w) => w!.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setMsg("");
    try {
      const data = await academy.tutor.setAvailability(windows ?? []);
      setWindows(data);
      setMsg("Saved — learners can now book these times.");
    } catch (e) {
      setMsg(errorText(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <PageHeader title="Weekly availability" subtitle="Times are in IST. Learners can book from 12 hours ahead, up to two weeks out." />
      {windows === null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="space-y-6">
          {DAYS.map((name, day) => (
            <div key={day} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{name}</p>
                <button
                  onClick={() => setWindows([...windows, { dayOfWeek: day, startTime: "16:00", endTime: "19:00" }])}
                  className="flex items-center gap-1 text-sm font-medium text-ac-brand hover:underline"
                >
                  <Plus className="h-4 w-4" /> Add hours
                </button>
              </div>
              {windows.map((w, i) =>
                w.dayOfWeek === day ? (
                  <div key={i} className="mt-3 flex items-center gap-2">
                    <input type="time" value={w.startTime} onChange={(e) => update(i, { startTime: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" aria-label={`${name} start`} />
                    <span className="text-sm text-ac-muted">to</span>
                    <input type="time" value={w.endTime} onChange={(e) => update(i, { endTime: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" aria-label={`${name} end`} />
                    <button onClick={() => setWindows(windows.filter((_, j) => j !== i))} className="ml-auto rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null,
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button onClick={save} className="rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark">Save availability</button>
            {msg && <span className="text-sm text-ac-muted">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

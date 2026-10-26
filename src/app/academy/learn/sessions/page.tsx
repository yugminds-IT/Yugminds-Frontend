"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Video } from "lucide-react";
import { academy, type Booking, type Credit } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { whenLabel } from "@/components/academy/SlotPicker";
import { confirmDialog } from "@/components/ui/confirm-dialog";

const JOIN_EARLY_MS = 10 * 60_000;
const STATUS: Record<string, string> = {
  CONFIRMED: "bg-blue-50 text-ac-brand",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  NO_SHOW: "bg-amber-50 text-amber-700",
};

export default function LearnerSessionsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    academy.me.bookings().then(setBookings).catch((e) => setError(errorText(e)));
    academy.me.credits().then(setCredits).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const cancel = async (b: Booking) => {
    const freeCancel = new Date(b.startsAt).getTime() - now >= 24 * 3_600_000;
    const ok = await confirmDialog({
      title: "Cancel this class?",
      description: freeCancel
        ? "Your class credit will be returned so you can book another time."
        : "This class starts in less than 24 hours, so the credit will NOT be returned.",
      confirmText: "Cancel class",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await academy.me.cancel(b.id);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const remaining = credits.reduce((n, c) => n + c.remaining, 0);
  const upcoming = (bookings ?? []).filter((b) => b.status === "CONFIRMED" && new Date(b.endsAt).getTime() > now).reverse();
  const past = (bookings ?? []).filter((b) => !upcoming.includes(b));

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <PageHeader
        title="1:1 classes"
        subtitle={`${remaining} class credit${remaining === 1 ? "" : "s"} left`}
        action={
          <Link href={remaining ? "/academy/tutors" : "/academy/courses"} className="rounded-lg bg-ac-brand px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-ac-brand-dark">
            {remaining ? "Book a class" : "Buy a class pack"}
          </Link>
        }
      />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <h2 className="font-bold">Upcoming</h2>
      {bookings && upcoming.length === 0 && <p className="mt-2 text-sm text-ac-muted">No upcoming classes.</p>}
      <ul className="mt-3 space-y-3">
        {upcoming.map((b) => {
          const canJoin = Boolean(b.meetingLink) && new Date(b.startsAt).getTime() - now <= JOIN_EARLY_MS;
          return (
            <li key={b.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-semibold">{whenLabel(b.startsAt)}</p>
                <p className="text-sm text-ac-muted">with {b.tutorName}</p>
                {!b.meetingLink && <p className="mt-1 text-xs text-amber-700">Your tutor will add the class link before it starts.</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => cancel(b)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:border-red-400 hover:text-red-600">
                  Cancel
                </button>
                {canJoin ? (
                  <a href={b.meetingLink!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                    <Video className="h-4 w-4" /> Join class
                  </a>
                ) : (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">Join opens 10 min before</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {past.length > 0 && (
        <>
          <h2 className="mt-10 font-bold">Past &amp; cancelled</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {past.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span>{whenLabel(b.startsAt)} with {b.tutorName}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[b.status]}`}>{b.status.replace("_", " ").toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

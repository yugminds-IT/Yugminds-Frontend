"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Video } from "lucide-react";
import { academy, type Booking, type Credit } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { whenLabel } from "@/components/academy/SlotPicker";
import { EmptyState } from "@/components/academy/ui";
import { confirmDialog } from "@/components/ui/confirm-dialog";

const JOIN_EARLY_MS = 10 * 60_000;
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
    <div className="ac-d-page ac-d-page--narrow">
      <PageHeader
        title="1:1 classes"
        subtitle={`${remaining} class credit${remaining === 1 ? "" : "s"} left`}
        action={<Link href={remaining ? "/academy/tutors" : "/academy/courses"} className="rh-btn rh-btn--primary">{remaining ? "Book a class" : "Buy a class pack"}</Link>}
      />
      {error && <p className="ac-d-note" data-tone="error" role="alert" style={{ marginBottom: "1rem" }}>{error}</p>}

      <h2 className="ac-d-sub" style={{ marginTop: 0 }}>Upcoming</h2>
      {bookings === null && !error && <span className="ac-spin" role="status" aria-label="Loading your classes" />}
      {bookings && upcoming.length === 0 && (
        <EmptyState icon={CalendarClock} title="No upcoming classes" text={remaining ? "Pick a tutor and a time." : "Buy a class pack to book your first class."} />
      )}
      {upcoming.length > 0 && (
        <div className="ac-d-rows">
          {upcoming.map((b) => {
            const canJoin = Boolean(b.meetingLink) && new Date(b.startsAt).getTime() - now <= JOIN_EARLY_MS;
            return (
              <div key={b.id} className="ac-d-row" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                <span>
                  <b>{whenLabel(b.startsAt)}</b>
                  <small>with {b.tutorName}</small>
                  {!b.meetingLink && <small>Your tutor will add the class link before it starts.</small>}
                </span>
                <span className="ac-d-actions" style={{ justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => cancel(b)} className="rh-btn rh-btn--ghost">Cancel</button>
                  {canJoin ? (
                    <a href={b.meetingLink!} target="_blank" rel="noopener noreferrer" className="rh-btn rh-btn--primary"><Video size={16} aria-hidden="true" style={{ marginRight: "0.4rem" }} /> Join class</a>
                  ) : (
                    <span className="ac-d-pill">Join opens 10 min before</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="ac-d-sub">Past and cancelled</h2>
          <div className="ac-d-rows">
            {past.map((b) => (
              <div key={b.id} className="ac-d-row" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                <span><b style={{ fontSize: "var(--rh-t-small)" }}>{whenLabel(b.startsAt)}</b><small>with {b.tutorName}</small></span>
                <span className="ac-d-pill" data-tone={b.status === "COMPLETED" ? "good" : undefined}>{b.status.replace("_", " ").toLowerCase()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

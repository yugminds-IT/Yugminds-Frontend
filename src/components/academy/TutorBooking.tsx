"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { academy, type Credit } from "@/lib/academy/api";
import { SlotPicker, whenLabel } from "./SlotPicker";

/** Booking box on a tutor's page: preview for guests, live booking for learners with credits. */
export function TutorBooking({ tutorId }: { tutorId: string }) {
  const [state, setState] = useState<"loading" | "guest" | "learner">("loading");
  const [credit, setCredit] = useState<Credit | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  useEffect(() => {
    // 401 (signed out) or 403 (a tutor/admin account) both mean: preview only.
    academy.me
      .credits()
      .then((data) => {
        setCredit(data.find((c) => c.remaining > 0) ?? null);
        setState("learner");
      })
      .catch(() => setState("guest"));
  }, []);

  if (state === "loading") return null;

  if (booked) {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="mb-2 h-6 w-6" />
        Booked for <b>{whenLabel(booked)}</b>. The joining link will be in{" "}
        <Link href="/academy/learn/sessions" className="font-semibold underline">My sessions</Link>.
      </div>
    );
  }

  if (state === "learner" && credit) {
    return (
      <>
        <p className="mb-3 text-sm text-ac-muted">
          You have <b className="text-ac-ink">{credit.remaining}</b> class credit{credit.remaining > 1 ? "s" : ""} left.
        </p>
        <SlotPicker
          tutorId={tutorId}
          minutes={credit.minutes}
          onBook={async (startsAt) => {
            await academy.me.book(tutorId, startsAt);
            setBooked(startsAt);
          }}
        />
      </>
    );
  }

  return (
    <>
      <SlotPicker tutorId={tutorId} minutes={60} />
      <div className="mt-4 rounded-xl bg-ac-soft p-4 text-sm">
        {state === "learner" ? "You have no class credits left." : "To book, get a class pack first."}{" "}
        <Link href="/academy/courses" className="font-semibold text-ac-brand underline">See class packs</Link>
        {state === "guest" && (
          <>
            {" "}or{" "}
            <Link href="/academy/login" className="font-semibold text-ac-brand underline">log in</Link>
          </>
        )}
        .
      </div>
    </>
  );
}

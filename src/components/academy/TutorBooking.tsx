"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  if (state === "loading") return <span className="ac-spin" role="status" aria-label="Loading" />;

  if (booked) {
    return (
      <p className="ac-note" data-tone="good" role="status">
        Booked for <b>{whenLabel(booked)}</b>. The joining link will be in <Link href="/academy/learn/sessions">My sessions</Link>.
      </p>
    );
  }

  if (state === "learner" && credit) {
    return (
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <p className="ac-hint">
          You have <b>{credit.remaining}</b> class credit{credit.remaining > 1 ? "s" : ""} left.
        </p>
        <SlotPicker
          tutorId={tutorId}
          minutes={credit.minutes}
          onBook={async (startsAt) => {
            await academy.me.book(tutorId, startsAt);
            setBooked(startsAt);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.9rem" }}>
      <SlotPicker tutorId={tutorId} minutes={60} />
      <p className="ac-note">
        {state === "learner" ? "You have no class credits left." : "To book, get a class pack first."}{" "}
        <Link href="/academy/courses">See class packs</Link>
        {state === "guest" && (
          <>
            {" "}or <Link href="/academy/login">log in</Link>
          </>
        )}
        .
      </p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Clock, Video } from "lucide-react";
import { academy, type Booking } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { useAccount } from "@/components/academy/AcademyShell";
import { DashboardPage, EmptyState, StatTile, StatusBadge } from "@/components/academy/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { whenLabel } from "@/components/academy/SlotPicker";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function SessionRow({ b, onChange }: { b: Booking; onChange: () => void }) {
  const [link, setLink] = useState(b.meetingLink ?? "");
  const [notes, setNotes] = useState(b.tutorNotes ?? "");
  const [msg, setMsg] = useState("");
  const [mountedAt] = useState(() => Date.now());
  const started = new Date(b.startsAt).getTime() <= mountedAt;

  const save = async (extra?: { status?: Booking["status"] }) => {
    setMsg("");
    try {
      await academy.tutor.updateBooking(b.id, {
        ...(link && link !== b.meetingLink ? { meetingLink: link } : {}),
        ...(notes !== (b.tutorNotes ?? "") ? { tutorNotes: notes } : {}),
        ...extra,
      });
      setMsg("Saved");
      onChange();
    } catch (e) {
      setMsg(errorText(e));
    }
  };

  const cancel = async () => {
    if (!(await confirmDialog({ title: "Cancel this class?", description: "The learner gets their class credit back and is notified.", confirmText: "Cancel class", variant: "danger" }))) return;
    try {
      await academy.tutor.cancel(b.id);
      onChange();
    } catch (e) {
      setMsg(errorText(e));
    }
  };

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{whenLabel(b.startsAt)}</p>
          <p className="text-sm text-ac-muted">
            {b.learner?.fullName || "Learner"}
            {b.learner?.parentName ? `, parent ${b.learner.parentName}` : ""}
            {b.learner?.phone ? `, ${b.learner.phone}` : ""}
          </p>
        </div>
        {b.meetingLink && (
          <a href={b.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <Video className="h-4 w-4" /> Start class
          </a>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" />
        <button onClick={() => save()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:border-ac-brand">Save link</button>
      </div>
      <Textarea className="mt-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (b.tutorNotes ?? "") && save()} placeholder="Private notes (what you covered, homework…)" />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {started ? (
          <>
            <button onClick={() => save({ status: "COMPLETED" })} className="rounded-lg bg-ac-brand px-4 py-1.5 font-semibold text-white">Mark completed</button>
            <button onClick={() => save({ status: "NO_SHOW" })} className="rounded-lg border border-slate-300 px-4 py-1.5">Learner didn&apos;t join</button>
          </>
        ) : (
          <button onClick={cancel} className="rounded-lg border border-slate-300 px-4 py-1.5 hover:border-red-400 hover:text-red-600">Cancel class</button>
        )}
        {msg && <span className={msg === "Saved" ? "text-emerald-600" : "text-red-600"}>{msg}</span>}
      </div>
    </li>
  );
}

export default function TutorSessionsPage() {
  const { account } = useAccount();
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [all, setAll] = useState<Booking[]>([]);
  const [hours, setHours] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  const load = useCallback(() => {
    academy.tutor.bookings(scope).then(setRows).catch((e) => setError(errorText(e)));
    academy.tutor.bookings("all").then(setAll).catch(() => {});
  }, [scope]);
  useEffect(load, [load]);
  useEffect(() => {
    academy.tutor
      .me()
      .then((t) => setHours(t.availability.reduce((n, w) => n + (minutes(w.endTime) - minutes(w.startTime)) / 60, 0)))
      .catch(() => {});
  }, []);

  const istDay = (iso: string | number) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const live = all.filter((b) => b.status === "CONFIRMED" && new Date(b.endsAt).getTime() > now);
  const today = live.filter((b) => istDay(b.startsAt) === istDay(now)).length;
  const done = all.filter((b) => b.status === "COMPLETED").length;

  return (
    <DashboardPage
      title={`Welcome, ${account.fullName.split(" ")[0]}`}
      subtitle="Add the meeting link before each class — the learner sees a Join button 10 minutes before it starts."
      width="max-w-5xl"
    >
      <div className="mb-6 grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
        <StatTile label="Classes today" value={today} icon={CalendarClock} tone="blue" />
        <StatTile label="Upcoming classes" value={live.length} icon={Video} tone="sky" />
        <StatTile label="Classes taught" value={done} icon={CheckCircle2} tone="emerald" />
        <StatTile label="Weekly hours open" value={hours === null ? "–" : Math.round(hours * 10) / 10} hint="Set in Availability" icon={Clock} tone="amber" href="/academy/tutor/schedule" />
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as "upcoming" | "past")} className="mb-4">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past &amp; cancelled</TabsTrigger>
        </TabsList>
      </Tabs>
      {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {rows && rows.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title={scope === "upcoming" ? "No upcoming classes" : "No past classes yet"}
          text={scope === "upcoming" ? "Keep your availability up to date so learners can book you." : undefined}
        />
      )}
      {scope === "upcoming" ? (
        <ul className="space-y-3">{rows?.map((b) => <SessionRow key={b.id} b={b} onChange={load} />)}</ul>
      ) : (
        rows && rows.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {rows.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span>{whenLabel(b.startsAt)} with {b.learner?.fullName || "a learner"}</span>
                <span className="flex items-center gap-3">
                  {b.status === "CONFIRMED" && (
                    <>
                      <button onClick={() => academy.tutor.updateBooking(b.id, { status: "COMPLETED" }).then(load)} className="font-medium text-ac-brand hover:underline">Mark completed</button>
                      <button onClick={() => academy.tutor.updateBooking(b.id, { status: "NO_SHOW" }).then(load)} className="text-muted-foreground hover:underline">No-show</button>
                    </>
                  )}
                  <StatusBadge status={b.status} />
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </DashboardPage>
  );
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

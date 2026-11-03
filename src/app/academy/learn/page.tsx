"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, BookOpen, CalendarClock, CheckCircle2, Sparkles, Video } from "lucide-react";
import { academy, type Booking, type Certificate, type MyCourse, type PlayerCourse } from "@/lib/academy/api";
import { useAccount } from "@/components/academy/AcademyShell";
import { CourseCard } from "@/components/academy/CourseCard";
import { DashboardPage, EmptyState, Panel, StatTile } from "@/components/academy/ui";
import { NextLesson } from "@/components/academy/NextLesson";
import { whenLabel } from "@/components/academy/SlotPicker";

export default function LearnHome() {
  const { account } = useAccount();
  const [courses, setCourses] = useState<MyCourse[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [credits, setCredits] = useState(0);
  const [now] = useState(() => Date.now());
  const [nextCourse, setNextCourse] = useState<PlayerCourse | null>(null);

  useEffect(() => {
    academy.me
      .courses()
      .then((list) => {
        setCourses(list);
        const active = list.find((c) => !c.completedAt);
        if (active) academy.me.course(active.id).then(setNextCourse).catch(() => {});
      })
      .catch(() => setCourses([]));
    academy.me.bookings().then(setBookings).catch(() => {});
    academy.me.certificates().then(setCerts).catch(() => {});
    academy.me.credits().then((c) => setCredits(c.reduce((n, x) => n + x.remaining, 0))).catch(() => {});
  }, []);

  const inProgress = courses?.filter((c) => !c.completedAt) ?? [];
  const completed = courses?.filter((c) => c.completedAt).length ?? 0;
  const upcoming = bookings
    .filter((b) => b.status === "CONFIRMED" && new Date(b.endsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <DashboardPage
      title={`Hi ${account.fullName.split(" ")[0]}`}
      subtitle="Here is where you left off."
      action={<Link href="/academy/courses" className="rh-btn rh-btn--primary"><Sparkles size={16} aria-hidden="true" style={{ marginRight: "0.4rem" }} /> Browse courses</Link>}
    >
      {nextCourse && <NextLesson course={nextCourse} />}

      <div className="ac-d-grid ac-d-grid--stats" style={{ marginBottom: "clamp(0.9rem, 2vw, 1.5rem)" }}>
        <StatTile label="Courses in progress" value={courses ? inProgress.length : "–"} icon={BookOpen} href="/academy/learn/courses" />
        <StatTile label="Courses completed" value={courses ? completed : "–"} icon={CheckCircle2} href="/academy/learn/courses" />
        <StatTile label="Certificates" value={certs.length} icon={Award} href="/academy/learn/certificates" />
        <StatTile label="Class credits" value={credits} hint="live 1:1 classes to book" icon={Video} href="/academy/learn/sessions" />
      </div>

      <div className="ac-d-grid ac-d-grid--split">
        <Panel title="Continue learning" action={<Link href="/academy/learn/courses" className="rh-link">All courses</Link>}>
          {courses === null ? (
            <span className="ac-spin" role="status" aria-label="Loading your courses" />
          ) : inProgress.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={courses.length ? "All your courses are complete" : "You have not started a course yet"}
              text="Start with a free demo course, or pick from the full catalogue."
              action={<Link href="/academy/courses" className="rh-btn rh-btn--primary">Browse courses</Link>}
            />
          ) : (
            <div className="ac-d-rows">
              {inProgress.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          )}
        </Panel>

        <Panel title="Upcoming 1:1 classes" action={<Link href="/academy/learn/sessions" className="rh-link">Manage</Link>}>
          {upcoming.length ? (
            <div className="ac-d-rows">
              {upcoming.slice(0, 4).map((b) => (
                <div key={b.id} className="ac-d-row" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
                  <i className="ac-d-chip"><CalendarClock size={18} aria-hidden="true" /></i>
                  <span><b>{whenLabel(b.startsAt)}</b><small>with {b.tutorName}</small></span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No class booked"
              action={<Link href={credits ? "/academy/tutors" : "/academy/courses"} className="rh-btn rh-btn--ghost">{credits ? "Book a class" : "Get a class pack"}</Link>}
            />
          )}
        </Panel>
      </div>
    </DashboardPage>
  );
}

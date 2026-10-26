"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, BookOpen, CalendarClock, CheckCircle2, Sparkles, Video } from "lucide-react";
import { academy, type Booking, type Certificate, type MyCourse, type PlayerCourse } from "@/lib/academy/api";
import { useAccount } from "@/components/academy/AcademyShell";
import { CourseCard } from "@/components/academy/CourseCard";
import { DashboardPage, EmptyState, Panel, StatTile } from "@/components/academy/ui";
import { whenLabel } from "@/components/academy/SlotPicker";
import { StepRail } from "@/components/academy/StepRail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
      title={`Hi ${account.fullName.split(" ")[0]} 👋`}
      subtitle="Here's where you left off."
      action={
        <Button asChild className="bg-ac-brand hover:bg-ac-brand-dark">
          <Link href="/academy/courses"><Sparkles className="h-4 w-4" /> Browse courses</Link>
        </Button>
      }
    >
      {nextCourse && <NextStep course={nextCourse} />}

      <div className="mb-6 grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
        <StatTile label="Courses in progress" value={courses ? inProgress.length : "–"} icon={BookOpen} tone="blue" href="/academy/learn/courses" />
        <StatTile label="Courses completed" value={courses ? completed : "–"} icon={CheckCircle2} tone="emerald" href="/academy/learn/courses" />
        <StatTile label="Certificates" value={certs.length} icon={Award} tone="amber" href="/academy/learn/certificates" />
        <StatTile label="Class credits" value={credits} hint="live 1:1 classes to book" icon={Video} tone="sky" href="/academy/learn/sessions" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Continue learning" className="lg:col-span-2" action={<Link href="/academy/learn/courses" className="text-sm font-medium text-ac-brand hover:underline">All courses</Link>}>
          {courses === null ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : inProgress.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={courses.length ? "All your courses are complete — nice work!" : "You haven't started a course yet"}
              text="Start with a free demo course, or pick from the full catalogue."
              action={<Button asChild className="bg-ac-brand hover:bg-ac-brand-dark"><Link href="/academy/courses">Browse courses</Link></Button>}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {inProgress.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          )}
        </Panel>

        <Panel title="Upcoming 1:1 classes" action={<Link href="/academy/learn/sessions" className="text-sm font-medium text-ac-brand hover:underline">Manage</Link>}>
          {upcoming.length ? (
            <ul className="divide-y divide-gray-100">
              {upcoming.slice(0, 4).map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><CalendarClock className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{whenLabel(b.startsAt)}</span>
                    <span className="block text-xs text-muted-foreground">with {b.tutorName}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No class booked"
              action={
                <Button asChild variant="outline">
                  <Link href={credits ? "/academy/tutors" : "/academy/courses"}>{credits ? "Book a class" : "Get a class pack"}</Link>
                </Button>
              }
            />
          )}
        </Panel>
      </div>
    </DashboardPage>
  );
}

/** The learner's place in their current course, as build steps around "you are here". */
function NextStep({ course }: { course: PlayerCourse }) {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const currentIdx = Math.max(0, lessons.findIndex((l) => !l.completed && !l.locked));
  const done = lessons.filter((l) => l.completed).length;
  const from = Math.max(0, currentIdx - 1);
  const window = lessons.slice(from, from + 5);
  const current = lessons[currentIdx];
  return (
    <section className="ac-graph mb-6 grid gap-6 rounded-2xl border border-slate-200 p-5 sm:p-7 md:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col">
        <p className="text-sm text-slate-600">Your next step</p>
        <h2 className="mt-1 font-acdisplay text-2xl font-bold leading-tight text-ac-ink sm:text-3xl">{current?.title ?? course.title}</h2>
        <p className="mt-2 text-slate-600">{course.title}</p>
        <p className="mt-4 font-acdisplay text-lg font-semibold text-ac-ink">
          {done} of {lessons.length} lessons built
        </p>
        <div className="mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={lessons.length} aria-label="Course progress">
          <div className="h-full rounded-full bg-ac-brand" style={{ width: `${lessons.length ? (done / lessons.length) * 100 : 0}%` }} />
        </div>
        <Link
          href={`/academy/learn/courses/${course.id}${current ? `?lesson=${current.id}` : ""}`}
          className="mt-6 inline-flex w-fit rounded-lg bg-ac-brand px-5 py-2.5 font-semibold text-white outline-none hover:bg-ac-brand-dark focus-visible:ring-2 focus-visible:ring-ac-brand/40 focus-visible:ring-offset-2"
        >
          {done === 0 ? "Start the course" : "Continue"}
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <StepRail
          start={from + 1}
          steps={window.map((l) => ({
            id: l.id,
            title: l.title,
            state: l.locked ? "locked" : l.id === current?.id ? "current" : l.completed ? "done" : "todo",
            meta: l.durationMinutes ? `${l.durationMinutes} min` : undefined,
            href: l.locked ? undefined : `/academy/learn/courses/${course.id}?lesson=${l.id}`,
          }))}
        />
      </div>
    </section>
  );
}

"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Award, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { academy, type PlayerCourse, type PlayerLesson } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { LessonView } from "@/components/academy/LessonView";
import { StepRail } from "@/components/academy/StepRail";

export default function CoursePlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const [course, setCourse] = useState<PlayerCourse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    academy.me.course(id).then(setCourse).catch((e) => setError(errorText(e)));
  }, [id]);

  const lessons = useMemo(() => course?.modules.flatMap((m) => m.lessons) ?? [], [course]);
  const done = lessons.filter((l) => l.completed).length;
  const progress = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  // Resume at ?lesson=, else the first unfinished open lesson.
  const current =
    lessons.find((l) => l.id === search.get("lesson")) ??
    lessons.find((l) => !l.completed && !l.locked) ??
    lessons[0];
  const index = current ? lessons.indexOf(current) : -1;

  const go = (l: PlayerLesson | undefined) => {
    if (!l) return;
    setMenuOpen(false);
    router.replace(`?lesson=${l.id}`, { scroll: false });
  };

  const markDone = (lessonId: string, quizScore?: number) =>
    setCourse((c) =>
      c && {
        ...c,
        modules: c.modules.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, completed: true, quizScore: quizScore ?? l.quizScore } : l)),
        })),
      },
    );

  const completeAndNext = async () => {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      if (!current.completed) {
        const r = await academy.me.complete(current.id);
        markDone(current.id);
        if (r.certificateId) setCertificateId(r.certificateId);
      }
      go(lessons[index + 1]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <Link href="/academy/learn/courses" className="font-semibold text-ac-brand hover:underline">← My courses</Link>
      </div>
    );
  }
  if (!course || !current) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ac-brand" /></div>;
  }

  const outline = (
    <nav className="space-y-6 p-5" aria-label="Course outline">
      {course.modules.map((m, mi) => {
        const start = course.modules.slice(0, mi).reduce((n, x) => n + x.lessons.length, 1);
        return (
          <div key={m.id}>
            <p className="mb-1 font-acdisplay text-sm font-semibold text-slate-800">Module {mi + 1}: {m.title}</p>
            <StepRail
              compact
              start={start}
              steps={m.lessons.map((l) => ({
                id: l.id,
                title: l.title,
                state: l.locked ? "locked" : l.id === current.id ? "current" : l.completed ? "done" : "todo",
                meta: l.durationMinutes ? `${l.durationMinutes} min` : undefined,
                onClick: () => go(l),
              }))}
            />
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/academy/learn/courses" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Back to my courses">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-acdisplay text-lg font-semibold text-ac-ink">{course.title}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100 sm:w-48" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-lg bg-ac-brand" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-ac-muted">{done} of {lessons.length} lessons</span>
          </div>
        </div>
        <button onClick={() => setMenuOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Course outline">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">{outline}</aside>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-label="Close outline" />
            <aside className="absolute inset-y-0 right-0 w-80 max-w-[85vw] overflow-y-auto bg-white shadow-xl">
              <div className="flex justify-end p-2">
                <button onClick={() => setMenuOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close outline"><X className="h-5 w-5" /></button>
              </div>
              {outline}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl p-4 sm:p-8">
            {!course.enrolled && (
              <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                You&apos;re viewing a free preview. <Link href="/academy/courses" className="font-semibold underline">Buy the course</Link> to unlock every lesson.
              </div>
            )}
            {(certificateId || course.completedAt) && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <Award className="h-5 w-5" />
                <span className="flex-1 font-semibold">Course complete — congratulations!</span>
                <Link href={certificateId ? `/academy/learn/certificates/${certificateId}` : "/academy/learn/certificates"} className="rounded-lg bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700">
                  View certificate
                </Link>
              </div>
            )}
            <p className="text-sm text-ac-muted">Lesson {index + 1} of {lessons.length}</p>
            <h1 className="mb-5 mt-1 font-acdisplay text-2xl font-bold text-ac-ink sm:text-3xl">{current.title}</h1>

            <LessonView
              key={current.id}
              lesson={current}
              onProgress={(r) => {
                markDone(r.lessonId, r.quizScore);
                if (r.certificateId) setCertificateId(r.certificateId);
              }}
            />

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <button onClick={() => go(lessons[index - 1])} disabled={index <= 0} className="flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              {current.type === "QUIZ" ? (
                <button onClick={() => go(lessons[index + 1])} disabled={!current.completed || index >= lessons.length - 1} className="flex items-center gap-1 rounded-lg bg-ac-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : course.enrolled ? (
                <button onClick={completeAndNext} disabled={busy} className="flex items-center gap-1 rounded-lg bg-ac-brand px-5 py-2 text-sm font-semibold text-white hover:bg-ac-brand-dark disabled:opacity-60">
                  {current.completed ? (index < lessons.length - 1 ? "Next" : "Done") : index < lessons.length - 1 ? "Mark complete & next" : "Mark complete"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

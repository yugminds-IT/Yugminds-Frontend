"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Award, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { display, body } from "../../../../robocoders/robo-fonts";
import "../../../../../components/public/robo-home.css";
import "../../../../../components/academy/academy.css";
import "../../../../../components/academy/academy-dash.css";
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

  const fonts = `rh ${display.variable} ${body.variable}`;
  if (error && !course) {
    return (
      <div className={fonts}>
        <div className="ac-d-load" style={{ gap: "1rem", alignContent: "center", textAlign: "center" }}>
          <p className="ac-d-note" data-tone="error" role="alert">{error}</p>
          <Link href="/academy/learn/courses" className="rh-btn rh-btn--ghost">Back to my courses</Link>
        </div>
      </div>
    );
  }
  if (!course || !current) {
    return <div className={fonts}><div className="ac-d-load"><span className="ac-spin" role="status" aria-label="Loading the course" /></div></div>;
  }

  const outline = (
    <nav aria-label="Course outline">
      {course.modules.map((m, mi) => {
        const start = course.modules.slice(0, mi).reduce((n, x) => n + x.lessons.length, 1);
        return (
          <div key={m.id}>
            <h2>Module {mi + 1}: {m.title}</h2>
            <StepRail
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

  const last = index >= lessons.length - 1;

  return (
    <div className={`${fonts} ac-p`}>
      <header className="rh-dark ac-p-head">
        <Link href="/academy/learn/courses" className="ac-d-icon-btn" aria-label="Back to my courses"><ChevronLeft size={22} aria-hidden="true" /></Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1>{course.title}</h1>
          <div className="ac-p-prog">
            <div className="ac-d-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><i style={{ "--p": `${progress}%` } as React.CSSProperties} /></div>
            <span>{done} of {lessons.length} lessons</span>
          </div>
        </div>
        <button type="button" onClick={() => setMenuOpen(true)} className="ac-d-icon-btn ac-p-menu" aria-label="Course outline"><Menu size={22} aria-hidden="true" /></button>
      </header>

      <div className="ac-p-body">
        <aside className="ac-p-rail">{outline}</aside>
        {menuOpen && (
          <div className="ac-p-drawer">
            <button type="button" className="ac-d-scrim" onClick={() => setMenuOpen(false)} aria-label="Close outline" />
            <aside>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setMenuOpen(false)} className="ac-d-icon-btn" style={{ color: "var(--rh-ink)" }} aria-label="Close outline"><X size={20} aria-hidden="true" /></button>
              </div>
              {outline}
            </aside>
          </div>
        )}

        <main className="ac-p-main">
          <div className="ac-p-lesson">
            {!course.enrolled && (
              <p className="ac-d-note" data-tone="warn">
                You are viewing a free preview. <Link href="/academy/courses">Buy the course</Link> to unlock every lesson.
              </p>
            )}
            {(certificateId || course.completedAt) && (
              <div className="ac-d-note" data-tone="good" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
                <Award size={20} aria-hidden="true" style={{ color: "var(--rh-amber)" }} />
                <b style={{ flex: 1 }}>Course complete. Well done!</b>
                <Link href={certificateId ? `/academy/learn/certificates/${certificateId}` : "/academy/learn/certificates"} className="rh-btn rh-btn--primary">View certificate</Link>
              </div>
            )}
            <div>
              <p className="ac-p-count">Lesson {index + 1} of {lessons.length}</p>
              <h1>{current.title}</h1>
            </div>

            <LessonView
              key={current.id}
              lesson={current}
              onProgress={(r) => {
                markDone(r.lessonId, r.quizScore);
                if (r.certificateId) setCertificateId(r.certificateId);
              }}
            />

            {error && <p className="ac-d-note" data-tone="error" role="alert">{error}</p>}
            <div className="ac-p-nav">
              <button type="button" onClick={() => go(lessons[index - 1])} disabled={index <= 0} className="rh-btn rh-btn--ghost">
                <ChevronLeft size={16} aria-hidden="true" /> Previous
              </button>
              {current.type === "QUIZ" ? (
                <button type="button" onClick={() => go(lessons[index + 1])} disabled={!current.completed || last} className="rh-btn rh-btn--primary">
                  Next <ChevronRight size={16} aria-hidden="true" />
                </button>
              ) : course.enrolled ? (
                <button type="button" onClick={completeAndNext} disabled={busy} aria-busy={busy} className="rh-btn rh-btn--primary">
                  {current.completed ? (last ? "Done" : "Next") : last ? "Mark complete" : "Mark complete and next"}
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

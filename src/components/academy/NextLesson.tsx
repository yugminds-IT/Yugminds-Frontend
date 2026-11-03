import Link from "next/link";
import type { PlayerCourse } from "@/lib/academy/api";
import "../public/droid.css";

const Droid = () => (
  <div className="droid-mini ac-d-node-idle" aria-hidden="true">
    <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
    <div className="droid__body" />
  </div>
);

/* The learner's place in their current course: a track of up to five lessons with the droid standing on the one they are
   on, finished lessons in amber and later ones dimmed. */
export function NextLesson({ course }: { course: PlayerCourse }) {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const idx = Math.max(0, lessons.findIndex((l) => !l.completed && !l.locked));
  const done = lessons.filter((l) => l.completed).length;
  const from = Math.max(0, Math.min(idx - 1, lessons.length - 5));
  const shown = lessons.slice(from, from + 5);
  const current = lessons[idx];
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

  return (
    <section className="rh-dark ac-d-next" aria-label="Your next lesson">
      <div className="ac-d-next-copy">
        <p className="ac-d-next-count">{course.title}</p>
        <h2>{current?.title ?? course.title}</h2>
        <div className="ac-d-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
          <i style={{ "--p": `${pct}%` } as React.CSSProperties} />
        </div>
        <p className="ac-d-next-count">{done} of {lessons.length} lessons done</p>
        <Link href={`/academy/learn/courses/${course.id}${current ? `?lesson=${current.id}` : ""}`} className="rh-btn rh-btn--primary">
          {done === 0 ? "Start the course" : "Continue"}
        </Link>
      </div>
      <ol className="ac-d-track">
        {shown.map((l, i) => {
          const state = l.locked ? "locked" : l.id === current?.id ? "current" : l.completed ? "done" : "todo";
          const body = (
            <>
              <span className="ac-d-node-pin">{state === "current" && <Droid />}</span>
              <span className="ac-d-node-dot">{from + i + 1}</span>
              <span className="ac-d-node-label">{l.title}</span>
            </>
          );
          return (
            <li key={l.id} style={{ display: "contents" }}>
              {state === "locked" ? (
                <div className="ac-d-node" data-state={state}>{body}</div>
              ) : (
                <Link href={`/academy/learn/courses/${course.id}?lesson=${l.id}`} className="ac-d-node" data-state={state} aria-current={state === "current" ? "step" : undefined}>{body}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

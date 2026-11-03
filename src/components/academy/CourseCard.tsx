import Link from "next/link";
import { BookOpen, CheckCircle2 } from "lucide-react";
import type { MyCourse } from "@/lib/academy/api";

/** One course the learner owns, as a row: art, title, progress and where they are. */
export function CourseCard({ course: c }: { course: MyCourse }) {
  return (
    <Link href={`/academy/learn/courses/${c.id}`} className="ac-d-row">
      <span className="ac-d-art">
        {c.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- course thumbnails may be any host or data URL
          <img src={c.thumbnailUrl} alt="" />
        ) : (
          <BookOpen size={24} aria-hidden="true" />
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <b>{c.title}</b>
        <small>
          {c.completedAt ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><CheckCircle2 size={14} aria-hidden="true" /> Completed</span>
          ) : (
            `${c.completedLessons} of ${c.totalLessons} lessons done`
          )}
        </small>
        <span className="ac-d-bar" role="progressbar" aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} progress`} style={{ display: "block" }}>
          <i style={{ "--p": `${c.progress}%` } as React.CSSProperties} />
        </span>
      </span>
      <span className="ac-d-pill" data-tone={c.completedAt ? "good" : undefined}>{c.completedAt ? "Done" : `${c.progress}%`}</span>
    </Link>
  );
}

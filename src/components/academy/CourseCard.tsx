import Link from "next/link";
import { BookOpen, CheckCircle2 } from "lucide-react";
import type { MyCourse } from "@/lib/academy/api";

export function CourseCard({ course: c }: { course: MyCourse }) {
  return (
    <Link href={`/academy/learn/courses/${c.id}`} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 hover:border-ac-brand">
      <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ac-soft">
        {c.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- course thumbnails may be any host or data URL
          <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <BookOpen className="h-6 w-6 text-ac-brand" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.title}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-lg bg-ac-brand" style={{ width: `${c.progress}%` }} />
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-ac-muted">
          {c.completedAt ? <><CheckCircle2 className="h-3.5 w-3.5 text-ac-brand" /> Completed</> : `${c.completedLessons} of ${c.totalLessons} lessons done`}
        </p>
      </div>
    </Link>
  );
}

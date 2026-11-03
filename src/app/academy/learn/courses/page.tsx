"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { academy, type MyCourse } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { CourseCard } from "@/components/academy/CourseCard";
import { EmptyState } from "@/components/academy/ui";

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<MyCourse[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.me.courses().then(setCourses).catch((e) => setError(errorText(e)));
  }, []);

  const active = courses?.filter((c) => !c.completedAt) ?? [];
  const done = courses?.filter((c) => c.completedAt) ?? [];

  return (
    <div className="ac-d-page ac-d-page--narrow">
      <PageHeader title="My courses" action={<Link href="/academy/courses" className="rh-btn rh-btn--ghost">Browse more</Link>} />
      {error && <p className="ac-d-note" data-tone="error" role="alert">{error}</p>}
      {courses === null && !error && <span className="ac-spin" role="status" aria-label="Loading your courses" />}
      {courses?.length === 0 && (
        <EmptyState icon={BookOpen} title="No courses yet" text="Start with a free demo course." action={<Link href="/academy/courses" className="rh-btn rh-btn--primary">Browse courses</Link>} />
      )}
      {active.length > 0 && <div className="ac-d-rows">{active.map((c) => <CourseCard key={c.id} course={c} />)}</div>}
      {done.length > 0 && (
        <>
          <h2 className="ac-d-sub">Completed</h2>
          <div className="ac-d-rows">{done.map((c) => <CourseCard key={c.id} course={c} />)}</div>
        </>
      )}
    </div>
  );
}

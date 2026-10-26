"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { academy, type MyCourse } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { CourseCard } from "@/components/academy/CourseCard";

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<MyCourse[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.me.courses().then(setCourses).catch((e) => setError(errorText(e)));
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <PageHeader title="My courses" />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {courses?.length === 0 && (
        <p className="text-sm text-ac-muted">
          No courses yet. <Link href="/academy/courses" className="font-semibold text-ac-brand hover:underline">Browse courses</Link>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {courses?.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Download, Plus } from "lucide-react";
import { academy, type CourseRow } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type LmsCourse = { id: string; title: string; isPublished: boolean; _count: { chapters: number } };

export default function AdminCoursesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CourseRow[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [lms, setLms] = useState<LmsCourse[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    academy.admin.courses().then(setRows).catch((e) => setError(errorText(e)));
  }, []);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get("title")).trim();
    try {
      const { id } = await academy.admin.createCourse({ title });
      router.push(`/academy/admin/courses/${id}`);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const openImport = () => {
    setError("");
    setLms([]);
    academy.admin.lmsCourses().then(setLms).catch((e) => { setError(errorText(e)); setLms(null); });
  };

  const doImport = async (c: LmsCourse) => {
    setImporting(c.id);
    try {
      const { id } = await academy.admin.importLms(c.id);
      router.push(`/academy/admin/courses/${id}`);
    } catch (e) {
      setError(errorText(e));
      setImporting(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader
        title="Courses"
        subtitle="Build self-paced courses here, then put them on sale under Products & pricing."
        action={
          <div className="flex gap-2">
            <button onClick={openImport} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:border-ac-brand">
              <Download className="h-4 w-4" /> Import from LMS
            </button>
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-lg bg-ac-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-ac-brand-dark">
              <Plus className="h-4 w-4" /> New course
            </button>
          </div>
        }
      />
      {error && <p className="mb-4 whitespace-pre-line rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows?.map((c) => (
          <Link key={c.id} href={`/academy/admin/courses/${c.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-ac-brand">
            <div className="flex aspect-video items-center justify-center bg-ac-soft">
              {c.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-provided URL
                <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <BookOpen className="h-10 w-10 text-ac-brand" />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{c.title}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${c.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {c.isPublished ? "Published" : "Draft"}
                </span>
              </div>
              <p className="mt-1 text-xs text-ac-muted">
                {c.moduleCount} modules, {c.lessonCount} lessons, {c.learnerCount} learners
                {c.importedFromLmsCourseId ? ". Imported from the LMS" : ""}
              </p>
            </div>
          </Link>
        ))}
        {rows?.length === 0 && <p className="text-sm text-ac-muted">No courses yet — create one or import from the LMS.</p>}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New course</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <Input name="title" placeholder="e.g. Robotics with Arduino — Level 1" required minLength={2} autoFocus />
            <button className="w-full rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark">Create and open builder</button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={lms !== null} onOpenChange={(o) => !o && setLms(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Import from LMS</DialogTitle></DialogHeader>
          <p className="text-sm text-ac-muted">
            Copies the course&apos;s chapters and lessons into a new <b>draft</b> Academy course. It&apos;s a one-time copy: later LMS edits are not synced, and LMS assignments/quizzes aren&apos;t copied.
          </p>
          <ul className="divide-y divide-slate-100">
            {lms?.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium">{c.title}</span>
                  <span className="block text-xs text-ac-muted">{c._count.chapters} chapters{c.isPublished ? "" : ", unpublished in the LMS"}</span>
                </span>
                <button onClick={() => doImport(c)} disabled={importing !== null} className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:border-ac-brand disabled:opacity-50">
                  {importing === c.id ? "Importing…" : "Import"}
                </button>
              </li>
            ))}
            {lms?.length === 0 && <li className="py-3 text-sm text-ac-muted">Loading LMS courses…</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

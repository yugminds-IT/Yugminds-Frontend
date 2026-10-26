"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, FileText, HelpCircle, Link2, Pencil, PlayCircle, Plus, Trash2, Upload } from "lucide-react";
import { academy, type BuilderCourse, type BuilderLesson, type LessonType } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { LessonEditor } from "@/components/academy/LessonEditor";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const ICON: Record<LessonType, typeof PlayCircle> = { VIDEO: PlayCircle, PDF: FileText, TEXT: FileText, QUIZ: HelpCircle, LINK: Link2 };

const iconButton = "rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30";

export default function CourseBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<BuilderCourse | null>(null);
  const [details, setDetails] = useState({ title: "", description: "", thumbnailUrl: "" });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<{ moduleId: string; lesson: BuilderLesson | null } | null>(null);
  const [newModule, setNewModule] = useState("");

  const load = useCallback(() => {
    academy.admin
      .course(id)
      .then((c) => {
        setCourse(c);
        setDetails({ title: c.title, description: c.description ?? "", thumbnailUrl: c.thumbnailUrl ?? "" });
      })
      .catch((e) => setError(errorText(e)));
  }, [id]);
  useEffect(load, [load]);

  // Every mutation: run, then reload the outline; surface errors in one place.
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError("");
    setMsg("");
    try {
      await fn();
      if (ok) setMsg(ok);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const saveDetails = (isPublished = course?.isPublished) =>
    run(
      () =>
        academy.admin.updateCourse(id, {
          title: details.title.trim(),
          description: details.description.trim() || undefined,
          thumbnailUrl: details.thumbnailUrl.trim() || undefined,
          isPublished,
        }),
      "Saved",
    );

  const uploadThumb = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { url } = await academy.admin.upload(file);
      setDetails((d) => ({ ...d, thumbnailUrl: url }));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const confirmDelete = async (what: string, fn: () => Promise<unknown>) => {
    if (await confirmDialog({ title: `Delete ${what}?`, description: "This can't be undone. Learners' progress on these lessons is removed too.", confirmText: "Delete", variant: "danger" })) {
      await run(fn);
    }
  };

  const deleteCourse = async () => {
    if (!(await confirmDialog({ title: "Delete this course?", description: "Only possible while no learner owns it.", confirmText: "Delete course", variant: "danger" }))) return;
    try {
      await academy.admin.deleteCourse(id);
      router.push("/academy/admin/courses");
    } catch (e) {
      setError(errorText(e));
    }
  };

  if (!course) {
    return <div className="p-8">{error ? <p className="text-red-600">{error}</p> : <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ac-brand" />}</div>;
  }

  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <Link href="/academy/admin/courses" className="text-sm font-semibold text-ac-brand hover:underline">← Courses</Link>
      <PageHeader
        title={course.title}
        subtitle={`${course.modules.length} modules, ${lessonCount} lessons${course.importedFromLmsCourseId ? ". Imported from the LMS" : ""}`}
        action={
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium">
            {course.isPublished ? "Published" : "Draft"}
            <Switch checked={course.isPublished} onCheckedChange={(v) => saveDetails(v)} />
          </label>
        }
      />
      {error && <p className="mb-4 whitespace-pre-line rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-title">Title</Label>
            <Input id="c-title" value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea id="c-desc" rows={4} value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-thumb">Cover image</Label>
            <div className="flex gap-2">
              <Input id="c-thumb" value={details.thumbnailUrl} onChange={(e) => setDetails({ ...details, thumbnailUrl: e.target.value })} placeholder="https://…" />
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-medium hover:border-ac-brand">
                <Upload className="h-4 w-4" /> Upload
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadThumb(e.target.files?.[0])} />
              </label>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => saveDetails()} className="rounded-lg bg-ac-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-ac-brand-dark">Save details</button>
          <button onClick={deleteCourse} className="text-sm font-medium text-red-600 hover:underline">Delete course</button>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="font-bold">Curriculum</h2>
        {course.modules.map((m, mi) => (
          <div key={m.id} className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="text-xs font-semibold text-ac-muted">MODULE {mi + 1}</span>
              <span className="flex-1 font-semibold">{m.title}</span>
              <button className={iconButton} disabled={mi === 0} onClick={() => run(() => academy.admin.moveModule(m.id, "up"))} aria-label="Move module up"><ArrowUp className="h-4 w-4" /></button>
              <button className={iconButton} disabled={mi === course.modules.length - 1} onClick={() => run(() => academy.admin.moveModule(m.id, "down"))} aria-label="Move module down"><ArrowDown className="h-4 w-4" /></button>
              <button
                className={iconButton}
                onClick={() => {
                  const title = window.prompt("Module title", m.title)?.trim();
                  if (title && title !== m.title) run(() => academy.admin.updateModule(m.id, title));
                }}
                aria-label="Rename module"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button className={iconButton} onClick={() => confirmDelete(`module "${m.title}" and its lessons`, () => academy.admin.deleteModule(m.id))} aria-label="Delete module"><Trash2 className="h-4 w-4" /></button>
            </div>
            <ul className="divide-y divide-slate-50">
              {m.lessons.map((l, li) => {
                const Icon = ICON[l.type];
                return (
                  <li key={l.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="flex-1">{l.title}</span>
                    {l.isPreview && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><Eye className="h-3 w-3" /> Preview</span>}
                    {l.durationMinutes ? <span className="text-xs text-ac-muted">{l.durationMinutes}m</span> : null}
                    <button className={iconButton} disabled={li === 0} onClick={() => run(() => academy.admin.moveLesson(l.id, "up"))} aria-label="Move lesson up"><ArrowUp className="h-4 w-4" /></button>
                    <button className={iconButton} disabled={li === m.lessons.length - 1} onClick={() => run(() => academy.admin.moveLesson(l.id, "down"))} aria-label="Move lesson down"><ArrowDown className="h-4 w-4" /></button>
                    <button className={iconButton} onClick={() => setEditing({ moduleId: m.id, lesson: l })} aria-label="Edit lesson"><Pencil className="h-4 w-4" /></button>
                    <button className={iconButton} onClick={() => confirmDelete(`lesson "${l.title}"`, () => academy.admin.deleteLesson(l.id))} aria-label="Delete lesson"><Trash2 className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ul>
            <button onClick={() => setEditing({ moduleId: m.id, lesson: null })} className="flex w-full items-center gap-1.5 px-4 py-3 text-sm font-semibold text-ac-brand hover:bg-ac-soft">
              <Plus className="h-4 w-4" /> Add lesson
            </button>
          </div>
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newModule.trim()) run(() => academy.admin.addModule(id, newModule.trim()).then(() => setNewModule("")));
          }}
          className="flex gap-2"
        >
          <Input value={newModule} onChange={(e) => setNewModule(e.target.value)} placeholder="New module title, e.g. Getting started" />
          <button className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:border-ac-brand">
            <Plus className="h-4 w-4" /> Add module
          </button>
        </form>
      </section>

      {editing && (
        <LessonEditor
          moduleId={editing.moduleId}
          lesson={editing.lesson}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

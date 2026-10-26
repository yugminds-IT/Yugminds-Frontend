"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { academy, type BuilderLesson, type LessonInput, type LessonType } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const TYPES: { value: LessonType; label: string; hint: string }[] = [
  { value: "VIDEO", label: "Video", hint: "YouTube / Vimeo link, or upload an MP4 (under 100 MB)" },
  { value: "PDF", label: "PDF", hint: "Upload a PDF or paste its link" },
  { value: "TEXT", label: "Reading", hint: "Plain text or HTML" },
  { value: "QUIZ", label: "Quiz", hint: "Multiple choice — 60% to pass" },
  { value: "LINK", label: "Link", hint: "Any external resource (simulator, worksheet…)" },
];

type Question = { question: string; options: string[]; answer: number };

const EMPTY: LessonInput = { title: "", type: "VIDEO", contentUrl: "", body: "", quiz: null, durationMinutes: null, isPreview: false };

export function LessonEditor({
  moduleId,
  lesson,
  onClose,
  onSaved,
}: {
  moduleId: string;
  lesson: BuilderLesson | null; // null = new lesson
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<LessonInput>(() =>
    lesson
      ? { title: lesson.title, type: lesson.type, contentUrl: lesson.contentUrl, body: lesson.body, quiz: lesson.quiz, durationMinutes: lesson.durationMinutes, isPreview: lesson.isPreview }
      : EMPTY,
  );
  const [quiz, setQuiz] = useState<Question[]>(() => lesson?.quiz ?? [{ question: "", options: ["", ""], answer: 0 }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<LessonInput>) => setDraft((d) => ({ ...d, ...patch }));
  const setQ = (i: number, patch: Partial<Question>) => setQuiz((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await academy.admin.upload(file);
      set({ contentUrl: url });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload: LessonInput = {
      ...draft,
      contentUrl: draft.contentUrl?.trim() || null,
      body: draft.body?.trim() ? draft.body : null,
      quiz: draft.type === "QUIZ" ? quiz.map((q) => ({ ...q, options: q.options.map((o) => o.trim()) })) : null,
    };
    // Optional fields go as undefined rather than null for the validator.
    const body = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v === null ? undefined : v])) as LessonInput;
    try {
      if (lesson) await academy.admin.updateLesson(lesson.id, body);
      else await academy.admin.addLesson(moduleId, body);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const hint = TYPES.find((t) => t.value === draft.type)?.hint;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{lesson ? "Edit lesson" : "New lesson"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="l-title">Title</Label>
            <Input id="l-title" required value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button type="button" key={t.value} onClick={() => set({ type: t.value })} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${draft.type === t.value ? "border-ac-brand bg-ac-soft text-ac-brand" : "border-slate-200"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {hint && <p className="-mt-2 text-xs text-ac-muted">{hint}</p>}

          {(draft.type === "VIDEO" || draft.type === "PDF" || draft.type === "LINK") && (
            <div className="space-y-1.5">
              <Label htmlFor="l-url">{draft.type === "LINK" ? "Link" : "Link or uploaded file"}</Label>
              <div className="flex gap-2">
                <Input id="l-url" value={draft.contentUrl ?? ""} onChange={(e) => set({ contentUrl: e.target.value })} placeholder="https://…" />
                {draft.type !== "LINK" && (
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-medium hover:border-ac-brand">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                    <input type="file" className="sr-only" accept={draft.type === "PDF" ? "application/pdf" : "video/mp4,video/webm"} onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
                  </label>
                )}
              </div>
            </div>
          )}

          {(draft.type === "TEXT" || draft.type === "LINK") && (
            <div className="space-y-1.5">
              <Label htmlFor="l-body">{draft.type === "TEXT" ? "Lesson text" : "Instructions (optional)"}</Label>
              <Textarea id="l-body" rows={draft.type === "TEXT" ? 12 : 3} value={draft.body ?? ""} onChange={(e) => set({ body: e.target.value })} />
            </div>
          )}

          {draft.type === "QUIZ" && (
            <div className="space-y-4">
              {quiz.map((q, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-2">
                    <Input value={q.question} onChange={(e) => setQ(i, { question: e.target.value })} placeholder={`Question ${i + 1}`} required />
                    <button type="button" onClick={() => setQuiz(quiz.filter((_, j) => j !== i))} disabled={quiz.length === 1} className="rounded-md p-2 text-slate-400 hover:text-red-600 disabled:opacity-30" aria-label="Remove question">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-ac-muted">Options — select the correct one</p>
                  <div className="mt-1.5 space-y-2">
                    {q.options.map((o, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <input type="radio" name={`ans-${i}`} checked={q.answer === j} onChange={() => setQ(i, { answer: j })} className="accent-blue-600" aria-label={`Option ${j + 1} is correct`} />
                        <Input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} placeholder={`Option ${j + 1}`} required />
                        <button
                          type="button"
                          onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== j), answer: q.answer > j ? q.answer - 1 : q.answer === j ? 0 : q.answer })}
                          disabled={q.options.length <= 2}
                          className="rounded-md p-2 text-slate-400 hover:text-red-600 disabled:opacity-30"
                          aria-label="Remove option"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {q.options.length < 8 && (
                    <button type="button" onClick={() => setQ(i, { options: [...q.options, ""] })} className="mt-2 text-sm font-medium text-ac-brand hover:underline">+ Add option</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setQuiz([...quiz, { question: "", options: ["", ""], answer: 0 }])} className="flex items-center gap-1 text-sm font-semibold text-ac-brand hover:underline">
                <Plus className="h-4 w-4" /> Add question
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="l-mins">Duration (minutes)</Label>
              <Input id="l-mins" type="number" min={0} max={600} value={draft.durationMinutes ?? ""} onChange={(e) => set({ durationMinutes: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3">
              <span className="text-sm">
                <span className="font-medium">Free preview</span>
                <span className="block text-xs text-ac-muted">Viewable before buying</span>
              </span>
              <Switch checked={draft.isPreview} onCheckedChange={(v) => set({ isPreview: v })} />
            </label>
          </div>

          {error && <p className="whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={saving || uploading} className="w-full rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark disabled:opacity-60">
            {saving ? "Saving…" : "Save lesson"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

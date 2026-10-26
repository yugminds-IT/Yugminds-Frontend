"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { academy, type PlayerLesson, type ProgressResult } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { sanitizeHtml } from "@/lib/sanitize-html";

/** YouTube / Vimeo page URL → privacy-friendly embed URL; anything else is played as a file. */
export function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

const looksLikeHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

export function LessonView({
  lesson,
  onProgress,
}: {
  lesson: PlayerLesson;
  onProgress: (r: ProgressResult & { lessonId: string; quizScore?: number }) => void;
}) {
  const url = lesson.contentUrl ?? "";
  switch (lesson.type) {
    case "VIDEO": {
      const embed = embedUrl(url);
      return (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          {embed ? (
            <iframe src={embed} title={lesson.title} className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <video src={url} controls controlsList="nodownload" className="h-full w-full" />
          )}
        </div>
      );
    }
    case "PDF":
      return (
        <div>
          <iframe src={url} title={lesson.title} className="h-[75vh] w-full rounded-xl border border-slate-200 bg-white" />
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ac-brand hover:underline">
            Open PDF in a new tab <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      );
    case "TEXT": {
      const body = lesson.body ?? "";
      return looksLikeHtml(body) ? (
        <article className="prose prose-slate max-w-none rounded-xl bg-white p-6" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }} />
      ) : (
        <article className="whitespace-pre-line rounded-xl bg-white p-6 leading-relaxed text-slate-800">{body}</article>
      );
    }
    case "LINK":
      return (
        <div className="rounded-xl bg-white p-8 text-center">
          {lesson.body && <p className="mb-4 whitespace-pre-line text-slate-700">{lesson.body}</p>}
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-ac-brand px-6 py-3 font-semibold text-white hover:bg-ac-brand-dark">
            Open resource <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      );
    case "QUIZ":
      return <Quiz lesson={lesson} onProgress={onProgress} />;
  }
}

function Quiz({ lesson, onProgress }: { lesson: PlayerLesson; onProgress: Parameters<typeof LessonView>[0]["onProgress"] }) {
  const questions = lesson.quiz ?? [];
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: boolean[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await academy.me.quiz(lesson.id, answers);
      setResult(r);
      if (r.passed) onProgress({ ...r, lessonId: lesson.id, quizScore: r.score });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {lesson.completed && !result && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">You passed this quiz{lesson.quizScore != null ? ` with ${lesson.quizScore}%` : ""}. You can retake it any time.</p>
      )}
      {questions.map((q, i) => (
        <fieldset key={i} className="rounded-xl border border-slate-200 bg-white p-5">
          <legend className="px-1 font-semibold">{i + 1}. {q.question}</legend>
          <div className="mt-3 space-y-2">
            {q.options.map((opt, j) => (
              <label key={j} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${answers[i] === j ? "border-ac-brand bg-ac-soft" : "border-slate-200 hover:border-slate-300"}`}>
                <input
                  type="radio"
                  name={`q${i}`}
                  checked={answers[i] === j}
                  onChange={() => { setResult(null); setAnswers((a) => a.map((x, k) => (k === i ? j : x))); }}
                  className="accent-blue-600"
                />
                {opt}
              </label>
            ))}
          </div>
          {result && (
            <p className={`mt-2 text-sm font-medium ${result.correct[i] ? "text-emerald-600" : "text-red-600"}`}>
              {result.correct[i] ? "Correct" : "Not quite"}
            </p>
          )}
        </fieldset>
      ))}
      {result && (
        <p className={`rounded-xl p-4 text-sm font-semibold ${result.passed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          You scored {result.score}%. {result.passed ? "Passed!" : "You need 60% to pass — have another go."}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || answers.some((a) => a < 0)}
        className="rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark disabled:opacity-50"
      >
        {busy ? "Checking…" : "Submit answers"}
      </button>
    </div>
  );
}
